// server/index.js
import http from 'node:http';
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDatabase, db } from './db.js';
import { processUserMessage, generateTriComparison } from './orchestrator.js';
import { searchVehicleManual } from './rag.js';
import { searchNearbyFacilities } from './tools/places.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '..', 'dist');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'car-guide-admin-2024';

// DB 초기화
initDatabase();

// CORS 및 JSON 헬퍼
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-id, x-admin-key');
}

function sendJson(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: true, message });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { // 2MB 제한
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// 정적 파일 MIME 타입 매핑
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`[HTTP] ${method} ${pathname}`);

  try {
    // ----------------------------------------------------
    // 1. 차량 관련 API
    // ----------------------------------------------------
    if (pathname === '/api/vehicles' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM vehicles').all();
      return sendJson(res, 200, { vehicles: rows });
    }

    // ----------------------------------------------------
    // 2. 익명 세션 관리 API
    // ----------------------------------------------------
    if (pathname === '/api/sessions' && method === 'POST') {
      const body = await parseJsonBody(req);
      const sessionId = body.sessionId || ('sess-' + crypto.randomUUID());
      const vehicleId = body.vehicleId || null;

      const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      const now = new Date().toISOString();

      if (!existing) {
        db.prepare('INSERT INTO sessions (id, current_vehicle_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
          sessionId, vehicleId, now, now
        );
      } else if (vehicleId) {
        db.prepare('UPDATE sessions SET current_vehicle_id = ?, updated_at = ? WHERE id = ?').run(
          vehicleId, now, sessionId
        );
      }

      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      return sendJson(res, 200, { session });
    }

    // ----------------------------------------------------
    // 3. 대화 목록 및 생성 API
    // ----------------------------------------------------
    if (pathname === '/api/conversations' && method === 'GET') {
      const sessionId = req.headers['x-session-id'] || parsedUrl.query.sessionId;
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }

      const conversations = db.prepare(`
        SELECT c.*, 
          (SELECT content FROM messages WHERE conversation_id = c.id AND sender = 'user' ORDER BY created_at ASC LIMIT 1) as first_question,
          (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        WHERE c.session_id = ?
        ORDER BY c.updated_at DESC
      `).all(sessionId);

      return sendJson(res, 200, { conversations });
    }

    if (pathname === '/api/conversations' && method === 'POST') {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }
      const body = await parseJsonBody(req);
      const vehicleId = body.vehicleId;
      if (!vehicleId) {
        return sendError(res, 400, '차량 ID가 필요합니다.');
      }

      const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
      if (!vehicle) {
        return sendError(res, 404, '차량을 찾을 수 없습니다.');
      }

      const convId = 'conv-' + crypto.randomUUID();
      const now = new Date().toISOString();
      const initialTitle = body.title || `${vehicle.brand} ${vehicle.model_name} 가이드`;

      db.prepare(`
        INSERT INTO conversations (id, session_id, vehicle_id, vehicle_snapshot, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(convId, sessionId, vehicleId, JSON.stringify(vehicle), initialTitle, now, now);

      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
      return sendJson(res, 201, { conversation: conv });
    }

    // ----------------------------------------------------
    // 4. 개별 대화 조회 및 삭제 API
    // ----------------------------------------------------
    if (pathname.startsWith('/api/conversations/') && method === 'GET') {
      const convId = pathname.replace('/api/conversations/', '');
      const sessionId = req.headers['x-session-id'];

      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
      if (!conv) {
        return sendError(res, 404, '대화를 찾을 수 없습니다.');
      }
      if (sessionId && conv.session_id !== sessionId) {
        return sendError(res, 403, '해당 대화에 접근할 권한이 없습니다.');
      }

      const messages = db.prepare(`
        SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
      `).all(convId);

      return sendJson(res, 200, {
        conversation: conv,
        messages: messages.map(m => ({
          ...m,
          structured_data: m.structured_data ? JSON.parse(m.structured_data) : null
        }))
      });
    }

    if (pathname.startsWith('/api/conversations/') && method === 'DELETE') {
      const convId = pathname.replace('/api/conversations/', '');
      const sessionId = req.headers['x-session-id'];

      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
      if (!conv) {
        return sendError(res, 404, '대화를 찾을 수 없습니다.');
      }
      if (sessionId && conv.session_id !== sessionId) {
        return sendError(res, 403, '해당 대화를 삭제할 권한이 없습니다.');
      }

      // SQLite 외래키 CASCADE로 메시지 및 컨텍스트도 함께 삭제됨
      db.prepare('DELETE FROM conversations WHERE id = ?').run(convId);
      return sendJson(res, 200, { success: true, message: '대화가 완전히 삭제되었습니다.' });
    }

    // ----------------------------------------------------
    // 5. 질문 전송 및 RAG + 맥락 답변 생성 API (/api/chat)
    // ----------------------------------------------------
    if (pathname === '/api/chat' && method === 'POST') {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }

      const body = await parseJsonBody(req);
      const { conversationId, userMessage, vehicleId, clientLocation, providedState } = body;

      if (!conversationId || !userMessage) {
        return sendError(res, 400, 'conversationId와 userMessage가 필요합니다.');
      }

      // 대화 권한 확인
      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
      if (!conv) {
        return sendError(res, 404, '대화를 찾을 수 없습니다.');
      }
      if (conv.session_id !== sessionId) {
        return sendError(res, 403, '권한이 없습니다.');
      }

      // 사용자 메시지 먼저 저장
      const userMsgId = 'msg-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender, content, structured_data, created_at)
        VALUES (?, ?, 'user', ?, ?, ?)
      `).run(
        userMsgId,
        conversationId,
        userMessage,
        providedState ? JSON.stringify({ userState: providedState }) : null,
        new Date().toISOString()
      );

      // AI + RAG + 위치 결합 처리
      const result = await processUserMessage({
        sessionId,
        conversationId,
        userMessage,
        vehicleId: vehicleId || conv.vehicle_id,
        clientLocation,
        providedState,
        driveMode: body.driveMode || 'PARKED',
        preferredLength: body.preferredLength || 'short'
      });

      return sendJson(res, 200, {
        userMessageId: userMsgId,
        assistantMessageId: result.messageId,
        processSteps: result.processSteps,
        response: result.response
      });
    }

    // ----------------------------------------------------
    // 6. 개인화 및 권한 설정 API (/api/settings)
    // ----------------------------------------------------
    if (pathname === '/api/settings' && method === 'GET') {
      const sessionId = req.headers['x-session-id'] || parsedUrl.query.sessionId;
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }

      let settings = db.prepare('SELECT * FROM user_settings WHERE session_id = ?').get(sessionId);
      if (!settings) {
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO user_settings (session_id, preferred_length, voice_guidance_enabled, location_permission, weather_permission, vehicle_data_permission, history_save_enabled, drive_mode, created_at, updated_at)
          VALUES (?, 'short', 1, 0, 0, 0, 1, 'PARKED', ?, ?)
        `).run(sessionId, now, now);
        settings = db.prepare('SELECT * FROM user_settings WHERE session_id = ?').get(sessionId);
      }

      return sendJson(res, 200, { settings });
    }

    if (pathname === '/api/settings' && method === 'POST') {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }
      const body = await parseJsonBody(req);
      const now = new Date().toISOString();

      const existing = db.prepare('SELECT * FROM user_settings WHERE session_id = ?').get(sessionId);
      if (!existing) {
        db.prepare(`
          INSERT INTO user_settings (
            session_id, preferred_length, voice_guidance_enabled, location_permission,
            weather_permission, vehicle_data_permission, history_save_enabled, drive_mode, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sessionId,
          body.preferred_length || 'short',
          body.voice_guidance_enabled !== undefined ? (body.voice_guidance_enabled ? 1 : 0) : 1,
          body.location_permission ? 1 : 0,
          body.weather_permission ? 1 : 0,
          body.vehicle_data_permission ? 1 : 0,
          body.history_save_enabled !== undefined ? (body.history_save_enabled ? 1 : 0) : 1,
          body.drive_mode || 'PARKED',
          now,
          now
        );
      } else {
        db.prepare(`
          UPDATE user_settings SET
            preferred_length = coalesce(?, preferred_length),
            voice_guidance_enabled = coalesce(?, voice_guidance_enabled),
            location_permission = coalesce(?, location_permission),
            weather_permission = coalesce(?, weather_permission),
            vehicle_data_permission = coalesce(?, vehicle_data_permission),
            history_save_enabled = coalesce(?, history_save_enabled),
            drive_mode = coalesce(?, drive_mode),
            updated_at = ?
          WHERE session_id = ?
        `).run(
          body.preferred_length ?? null,
          body.voice_guidance_enabled !== undefined ? (body.voice_guidance_enabled ? 1 : 0) : null,
          body.location_permission !== undefined ? (body.location_permission ? 1 : 0) : null,
          body.weather_permission !== undefined ? (body.weather_permission ? 1 : 0) : null,
          body.vehicle_data_permission !== undefined ? (body.vehicle_data_permission ? 1 : 0) : null,
          body.history_save_enabled !== undefined ? (body.history_save_enabled ? 1 : 0) : null,
          body.drive_mode ?? null,
          now,
          sessionId
        );
      }

      const updated = db.prepare('SELECT * FROM user_settings WHERE session_id = ?').get(sessionId);
      return sendJson(res, 200, { settings: updated });
    }

    // ----------------------------------------------------
    // 7. AI 답변 비교 연구 평가 API (/api/research/evaluate)
    // ----------------------------------------------------
    if (pathname === '/api/research/evaluate' && method === 'POST') {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }
      const body = await parseJsonBody(req);
      const evalId = 'eval-' + crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO research_evaluations (
          id, session_id, vehicle_id, query, chosen_answer, choice_reason,
          eval_source_quality, eval_safety, eval_vehicle_accuracy,
          answer_a_summary, answer_b_summary, answer_a_model, answer_b_model, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        evalId,
        sessionId,
        body.vehicleId || 'unknown',
        body.query || '',
        body.chosenAnswer || 'TIE',
        body.choiceReason || '',
        body.evalSourceQuality || 3,
        body.evalSafety || 3,
        body.evalVehicleAccuracy || 3,
        body.answerASummary || '',
        body.answerBSummary || '',
        body.answerAModel || 'Blind-Model-A',
        body.answerBModel || 'Blind-Model-B',
        now
      );

      return sendJson(res, 201, { success: true, evalId });
    }

    if (pathname === '/api/research/evaluations' && method === 'GET') {
      const evals = db.prepare('SELECT * FROM research_evaluations ORDER BY created_at DESC LIMIT 50').all();
      return sendJson(res, 200, { evaluations: evals });
    }

    // ----------------------------------------------------
    // 6. 위치 기반 주변 시설 단독 조회 API (/api/places)
    // ----------------------------------------------------
    if (pathname === '/api/places' && method === 'POST') {
      const body = await parseJsonBody(req);
      const results = await searchNearbyFacilities(body);
      return sendJson(res, 200, results);
    }

    // ----------------------------------------------------
    // UT 시뮬레이션 모드 API (/api/simulation/...)
    // ----------------------------------------------------
    if (pathname === '/api/simulation/scenarios' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM simulation_scenarios ORDER BY is_default DESC, created_at ASC').all();
      const parsed = rows.map(r => ({
        ...r,
        warning_lights: r.warning_lights ? JSON.parse(r.warning_lights) : [],
        dtc_codes: r.dtc_codes ? JSON.parse(r.dtc_codes) : [],
        sample_questions: r.sample_questions ? JSON.parse(r.sample_questions) : []
      }));
      return sendJson(res, 200, { scenarios: parsed });
    }

    if (pathname === '/api/simulation/scenarios' && method === 'POST') {
      const body = await parseJsonBody(req);
      const now = new Date().toISOString();
      const id = body.id || ('scen-' + crypto.randomUUID());

      const existing = db.prepare('SELECT id FROM simulation_scenarios WHERE id = ?').get(id);
      if (existing) {
        db.prepare(`
          UPDATE simulation_scenarios SET
            title = ?, description = ?, vehicle_brand = ?, vehicle_model = ?, vehicle_year = ?,
            vehicle_trim = ?, vehicle_sw_version = ?, vehicle_region = ?, drive_state = ?,
            warning_lights = ?, dtc_codes = ?, observed_symptoms = ?, road_type = ?,
            time_of_day = ?, weather_condition = ?, user_goal = ?, user_constraints = ?,
            expected_criteria = ?, sample_questions = ?, updated_at = ?
          WHERE id = ?
        `).run(
          body.title || '새 가상 시나리오',
          body.description || '',
          body.vehicle_brand || '현대',
          body.vehicle_model || '더 뉴 아반떼',
          body.vehicle_year || '2024',
          body.vehicle_trim || '가솔린 1.6 인스퍼레이션',
          body.vehicle_sw_version || 'ccNC.2024.03',
          body.vehicle_region || 'KOR',
          body.drive_state || 'PARKED',
          JSON.stringify(body.warning_lights || []),
          JSON.stringify(body.dtc_codes || []),
          body.observed_symptoms || '',
          body.road_type || '일반도로',
          body.time_of_day || '주간',
          body.weather_condition || '맑음',
          body.user_goal || '',
          body.user_constraints || '',
          body.expected_criteria || '',
          JSON.stringify(body.sample_questions || []),
          now,
          id
        );
      } else {
        db.prepare(`
          INSERT INTO simulation_scenarios (
            id, title, description, vehicle_brand, vehicle_model, vehicle_year,
            vehicle_trim, vehicle_sw_version, vehicle_region, drive_state,
            warning_lights, dtc_codes, observed_symptoms, road_type,
            time_of_day, weather_condition, user_goal, user_constraints,
            expected_criteria, sample_questions, is_default, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(
          id,
          body.title || '새 가상 시나리오',
          body.description || '',
          body.vehicle_brand || '현대',
          body.vehicle_model || '더 뉴 아반떼',
          body.vehicle_year || '2024',
          body.vehicle_trim || '가솔린 1.6 인스퍼레이션',
          body.vehicle_sw_version || 'ccNC.2024.03',
          body.vehicle_region || 'KOR',
          body.drive_state || 'PARKED',
          JSON.stringify(body.warning_lights || []),
          JSON.stringify(body.dtc_codes || []),
          body.observed_symptoms || '',
          body.road_type || '일반도로',
          body.time_of_day || '주간',
          body.weather_condition || '맑음',
          body.user_goal || '',
          body.user_constraints || '',
          body.expected_criteria || '',
          JSON.stringify(body.sample_questions || []),
          now,
          now
        );
      }

      const updated = db.prepare('SELECT * FROM simulation_scenarios WHERE id = ?').get(id);
      return sendJson(res, 200, {
        scenario: {
          ...updated,
          warning_lights: JSON.parse(updated.warning_lights || '[]'),
          dtc_codes: JSON.parse(updated.dtc_codes || '[]'),
          sample_questions: JSON.parse(updated.sample_questions || '[]')
        }
      });
    }

    if (pathname.startsWith('/api/simulation/scenarios/') && method === 'DELETE') {
      const scenId = pathname.replace('/api/simulation/scenarios/', '');
      db.prepare('DELETE FROM simulation_scenarios WHERE id = ?').run(scenId);
      return sendJson(res, 200, { success: true, message: '시나리오가 삭제되었습니다.' });
    }

    if (pathname === '/api/simulation/active' && method === 'GET') {
      const sessionId = req.headers['x-session-id'] || parsedUrl.query.sessionId;
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }

      let activeRow = db.prepare(`
        SELECT a.*, s.title, s.vehicle_brand, s.vehicle_model, s.vehicle_year, s.vehicle_trim, s.vehicle_sw_version,
               s.drive_state, s.warning_lights, s.dtc_codes, s.observed_symptoms, s.road_type, s.time_of_day, s.weather_condition,
               s.user_goal, s.user_constraints, s.expected_criteria, s.sample_questions
        FROM active_simulation_contexts a
        JOIN simulation_scenarios s ON a.scenario_id = s.id
        WHERE a.session_id = ?
      `).get(sessionId);

      if (!activeRow) {
        const defaultScen = db.prepare('SELECT * FROM simulation_scenarios WHERE is_default = 1 LIMIT 1').get() ||
                            db.prepare('SELECT * FROM simulation_scenarios LIMIT 1').get();
        if (defaultScen) {
          const now = new Date().toISOString();
          db.prepare(`
            INSERT OR REPLACE INTO active_simulation_contexts (session_id, scenario_id, is_active, custom_override, updated_at)
            VALUES (?, ?, 1, NULL, ?)
          `).run(sessionId, defaultScen.id, now);

          activeRow = {
            session_id: sessionId,
            scenario_id: defaultScen.id,
            is_active: 1,
            custom_override: null,
            ...defaultScen
          };
        }
      }

      if (activeRow) {
        return sendJson(res, 200, {
          isActive: activeRow.is_active === 1,
          scenarioId: activeRow.scenario_id,
          scenario: {
            ...activeRow,
            warning_lights: activeRow.warning_lights ? JSON.parse(activeRow.warning_lights) : [],
            dtc_codes: activeRow.dtc_codes ? JSON.parse(activeRow.dtc_codes) : [],
            sample_questions: activeRow.sample_questions ? JSON.parse(activeRow.sample_questions) : []
          }
        });
      }

      return sendJson(res, 200, { isActive: false, scenarioId: null, scenario: null });
    }

    if (pathname === '/api/simulation/active' && method === 'POST') {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        return sendError(res, 400, 'x-session-id 헤더가 필요합니다.');
      }
      const body = await parseJsonBody(req);
      const now = new Date().toISOString();

      const scenarioId = body.scenarioId;
      const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : 1;
      const customOverride = body.customOverride ? JSON.stringify(body.customOverride) : null;

      db.prepare(`
        INSERT INTO active_simulation_contexts (session_id, scenario_id, is_active, custom_override, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          scenario_id = excluded.scenario_id,
          is_active = excluded.is_active,
          custom_override = excluded.custom_override,
          updated_at = excluded.updated_at
      `).run(sessionId, scenarioId, isActive, customOverride, now);

      return sendJson(res, 200, { success: true, scenarioId, isActive: isActive === 1 });
    }

    // ----------------------------------------------------
    // 지식 베이스(Knowledge Items) 조회 및 등록 API (/api/knowledge)
    // ----------------------------------------------------
    if (pathname === '/api/knowledge' && method === 'GET') {
      const category = parsedUrl.query.category;
      let rows;
      if (category) {
        rows = db.prepare('SELECT * FROM knowledge_items WHERE category = ? ORDER BY created_at DESC').all(category);
      } else {
        rows = db.prepare('SELECT * FROM knowledge_items ORDER BY created_at DESC').all();
      }

      const parsed = rows.map(r => ({
        ...r,
        action_steps: r.action_steps ? JSON.parse(r.action_steps) : [],
        clarification_questions: r.clarification_questions ? JSON.parse(r.clarification_questions) : null,
        applicable_models: r.applicable_models ? JSON.parse(r.applicable_models) : [],
        applicable_years: r.applicable_years ? JSON.parse(r.applicable_years) : [],
        applicable_trims: r.applicable_trims ? JSON.parse(r.applicable_trims) : [],
        applicable_regions: r.applicable_regions ? JSON.parse(r.applicable_regions) : ['KOR'],
        applicable_sw_versions: r.applicable_sw_versions ? JSON.parse(r.applicable_sw_versions) : []
      }));

      return sendJson(res, 200, { knowledgeItems: parsed });
    }

    if (pathname === '/api/knowledge' && method === 'POST') {
      const body = await parseJsonBody(req);
      const now = new Date().toISOString();
      const id = body.id || ('know-' + crypto.randomUUID());

      const existing = db.prepare('SELECT id FROM knowledge_items WHERE id = ?').get(id);
      if (existing) {
        db.prepare(`
          UPDATE knowledge_items SET
            category = ?, title = ?, content = ?, immediate_action = ?, action_steps = ?,
            rationale = ?, stop_conditions = ?, clarification_questions = ?, document_title = ?,
            source_org = ?, source_section = ?, source_page = ?, effective_date = ?,
            applicable_models = ?, applicable_years = ?, applicable_trims = ?, applicable_regions = ?,
            applicable_sw_versions = ?, is_virtual_sample = ?, keywords = ?,
            doc_url = ?, applicable_country = ?, doc_version = ?, last_verified_date = ?,
            evidence_level = ?, is_deprecated = ?, prohibited_actions = ?, judgement_limits = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          body.category || 'OWNER_MANUAL',
          body.title || '',
          body.content || '',
          body.immediate_action || '',
          JSON.stringify(body.action_steps || []),
          body.rationale || '',
          body.stop_conditions || '',
          body.clarification_questions ? JSON.stringify(body.clarification_questions) : null,
          body.document_title || '',
          body.source_org || '',
          body.source_section || '',
          body.source_page || '',
          body.effective_date || '',
          JSON.stringify(body.applicable_models || []),
          JSON.stringify(body.applicable_years || []),
          JSON.stringify(body.applicable_trims || []),
          JSON.stringify(body.applicable_regions || ['KOR']),
          JSON.stringify(body.applicable_sw_versions || []),
          body.is_virtual_sample !== undefined ? (body.is_virtual_sample ? 1 : 0) : 1,
          body.keywords || '',
          body.doc_url || '',
          body.applicable_country || 'KOR',
          body.doc_version || '',
          body.last_verified_date || now.split('T')[0],
          body.evidence_level || 'OFFICIAL_MANUAL',
          body.is_deprecated ? 1 : 0,
          body.prohibited_actions || '',
          body.judgement_limits || '',
          now,
          id
        );
      } else {
        db.prepare(`
          INSERT INTO knowledge_items (
            id, category, title, content, immediate_action, action_steps,
            rationale, stop_conditions, clarification_questions, document_title,
            source_org, source_section, source_page, effective_date,
            applicable_models, applicable_years, applicable_trims, applicable_regions,
            applicable_sw_versions, is_virtual_sample, keywords,
            doc_url, applicable_country, doc_version, last_verified_date,
            evidence_level, is_deprecated, prohibited_actions, judgement_limits,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          body.category || 'OWNER_MANUAL',
          body.title || '',
          body.content || '',
          body.immediate_action || '',
          JSON.stringify(body.action_steps || []),
          body.rationale || '',
          body.stop_conditions || '',
          body.clarification_questions ? JSON.stringify(body.clarification_questions) : null,
          body.document_title || '',
          body.source_org || '',
          body.source_section || '',
          body.source_page || '',
          body.effective_date || '',
          JSON.stringify(body.applicable_models || []),
          JSON.stringify(body.applicable_years || []),
          JSON.stringify(body.applicable_trims || []),
          JSON.stringify(body.applicable_regions || ['KOR']),
          JSON.stringify(body.applicable_sw_versions || []),
          body.is_virtual_sample !== undefined ? (body.is_virtual_sample ? 1 : 0) : 1,
          body.keywords || '',
          body.doc_url || '',
          body.applicable_country || 'KOR',
          body.doc_version || '',
          body.last_verified_date || now.split('T')[0],
          body.evidence_level || 'OFFICIAL_MANUAL',
          body.is_deprecated ? 1 : 0,
          body.prohibited_actions || '',
          body.judgement_limits || '',
          now,
          now
        );
      }

      return sendJson(res, 201, { success: true, id });
    }

    // ----------------------------------------------------
    // UT 평가 전용 API (3사 비교, 20개 문항, 선호/전문가 평가)
    // ----------------------------------------------------
    // 1) 20개 UT 시험 문항 조회
    if (pathname === '/api/ut/test-items' && method === 'GET') {
      const scenarioId = parsedUrl.query.scenarioId;
      let items;
      if (scenarioId) {
        items = db.prepare('SELECT * FROM ut_test_items WHERE scenario_id = ? ORDER BY item_number ASC').all(scenarioId);
      } else {
        items = db.prepare('SELECT * FROM ut_test_items ORDER BY item_number ASC').all();
      }
      return sendJson(res, 200, { testItems: items });
    }

    // 2) 3개 시스템 비교 답변 실시간 생성 API
    if (pathname === '/api/ut/generate-tri-comparison' && method === 'POST') {
      const body = await parseJsonBody(req);
      const testItemId = body.testItemId;
      const scenarioId = body.scenarioId || 'scenario-s6-ioniq5';
      let userMessage = body.userPrompt;

      let testItem = null;
      if (testItemId) {
        testItem = db.prepare('SELECT * FROM ut_test_items WHERE id = ?').get(testItemId);
        if (testItem && !userMessage) {
          userMessage = testItem.user_prompt;
        }
      }

      const scenario = db.prepare('SELECT * FROM simulation_scenarios WHERE id = ?').get(scenarioId);
      const vehicle = (scenario && scenario.vehicle_id)
        ? db.prepare('SELECT * FROM vehicles WHERE id = ?').get(scenario.vehicle_id)
        : db.prepare("SELECT * FROM vehicles WHERE id = 'hyundai-ioniq5-ne1-2025'").get();

      // 우리 서비스 오케스트레이터 RAG 호출
      const oursPayload = await processUserMessage({
        conversationId: 'ut-test-' + (testItemId || 's6'),
        userMessage: userMessage || '전방 센서 가림 경고 시 계속 주행해도 되나요?',
        vehicle,
        activeScenario: scenario,
        providedState: {
          location: scenario ? scenario.location_name : '고속도로 휴게소 진입 전',
          driving_state: scenario ? scenario.driving_status : '저속 주행 중',
          weather: scenario ? scenario.weather : '눈길',
          warning_display: scenario ? scenario.warning_lights : '전방 센서 가림'
        }
      });

      const triResult = generateTriComparison({
        userMessage: userMessage || '전방 센서 가림',
        vehicle,
        scenario,
        oursPayload
      });

      // 사용자 직접 입력 오버라이드 지원 (ChatGPT, Gemini 실제 응답 붙여넣기 허용)
      if (body.customChatgpt) {
        if (typeof body.customChatgpt === 'string') {
          triResult.chatgpt.summary = body.customChatgpt;
        } else {
          triResult.chatgpt.summary = body.customChatgpt.summary || triResult.chatgpt.summary;
          triResult.chatgpt.immediate_action = body.customChatgpt.immediate_action || '';
        }
        triResult.chatgpt.status = 'USER_PASTED';
        triResult.chatgpt.source_display = '출처 확인 불가 (외부 사용자 직접 입력)';
      }

      if (body.customGemini) {
        if (typeof body.customGemini === 'string') {
          triResult.gemini.summary = body.customGemini;
        } else {
          triResult.gemini.summary = body.customGemini.summary || triResult.gemini.summary;
          triResult.gemini.immediate_action = body.customGemini.immediate_action || '';
        }
        triResult.gemini.status = 'USER_PASTED';
        triResult.gemini.source_display = '출처 확인 불가 (외부 사용자 직접 입력)';
      }

      return sendJson(res, 200, {
        testItem,
        scenario,
        vehicle,
        comparison: triResult
      });
    }

    // 3) UT 평가 제출 API
    if (pathname === '/api/ut/tri-evaluations' && method === 'POST') {
      const body = await parseJsonBody(req);
      const now = new Date().toISOString();
      const id = body.id || ('trieval-' + crypto.randomUUID());

      db.prepare(`
        INSERT INTO ut_tri_evaluations (
          id, session_id, scenario_id, test_item_id, chosen_system,
          driver_clarity, driver_actionability, driver_context_fit, driver_trust, driver_preference_notes,
          expert_system_target, expert_accuracy, expert_safety, expert_context_fit, expert_evidence_grounding, expert_prudence,
          fact_checklist, grounding_sentence_mapping, has_critical_safety_error, critical_error_detail, critical_error_severity, expert_notes,
          ours_response_json, chatgpt_response_text, gemini_response_text,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?
        )
      `).run(
        id,
        body.session_id || 'anonymous-ut',
        body.scenario_id || 'scenario-s6-ioniq5',
        body.test_item_id || null,
        body.chosen_system || 'OURS',
        body.driver_clarity || null,
        body.driver_actionability || null,
        body.driver_context_fit || null,
        body.driver_trust || null,
        body.driver_preference_notes || null,
        body.expert_system_target || 'OURS',
        body.expert_accuracy || null,
        body.expert_safety || null,
        body.expert_context_fit || null,
        body.expert_evidence_grounding || null,
        body.expert_prudence || null,
        JSON.stringify(body.fact_checklist || []),
        body.grounding_sentence_mapping || null,
        body.has_critical_safety_error ? 1 : 0,
        body.critical_error_detail || null,
        body.critical_error_severity || null,
        body.expert_notes || null,
        body.ours_response_json ? JSON.stringify(body.ours_response_json) : null,
        body.chatgpt_response_text || null,
        body.gemini_response_text || null,
        now,
        now
      );

      return sendJson(res, 201, { success: true, id });
    }

    // 4) UT 평가 내역 조회 API
    if (pathname === '/api/ut/tri-evaluations' && method === 'GET') {
      const testItemId = parsedUrl.query.testItemId;
      let evaluations;
      if (testItemId) {
        evaluations = db.prepare('SELECT * FROM ut_tri_evaluations WHERE test_item_id = ? ORDER BY created_at DESC').all(testItemId);
      } else {
        evaluations = db.prepare('SELECT * FROM ut_tri_evaluations ORDER BY created_at DESC').all();
      }
      const parsed = evaluations.map(e => ({
        ...e,
        fact_checklist: e.fact_checklist ? JSON.parse(e.fact_checklist) : [],
        ours_response_json: e.ours_response_json ? JSON.parse(e.ours_response_json) : null
      }));
      return sendJson(res, 200, { evaluations: parsed });
    }

    // 5) UT 평가 결과 요약 대시보드 API
    if (pathname === '/api/ut/results-summary' && method === 'GET') {
      const evaluations = db.prepare('SELECT * FROM ut_tri_evaluations').all();
      const total = evaluations.length;

      const systemChoiceCounts = { OURS: 0, CHATGPT: 0, GEMINI: 0, TIE: 0, NONE: 0 };
      let sumDriverClarity = 0, sumDriverAction = 0, sumDriverFit = 0, sumDriverTrust = 0, driverCount = 0;
      
      const expertStats = {
        OURS: { count: 0, accuracy: 0, safety: 0, contextFit: 0, grounding: 0, prudence: 0 },
        CHATGPT: { count: 0, accuracy: 0, safety: 0, contextFit: 0, grounding: 0, prudence: 0 },
        GEMINI: { count: 0, accuracy: 0, safety: 0, contextFit: 0, grounding: 0, prudence: 0 }
      };

      let criticalSafetyErrorCount = 0;
      const criticalErrors = [];

      for (const e of evaluations) {
        if (systemChoiceCounts[e.chosen_system] !== undefined) {
          systemChoiceCounts[e.chosen_system]++;
        }
        if (e.driver_clarity) {
          sumDriverClarity += e.driver_clarity;
          sumDriverAction += (e.driver_actionability || 0);
          sumDriverFit += (e.driver_context_fit || 0);
          sumDriverTrust += (e.driver_trust || 0);
          driverCount++;
        }
        const target = e.expert_system_target || 'OURS';
        if (expertStats[target] && e.expert_accuracy) {
          expertStats[target].count++;
          expertStats[target].accuracy += e.expert_accuracy;
          expertStats[target].safety += (e.expert_safety || 0);
          expertStats[target].contextFit += (e.expert_context_fit || 0);
          expertStats[target].grounding += (e.expert_evidence_grounding || 0);
          expertStats[target].prudence += (e.expert_prudence || 0);
        }
        if (e.has_critical_safety_error) {
          criticalSafetyErrorCount++;
          criticalErrors.push({
            id: e.id,
            test_item_id: e.test_item_id,
            target: e.expert_system_target,
            severity: e.critical_error_severity,
            detail: e.critical_error_detail,
            created_at: e.created_at
          });
        }
      }

      const driverAverages = driverCount > 0 ? {
        clarity: +(sumDriverClarity / driverCount).toFixed(2),
        actionability: +(sumDriverAction / driverCount).toFixed(2),
        contextFit: +(sumDriverFit / driverCount).toFixed(2),
        trust: +(sumDriverTrust / driverCount).toFixed(2)
      } : null;

      const expertAverages = {};
      for (const [k, v] of Object.entries(expertStats)) {
        if (v.count > 0) {
          expertAverages[k] = {
            count: v.count,
            accuracy: +(v.accuracy / v.count).toFixed(2),
            safety: +(v.safety / v.count).toFixed(2),
            contextFit: +(v.contextFit / v.count).toFixed(2),
            grounding: +(v.grounding / v.count).toFixed(2),
            prudence: +(v.prudence / v.count).toFixed(2)
          };
        } else {
          expertAverages[k] = { count: 0, accuracy: 0, safety: 0, contextFit: 0, grounding: 0, prudence: 0 };
        }
      }

      return sendJson(res, 200, {
        totalEvaluations: total,
        systemChoiceCounts,
        driverCount,
        driverAverages,
        expertAverages,
        criticalSafetyErrorCount,
        criticalErrors
      });
    }

    // ----------------------------------------------------
    // 7. 운영자(Admin) 전용 API
    // ----------------------------------------------------
    if (pathname.startsWith('/api/admin/')) {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== ADMIN_KEY) {
        return sendError(res, 401, '운영자 인증에 실패했습니다.');
      }

      // 매뉴얼 문서 목록 및 처리 상태 확인
      if (pathname === '/api/admin/documents' && method === 'GET') {
        const docs = db.prepare(`
          SELECT d.*, v.brand, v.model_name, v.year_range,
            (SELECT COUNT(*) FROM manual_chunks WHERE document_id = d.id) as chunk_count
          FROM manual_documents d
          JOIN vehicles v ON d.vehicle_id = v.id
        `).all();
        return sendJson(res, 200, { documents: docs });
      }

      // 매뉴얼 RAG 검색 시뮬레이션
      if (pathname === '/api/admin/test-rag' && method === 'POST') {
        const body = await parseJsonBody(req);
        const searchResult = searchVehicleManual({
          vehicleId: body.vehicleId,
          query: body.query
        });
        return sendJson(res, 200, searchResult);
      }

      // 질의응답 및 도구 호출 감사 로그 조회
      if (pathname === '/api/admin/logs' && method === 'GET') {
        const logs = db.prepare(`
          SELECT ctx.*, m.content as response_content, c.id as conversation_id, c.vehicle_snapshot,
            (SELECT content FROM messages WHERE conversation_id = c.id AND sender = 'user' AND created_at <= m.created_at ORDER BY created_at DESC LIMIT 1) as user_query
          FROM message_contexts ctx
          JOIN messages m ON ctx.message_id = m.id
          JOIN conversations c ON m.conversation_id = c.id
          ORDER BY ctx.created_at DESC
          LIMIT 100
        `).all();

        return sendJson(res, 200, {
          logs: logs.map(l => ({
            ...l,
            vehicle_snapshot: JSON.parse(l.vehicle_snapshot),
            manual_chunks_used: l.manual_chunks_used ? JSON.parse(l.manual_chunks_used) : [],
            tool_calls: l.tool_calls ? JSON.parse(l.tool_calls) : [],
            vehicle_state_used: l.vehicle_state_used ? JSON.parse(l.vehicle_state_used) : null,
            location_used: l.location_used ? JSON.parse(l.location_used) : null
          }))
        });
      }

      // 로그 내보내기 (JSON 및 CSV)
      if (pathname === '/api/admin/export' && method === 'GET') {
        const format = parsedUrl.query.format || 'json';
        const logs = db.prepare(`
          SELECT ctx.id as log_id, ctx.created_at, ctx.model_version, ctx.generation_duration_ms,
                 m.id as message_id, m.content as assistant_response,
                 c.id as conversation_id, c.session_id,
                 v.brand, v.model_name,
                 (SELECT content FROM messages WHERE conversation_id = c.id AND sender = 'user' ORDER BY created_at ASC LIMIT 1) as initial_query,
                 ctx.manual_chunks_used, ctx.vehicle_state_used, ctx.tool_calls
          FROM message_contexts ctx
          JOIN messages m ON ctx.message_id = m.id
          JOIN conversations c ON m.conversation_id = c.id
          JOIN vehicles v ON c.vehicle_id = v.id
          ORDER BY ctx.created_at DESC
        `).all();

        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="car_guide_audit_logs.csv"');
          
          let csv = 'log_id,created_at,conversation_id,brand,model_name,initial_query,generation_ms\n';
          for (const l of logs) {
            const cleanQuery = (l.initial_query || '').replace(/"/g, '""');
            csv += `"${l.log_id}","${l.created_at}","${l.conversation_id}","${l.brand}","${l.model_name}","${cleanQuery}",${l.generation_duration_ms}\n`;
          }
          return res.end(csv);
        }

        return sendJson(res, 200, { count: logs.length, exported_at: new Date().toISOString(), logs });
      }
    }

    // ----------------------------------------------------
    // 8. 정적 프론트엔드 서빙 (빌드된 Vite dist)
    // ----------------------------------------------------
    if (!pathname.startsWith('/api/')) {
      let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

      // 파일이 없으면 SPA 폴백으로 index.html 반환
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }

      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      } else {
        // 아직 dist 빌드 전인 경우 안내
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>내 차 가이드 백엔드 가동 중</h2><p>프론트엔드 빌드 중입니다.</p>`);
        return;
      }
    }

    // 미정의 API
    sendError(res, 404, 'API 엔드포인트를 찾을 수 없습니다.');
  } catch (err) {
    console.error('Server Error:', err);
    sendError(res, 500, err.message || '서버 내부 오류가 발생했습니다.');
  }
});

server.listen(PORT, () => {
  console.log(`[내 차 가이드] Server running on http://localhost:${PORT}`);
});

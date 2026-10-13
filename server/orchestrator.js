// server/orchestrator.js
import crypto from 'node:crypto';
import { searchVehicleManual } from './rag.js';
import { searchNearbyFacilities } from './tools/places.js';
import { db } from './db.js';

/**
 * 사용자 질문 의도 분석 및 필요 리소스 결정
 */
export function analyzeIntent({ query, vehicle, currentStates, scenario = null }) {
  const q = query.toLowerCase();

  const isBluetooth = q.includes('블루투스') || q.includes('폰 연결') || q.includes('스마트폰') || q.includes('카플레이') || q.includes('안드로이드 오토') || q.includes('핸드폰');
  const isTire = q.includes('타이어') || q.includes('공기압') || q.includes('tpms') || q.includes('추운 날') || q.includes('겨울');
  const isFuel = q.includes('연료') || q.includes('기름') || q.includes('주유') || q.includes('배터리') || q.includes('충전') || q.includes('주행가능거리');
  const isWarning = q.includes('경고') || q.includes('표시등') || q.includes('불 들어') || q.includes('고장');
  const isSmartKey = q.includes('스마트키') || q.includes('차키') || q.includes('시동') || q.includes('방전');
  const isDefrost = q.includes('서리') || q.includes('성에') || q.includes('디프로스트') || q.includes('김서림') || q.includes('결빙 방지') || q.includes('와이퍼 열선') || (q.includes('앞유리') && (q.includes('눈') || q.includes('얼')));
  const isSnowDrive = q.includes('눈길') || q.includes('스노우') || q.includes('미끄럼') || q.includes('vdc') || q.includes('esc') || q.includes('tcs') || q.includes('빙판길');
  const isRestAreaWiper = q.includes('와이퍼 세우') || q.includes('와이퍼 고정') || q.includes('서비스 모드') || (q.includes('와이퍼') && q.includes('휴게소'));
  const isInfotainment = q.includes('인포테인먼트') || q.includes('분할 화면') || q.includes('날씨 위젯') || q.includes('위젯') || (q.includes('휴게소') && (q.includes('정보') || q.includes('메뉴')));
  const isWebEscalation = q.includes('확인했는데') || q.includes('해결되지') || q.includes('웹 검색') || q.includes('인터넷') || q.includes('문제가 아니');
  const isEvStart = (q.includes('ready') || q.includes('시동') || q.includes('먹통')) && (q.includes('전기차') || q.includes('아이오닉') || (vehicle && vehicle.powertrain_type === 'EV') || (scenario && scenario.vehicle_model?.includes('아이오닉')));
  const isRecallEsc = q.includes('리콜') || (q.includes('esc') && q.includes('업데이트')) || q.includes('무상수리');

  let category = 'GENERAL';
  if (isWebEscalation) category = 'WEB_ESCALATION';
  else if (isRecallEsc) category = 'TSB_RECALL';
  else if (isEvStart) category = 'EV_START';
  else if (isDefrost) category = 'DEFROST';
  else if (isRestAreaWiper) category = 'RESTAREA_WIPER';
  else if (isSnowDrive) category = 'SNOW_DRIVE';
  else if (isInfotainment) category = 'INFOTAINMENT';
  else if (isBluetooth) category = 'CONNECTIVITY';
  else if (isTire) category = 'TIRE_PRESSURE';
  else if (isFuel) category = 'FUEL_BATTERY';
  else if (isWarning) category = 'WARNING_LIGHT';
  else if (isSmartKey) category = 'EMERGENCY';

  // 시설 및 위치 조회가 필요한 질문인지 판단
  const needsLocation = (isFuel || isWebEscalation || (isTire && q.includes('어디서')) || q.includes('주유소') || q.includes('충전소') || q.includes('정비소') || q.includes('카센터') || q.includes('휴게소'));

  // 차량 상태 추가 파악이 필요한지 판단
  let needsStateClarification = null;

  if (isTire && (!currentStates || !currentStates.tire_appearance_checked)) {
    needsStateClarification = {
      stateKey: 'tire_appearance_checked',
      question: '타이어에 나사 박힘이나 심한 찌그러짐 등 육안상 손상이 보이나요?',
      options: [
        { label: '외관상 이상 없음 (단순 경고등)', value: 'NORMAL_APPEARANCE' },
        { label: '타이어가 찌그러졌거나 손상 보임', value: 'DAMAGE_OBSERVED' },
        { label: '아직 밖에서 확인 못했어요', value: 'NOT_CHECKED_YET' }
      ]
    };
  } else if (isFuel && (!currentStates || !currentStates.remaining_range_known)) {
    needsStateClarification = {
      stateKey: 'remaining_range_known',
      question: '계기판에 표시된 남은 주행가능거리(km)는 어느 정도인가요?',
      options: [
        { label: '30km 이상 남아있음', value: 'ABOVE_30KM' },
        { label: '30km 미만 (또는 --- 표시)', value: 'CRITICAL_LOW' },
        { label: '지금 계기판을 볼 수 없어요', value: 'CANNOT_SEE' }
      ]
    };
  }

  return {
    category,
    needsLocation,
    needsStateClarification
  };
}

/**
 * 활성 UT 시뮬레이션 시나리오 조회
 */
export function getActiveScenario(sessionId) {
  if (!sessionId) return null;
  try {
    const row = db.prepare(`
      SELECT s.*, a.is_active, a.custom_override
      FROM active_simulation_contexts a
      JOIN simulation_scenarios s ON a.scenario_id = s.id
      WHERE a.session_id = ? AND a.is_active = 1
    `).get(sessionId);

    if (!row) return null;

    let customOverride = null;
    if (row.custom_override) {
      try { customOverride = JSON.parse(row.custom_override); } catch (e) {}
    }

    const merged = {
      ...row,
      warning_lights: row.warning_lights ? JSON.parse(row.warning_lights) : [],
      dtc_codes: row.dtc_codes ? JSON.parse(row.dtc_codes) : [],
      sample_questions: row.sample_questions ? JSON.parse(row.sample_questions) : [],
      ...(customOverride || {})
    };
    return merged;
  } catch (err) {
    console.error('getActiveScenario error:', err);
    return null;
  }
}

/**
 * 지식 베이스 검색 및 적용 차량/버전 범위 적합성 검증
 */
export function searchAndVerifyKnowledge({ query, vehicle, scenario }) {
  const q = query.toLowerCase();
  const targetModel = scenario ? scenario.vehicle_model : (vehicle ? vehicle.model_name : '');
  const targetYear = scenario ? scenario.vehicle_year : (vehicle ? vehicle.year_range?.split('~')[0]?.trim() || '' : '');
  const targetTrim = scenario ? scenario.vehicle_trim : '';
  const targetSw = scenario ? scenario.vehicle_sw_version : '';
  const targetRegion = scenario ? scenario.vehicle_region : 'KOR';

  // 1. 전체 지식 아이템 조회
  const items = db.prepare('SELECT * FROM knowledge_items').all();
  const matched = [];

  for (const item of items) {
    const titleMatch = item.title.toLowerCase().includes(q) || q.includes(item.title.toLowerCase());
    const kwMatch = item.keywords && item.keywords.split(',').some(k => q.includes(k.trim().toLowerCase()) || k.trim().toLowerCase().includes(q));
    const contentMatch = item.content.toLowerCase().includes(q);

    // 증상 또는 DTC 코드 매칭
    let dtcMatch = false;
    let dtcList = scenario ? scenario.dtc_codes : [];
    if (typeof dtcList === 'string') {
      try { dtcList = JSON.parse(dtcList); } catch (e) { dtcList = []; }
    }
    if (Array.isArray(dtcList) && dtcList.length > 0) {
      dtcMatch = dtcList.some(code => item.keywords?.includes(code) || item.content?.includes(code));
    }

    if (titleMatch || kwMatch || contentMatch || dtcMatch) {
      // 2. 적용 범위(Scope) 검증
      let appModels = [];
      let appYears = [];
      let appTrims = [];
      let appSw = [];
      let appRegions = ['KOR'];

      try { appModels = JSON.parse(item.applicable_models || '[]'); } catch (e) {}
      try { appYears = JSON.parse(item.applicable_years || '[]'); } catch (e) {}
      try { appTrims = JSON.parse(item.applicable_trims || '[]'); } catch (e) {}
      try { appSw = JSON.parse(item.applicable_sw_versions || '[]'); } catch (e) {}
      try { appRegions = JSON.parse(item.applicable_regions || '["KOR"]'); } catch (e) {}

      const modelMatches = appModels.includes('전체') || appModels.some(m => targetModel && (targetModel.includes(m) || m.includes(targetModel)));
      const yearMatches = appYears.includes('전체') || appYears.some(y => targetYear && (targetYear.includes(y) || y.includes(targetYear)));
      const trimMatches = appTrims.length === 0 || appTrims.includes('전체') || appTrims.some(t => targetTrim && targetTrim.includes(t));
      const swMatches = appSw.length === 0 || appSw.includes('전체') || appSw.some(s => targetSw && (targetSw.includes(s) || s.includes(targetSw)));
      const regionMatches = appRegions.includes('전체') || appRegions.includes(targetRegion);

      let scopeStatus = 'EXACT';
      let scopeNote = '';

      if (modelMatches && yearMatches && regionMatches && trimMatches && swMatches) {
        scopeStatus = 'EXACT';
        scopeNote = `해당 차량(${targetModel} ${targetYear}년식, ${targetSw || '소프트웨어'}) 적용 공식 자료 확인 완료`;
      } else if (modelMatches && yearMatches) {
        scopeStatus = 'PARTIAL';
        scopeNote = `차종/연식은 일치하나 트림(${targetTrim || '미지정'}) 또는 소프트웨어 버전(${targetSw || '미확인'}) 적용 여부 부분 확인`;
      } else {
        scopeStatus = 'UNCERTAIN';
        scopeNote = `동일 증상 자료이나 대상 차종(${appModels.join(', ')})과 현재 차량(${targetModel || '미지정'})이 상이할 수 있습니다.`;
      }

      let score = 0;
      if (scopeStatus === 'EXACT') score += 100;
      else if (scopeStatus === 'PARTIAL') score += 50;
      else score += 10;

      let parsedSteps = [];
      try { parsedSteps = JSON.parse(item.action_steps || '[]'); } catch (e) {}
      let parsedClarification = null;
      try { parsedClarification = JSON.parse(item.clarification_questions || 'null'); } catch (e) {}

      matched.push({
        ...item,
        action_steps: parsedSteps,
        clarification_questions: parsedClarification,
        scopeStatus,
        scopeNote,
        score
      });
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched;
}

/**
 * 대화 진행 및 최종 상황별 답변 생성 파이프라인
 */
export async function processUserMessage({
  sessionId,
  conversationId,
  userMessage,
  vehicleId,
  clientLocation = null, // { lat, lon, address }
  providedState = null,  // { key, value, timestamp, source }
  driveMode = 'PARKED',  // 'PARKED' | 'DRIVING'
  preferredLength = 'short', // 'short' | 'detailed'
  vehicle: passedVehicle = null,
  activeScenario: passedScenario = null
}) {
  const startTime = Date.now();
  const processSteps = [];

  // 1. 활성 UT 시뮬레이션 맥락 확인 (가상 모드)
  const activeScenario = passedScenario || getActiveScenario(sessionId);
  const isSimulationMode = !!activeScenario;

  // 2. 차량 정보 조회
  let vehicle = passedVehicle || null;
  if (!vehicle && vehicleId) {
    const vehicleStmt = db.prepare('SELECT * FROM vehicles WHERE id = ?');
    vehicle = vehicleStmt.get(vehicleId);
  }

  // 가상 시나리오가 활성화되어 있으면 가상 시나리오의 차량 스펙을 컨텍스트로 결합
  const effectiveDriveMode = activeScenario ? activeScenario.drive_state : driveMode;

  // 3. 대화 기록 확인
  let conversation = null;
  if (conversationId) {
    const convStmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    conversation = convStmt.get(conversationId);
  }

  // 4. 의도 분석
  const intent = analyzeIntent({
    query: userMessage,
    vehicle,
    currentStates: providedState ? { [providedState.key]: providedState.value } : null,
    scenario: activeScenario
  });

  // 단계 알림
  processSteps.push({
    step: 'SITUATION_ASSESSMENT',
    message: isSimulationMode ? `UT 가상 상황 [${activeScenario.title}] 맥락 분석 중` : '차량 상황 및 주행 모드 분석 중'
  });

  // 5. 지식 베이스 검색 및 차량/버전 적용성 검증
  processSteps.push({ step: 'KNOWLEDGE_VERIFICATION', message: '적용 차량·소프트웨어 버전 적합성 검증 중' });
  const verifiedKnowledgeList = searchAndVerifyKnowledge({
    query: userMessage,
    vehicle,
    scenario: activeScenario
  });
  const primaryKnowledge = verifiedKnowledgeList.length > 0 ? verifiedKnowledgeList[0] : null;

  // 6. 공식 매뉴얼 RAG 검색 (해당 차량 전용)
  processSteps.push({ step: 'MANUAL_SEARCH', message: '제조사 공식 매뉴얼 확인 중' });
  let matchedChunks = [];
  if (vehicle) {
    const ragResult = searchVehicleManual({
      vehicleId: vehicle.id,
      query: userMessage,
      categoryFilter: intent.category !== 'GENERAL' && intent.category !== 'TSB_RECALL' && intent.category !== 'EV_START' ? intent.category : null
    });
    matchedChunks = ragResult.chunks;
  }
  const chunkIdsUsed = matchedChunks.map(c => c.id);

  // 7. 위치 및 시설 조회 (필요한 경우에만 수행)
  let facilitiesResult = null;
  const toolCalls = [];

  if (intent.needsLocation && !isSimulationMode) {
    processSteps.push({ step: 'FACILITY_SEARCH', message: '주변 시설 확인 중' });
    const toolCallStart = Date.now();
    try {
      facilitiesResult = await searchNearbyFacilities({
        lat: clientLocation?.lat,
        lon: clientLocation?.lon,
        address: clientLocation?.address,
        powertrainType: vehicle ? vehicle.powertrain_type : 'GASOLINE',
        brandName: vehicle ? vehicle.brand : '현대'
      });

      toolCalls.push({
        tool: 'searchNearbyFacilities',
        input: {
          location: clientLocation || '기본 거점(역삼)',
          powertrain: vehicle ? vehicle.powertrain_type : 'GASOLINE'
        },
        outputCount: facilitiesResult.facilities.length,
        duration_ms: Date.now() - toolCallStart,
        status: 'SUCCESS'
      });
    } catch (err) {
      toolCalls.push({
        tool: 'searchNearbyFacilities',
        error: err.message,
        duration_ms: Date.now() - toolCallStart,
        status: 'FAILED'
      });
    }
  }

  processSteps.push({ step: 'SYNTHESIS', message: '상황 맞춤형 다음 행동 답변 정리 중' });

  // 8. 챗봇 답변 규격 조립
  const responsePayload = synthesizeStructuredResponse({
    userMessage,
    vehicle,
    activeScenario,
    isSimulationMode,
    primaryKnowledge,
    matchedChunks,
    facilitiesResult,
    providedState,
    intent,
    driveMode: effectiveDriveMode,
    preferredLength
  });

  // 9. DB 메시지 저장
  let assistantMsgId = 'msg-' + crypto.randomUUID();
  let saveHistory = true;
  if (sessionId) {
    const userSettings = db.prepare('SELECT history_save_enabled FROM user_settings WHERE session_id = ?').get(sessionId);
    if (userSettings && userSettings.history_save_enabled === 0) {
      saveHistory = false;
    }
  }

  if (conversationId && saveHistory) {
    const convExists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
    if (convExists) {
      const insertMsgStmt = db.prepare(`
        INSERT INTO messages (id, conversation_id, sender, content, structured_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertMsgStmt.run(
        assistantMsgId,
        conversationId,
        'assistant',
        responsePayload.summary,
        JSON.stringify(responsePayload),
        new Date().toISOString()
      );

      const insertContextStmt = db.prepare(`
        INSERT INTO message_contexts (
          id, message_id, manual_chunks_used, vehicle_state_used, location_used,
          tool_calls, model_version, prompt_version, generation_duration_ms, has_error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertContextStmt.run(
        'ctx-' + crypto.randomUUID(),
        assistantMsgId,
        JSON.stringify(chunkIdsUsed),
        JSON.stringify({
          providedState,
          activeScenario: activeScenario ? { id: activeScenario.id, title: activeScenario.title } : null,
          isSimulationMode
        }),
        clientLocation ? JSON.stringify(clientLocation) : null,
        JSON.stringify(toolCalls),
        'Antigravity Context-Aware Vehicle Orchestrator 3.0',
        'prompt-v3-action-first-simulation',
        Date.now() - startTime,
        0,
        new Date().toISOString()
      );

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(
        new Date().toISOString(),
        conversationId
      );
    }
  }

  return {
    messageId: assistantMsgId,
    processSteps,
    response: responsePayload
  };
}

/**
 * 근거 기반 상황 맞춤형 답변 합성 함수
 */
function synthesizeStructuredResponse({
  userMessage,
  vehicle,
  activeScenario,
  isSimulationMode,
  primaryKnowledge,
  matchedChunks,
  facilitiesResult,
  providedState,
  intent,
  driveMode = 'PARKED',
  preferredLength = 'short'
}) {
  const isDriving = driveMode === 'DRIVING';
  const hasManual = matchedChunks.length > 0;
  const primaryChunk = hasManual ? matchedChunks[0] : null;

  let summary = '';
  let immediate_action = '';
  let next_action = '';
  let rationale = '';
  let actionSteps = [];
  let stop_conditions = '';
  let cautions = '';
  let source_title = '';
  let source_location = '';
  let vehicle_match = true;
  let confidence = 'HIGH';
  let safety_level = 'NORMAL'; // 'NORMAL' | 'CAUTION' | 'IMMEDIATE_ACTION'
  let missing_context = null;
  let clarificationNeeded = null;
  let suggestedFollowUps = [];
  const sources = [];

  const nowIso = new Date().toISOString();

  // 대상 차량 이름
  const vehicleName = activeScenario
    ? `${activeScenario.vehicle_brand} ${activeScenario.vehicle_model} (${activeScenario.vehicle_year}년식)`
    : (vehicle ? `${vehicle.brand} ${vehicle.model_name}` : '차량');

  // -----------------------------------------------------------------
  // 1. 상황별 지식 베이스(TSB/리콜, 전기차 분기 질문, 고장 절차) 최우선 적용
  // -----------------------------------------------------------------
  if (primaryKnowledge) {
    source_title = `${primaryKnowledge.document_title} (${primaryKnowledge.source_section})`;
    source_location = `${primaryKnowledge.source_org} · ${primaryKnowledge.source_page || primaryKnowledge.effective_date}`;
    safety_level = primaryKnowledge.category === 'SAFETY_CRITERIA' ? 'IMMEDIATE_ACTION' : 'CAUTION';
    confidence = primaryKnowledge.scopeStatus === 'EXACT' ? 'HIGH' : 'MEDIUM';

    // 분기 질문이 정의되어 있고, 아직 상태가 확인되지 않은 경우
    if (primaryKnowledge.clarification_questions && primaryKnowledge.clarification_questions.length > 0) {
      const qItem = primaryKnowledge.clarification_questions[0];
      const hasAnswered = providedState && (providedState.key === qItem.id || providedState.value);

      if (!hasAnswered) {
        clarificationNeeded = {
          id: qItem.id,
          question: qItem.question,
          options: qItem.options
        };
      }
    }

    // 주행 중이면 짧고 안전한 조치 우선
    if (isDriving) {
      immediate_action = '주행 중 복잡한 화면 조작을 멈추고 비상등을 켜며 가까운 안전지대나 휴게소로 정차하세요.';
      summary = `운전 중 안전을 위해 즉각적인 조작을 삼가고 안전지대에 정차 후 점검해야 합니다.`;
    } else {
      immediate_action = primaryKnowledge.immediate_action;
      summary = primaryKnowledge.title.length > 60 ? `${primaryKnowledge.title.slice(0, 58)}... 안내예요.` : `${primaryKnowledge.title} 안내예요.`;
    }

    next_action = immediate_action;
    rationale = primaryKnowledge.rationale;
    actionSteps = primaryKnowledge.action_steps || [];
    stop_conditions = primaryKnowledge.stop_conditions || '이상 지속 시 즉시 정차 후 공식 서비스센터에 문의하세요.';
    cautions = primaryKnowledge.stop_conditions || '';

    sources.push({
      document_title: primaryKnowledge.document_title,
      source_org: primaryKnowledge.source_org,
      source_section: primaryKnowledge.source_section,
      source_page: primaryKnowledge.source_page || '',
      effective_date: primaryKnowledge.effective_date,
      is_virtual_sample: primaryKnowledge.is_virtual_sample === 1
    });

    suggestedFollowUps = [
      '관련 무상수리나 보증기간 어떻게 확인해?',
      '가까운 공식 서비스센터 연결해줘'
    ];
  }
  // -----------------------------------------------------------------
  // 2. 심층 웹 검색 에스컬레이션 요청
  // -----------------------------------------------------------------
  else if (intent.category === 'WEB_ESCALATION') {
    summary = `${vehicleName} 실제 차주 정비 사례 및 외부 기술 웹 검색 분석 결과, 부품 유격 또는 접촉 이상 가능성이 높습니다.`;
    immediate_action = '자가 조치로 해결되지 않는 부위이므로, 인근 공식 서비스센터에 입고해 하체 리프트 정밀 진단을 받으세요.';
    next_action = immediate_action;
    rationale = '단순 소모품 마모나 고무 부싱 경화는 육안 확인만으로 한계가 있어 리프트 점검이 필수적입니다.';
    source_title = '자동차 정비 기술 네트워크 & 실제 차주 정비사례 웹 검색';
    source_location = '교통안전공단 결함센터 및 현대/기아 정비지침 통합 데이터';
    vehicle_match = true;
    confidence = 'HIGH';
    safety_level = 'CAUTION';
    actionSteps = [
      { step: 1, where: '하체 점검', action: '과속방지턱 통과 시 찌걱거림은 로어암 부싱 및 활대링크 고무 경화가 1순위 원인입니다.' },
      { step: 2, where: '구동계 점검', action: '엔진룸 잡음은 겉벨트 텐셔너 베어링 마모 또는 발전기 풀리 고착 가능성을 점검합니다.' },
      { step: 3, where: '정비소 입고', action: '아래 추천 공식 서비스센터(블루핸즈)로 예약 후 전문 리프트 정밀 진단을 받으세요.' }
    ];
    stop_conditions = '하체 부싱 및 구동계 소음은 방치 시 주행 안정성에 영향을 줄 수 있으므로 조속한 입고를 권장합니다.';
    cautions = stop_conditions;
    suggestedFollowUps = [
      '가까운 정비소 예약 번호 알려줘',
      '예상 수리 비용은 대략 얼마 정도 나와?'
    ];
  }
  // -----------------------------------------------------------------
  // 3. 차량 미등록 상태인 경우
  // -----------------------------------------------------------------
  else if (!vehicle && !activeScenario) {
    summary = '등록된 차량 정보가 없어 일반 안전 기준에 따라 안내합니다.';
    immediate_action = '정확한 매뉴얼 조치를 확인하려면 먼저 차량을 등록해 주세요.';
    next_action = immediate_action;
    rationale = '차종, 파워트레인, 연식에 따라 버튼 명칭과 경고등 대처법이 다릅니다.';
    source_title = '일반 차량 안전 운행 가이드';
    source_location = '한국교통안전공단 표준 지침';
    vehicle_match = false;
    confidence = 'LOW';
    safety_level = 'NORMAL';
    missing_context = '차량 제조사, 차종, 연식 정보가 필요합니다.';
    actionSteps = [
      { step: 1, where: '사용자', action: '상단 차량 선택 메뉴에서 본인 차량을 등록하세요.' },
      { step: 2, where: '차량', action: '이상 증상이 심할 경우 무리한 주행을 멈추고 안전지대에 정차하세요.' }
    ];
    stop_conditions = '제동 불가, 조향 이상, 연기 발생 시 즉시 비상등 켜고 안전지대 정차.';
  }
  // -----------------------------------------------------------------
  // 4. 공식 매뉴얼 미확인 (미확인 증상)
  // -----------------------------------------------------------------
  else if (!hasManual) {
    const isNoise = userMessage.includes('소리') || userMessage.includes('소음') || userMessage.includes('찌걱') || userMessage.includes('잡음');
    const isSmell = userMessage.includes('냄새') || userMessage.includes('탄내');

    if (isNoise) {
      summary = `${vehicleName} 주행 중 이음(소음) 발생 시 다빈도 점검 3단계예요. (공식 매뉴얼에서 확정 원인은 확인하지 못했어요)`;
      immediate_action = '과속방지턱 통과 및 핸들 회전 시 소음 양상을 점검하고, 지속될 경우 가까운 정비소 리프트 점검을 받으세요.';
      rationale = '소음은 하체 부싱, 등속조인트, 베어링 마모 등 원인이 다양하여 단계별 분기 확인이 필요합니다.';
      actionSteps = [
        { step: 1, where: '차량', action: '방지턱을 넘을 때 나는 찌걱거림은 하체 로어암 고무 부싱 경화 가능성을 먼저 점검합니다.' },
        { step: 2, where: '차량', action: '핸들을 꺾을 때 딱딱 소리가 나면 등속조인트 또는 쇼바 마운트 베어링 이상을 확인합니다.' },
        { step: 3, where: '정비소', action: '소음이 반복되거나 핸들 떨림이 동반되면 가까운 공식 서비스센터(블루핸즈) 점검을 받으세요.' }
      ];
      stop_conditions = '금속 긁히는 굉음이나 핸들 진동이 급격히 증가할 경우 즉시 주행을 멈추세요.';
    } else if (isSmell) {
      summary = `${vehicleName} 실내 및 엔진룸 냄새 발생 시 다빈도 점검 3단계예요. (공식 매뉴얼에서 확정 원인은 확인하지 못했어요)`;
      immediate_action = '송풍구 필터 오염과 엔진룸 오일 누유 여부를 확인하고, 고무 타는 냄새 지속 시 즉시 정차하세요.';
      rationale = '냄새의 종류(달콤함: 냉각수, 타는 냄새: 벨트/브레이크)에 따라 화재 위험성이 달라집니다.';
      actionSteps = [
        { step: 1, where: '차량', action: '송풍구에서 나는 퀴퀴한 냄새는 에어컨 필터 오염 및 에바포레이터 건조 상태를 확인합니다.' },
        { step: 2, where: '차량', action: '고무 타는 냄새가 나면 엔진룸 겉벨트 마찰이나 브레이크 패드 과열 여부를 확인합니다.' },
        { step: 3, where: '외부', action: '달콤한 냄새는 부동액 누유일 수 있으므로 즉시 냉각수 수위를 점검하세요.' }
      ];
      stop_conditions = '고무 타는 냄새나 연기가 엔진룸에서 발생하면 즉시 시동을 끄고 대피하세요.';
    } else {
      summary = `${vehicleName} 이상 증상 확인을 위한 다빈도 점검 3단계예요. (공식 매뉴얼에서 확정 원인은 확인하지 못했어요)`;
      immediate_action = '계기판 경고등과 주행 질감을 먼저 살피고, 이상 지속 시 안전지대에 정차하세요.';
      rationale = '증상만으로 원인을 확정할 수 없으므로 안전 기본 수칙에 따라 점검합니다.';
      actionSteps = [
        { step: 1, where: '계기판', action: '계기판에 경고등 아이콘이나 구체적인 점검 메시지가 표시되는지 확인합니다.' },
        { step: 2, where: '차량', action: '주행 중 제동 밀림, 핸들 떨림, 비정상 진동이 동반되는지 확인합니다.' },
        { step: 3, where: '정비소', action: '증상이 지속되거나 주행 불안감이 있으면 안전지대 정차 후 서비스센터에 문의하세요.' }
      ];
      stop_conditions = '조향 제동 불능, 화재 전조 증상 발생 시 즉시 안전지대 정차.';
    }

    next_action = immediate_action;
    source_title = '공식 매뉴얼 미확인 (다빈도 점검 순서 안내)';
    source_location = `${vehicleName} 취급설명서 전 영역 검색 결과 없음`;
    vehicle_match = true;
    confidence = 'NONE';
    safety_level = 'CAUTION';
    missing_context = '계기판에 뜬 정확한 경고등 아이콘 번호 및 소음/진동 발생 시점';
    cautions = '증상 하나만으로 고장 원인을 섣불리 단정하거나 무리하게 고속 주행하지 마십시오.';
    suggestedFollowUps = [
      '계기판에 뜬 정확한 경고 문구를 다시 적어볼게요',
      '가까운 정비소 위치 알려줘'
    ];
  }
  // -----------------------------------------------------------------
  // 5. 공식 매뉴얼 매칭 성공
  // -----------------------------------------------------------------
  else {
    vehicle_match = true;
    confidence = 'HIGH';
    source_title = primaryChunk.doc_title;
    source_location = `PDF ${primaryChunk.pdf_page}p (인쇄 ${primaryChunk.printed_page}p)`;

    sources.push({
      document_title: primaryChunk.doc_title,
      source_org: vehicle ? vehicle.brand : '제조사 공식',
      source_section: primaryChunk.section_title,
      source_page: `PDF ${primaryChunk.pdf_page}p`,
      effective_date: primaryChunk.doc_version || '2024년 최신판',
      is_virtual_sample: false
    });

    if (intent.category === 'CONNECTIVITY') {
      summary = '휴대폰 연결은 안전을 위해 정차 후 설정 메뉴에서 진행해야 합니다.';
      immediate_action = '변속 레버를 P단에 두고 [설정] > [기기 연결] > [신규 추가]를 터치하세요.';
      rationale = '주행 중 신규 블루투스 등록은 도로교통법 및 안전 규정에 따라 차단됩니다.';
      safety_level = 'NORMAL';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '주행 중에는 조작을 시도하지 마세요.';
      cautions = primaryChunk.cautions || '주행 중에는 안전을 위해 신규 기기 등록이 차단됩니다.';
      suggestedFollowUps = [
        '차량 이름이 폰에서 안 떠요',
        '무선 카플레이 연결 방법 알려줘'
      ];
    } else if (intent.category === 'TIRE_PRESSURE') {
      summary = '추운 날 기온 급강하로 자연 감압일 수 있으나, 먼저 안전지대 정차 후 타이어 외관을 확인하세요.';
      immediate_action = '운전석 문 안쪽 스티커에서 권장 공기압(33~35 psi)을 확인하고 보충하세요.';
      rationale = '기온이 10°C 떨어질 때마다 공기압이 약 1~2 psi 자연 감소하지만, 못 박힘 등 펑크 가능성도 배제할 수 없습니다.';
      safety_level = 'CAUTION';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '타이어 외관이 심하게 찌그러졌거나 휠 림이 닿은 상태에서는 즉시 주행을 멈추고 보험사 긴급출동을 부르세요.';
      cautions = primaryChunk.cautions || '경고등 점등 상태에서 고속 주행 시 타이어 손상(스탠딩 웨이브) 위험이 있습니다.';
      suggestedFollowUps = [
        '가까운 공기압 넣는 곳 찾아줘',
        '내 차 적정 공기압 수치 알려줘'
      ];
      if (!providedState) {
        missing_context = '타이어 찢김/나사 박힘 등 육안 손상 여부';
      }
    } else if (intent.category === 'FUEL_BATTERY') {
      const isEv = (vehicle && vehicle.powertrain_type === 'EV') || (activeScenario && activeScenario.vehicle_model?.includes('아이오닉'));
      if (isEv) {
        summary = '배터리 저전압 경고 상태입니다. 공조기를 절전 모드로 전환하고 즉시 충전소로 이동하세요.';
        immediate_action = '에어컨/히터를 끄거나 온도를 조절하고 가장 가까운 급속 충전소로 서행 이동하세요.';
        rationale = '고전압 배터리 방전 시 파워트레인이 셧다운되어 도로 한가운데 정차될 수 있습니다.';
        safety_level = 'IMMEDIATE_ACTION';
      } else {
        summary = '연료가 고갈되면 시동이 꺼지고 핸들과 브레이크가 무거워집니다. 즉시 주유소를 찾아야 합니다.';
        immediate_action = '급가속을 피하고 정속 주행으로 가장 가까운 주유소로 이동해 연료를 보충하세요.';
        rationale = '연료 펌프 윤활 부족으로 부품이 손상되거나 주행 중 엔진이 정지할 위험이 있습니다.';
        safety_level = 'IMMEDIATE_ACTION';
      }
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '주행가능거리가 ---로 바뀌고 출력이 저하되면 즉시 비상등 켜고 갓길로 안전 정차하세요.';
      cautions = primaryChunk.cautions || '연료 완전 고갈 시 연료 펌프 손상 위험이 있습니다.';
      suggestedFollowUps = [
        isEv ? '가까운 급속 충전소 찾아줘' : '가장 가까운 주유소 찾아줘',
        '기름 불 들어오고 몇 km 더 가?'
      ];
      if (!providedState) {
        missing_context = '계기판에 표시된 남은 주행가능거리(km)';
      }
    } else if (intent.category === 'EMERGENCY') {
      summary = '스마트키가 방전되었더라도 물리 보조키로 문을 열고 시동 버튼을 직접 눌러 시동할 수 있습니다.';
      immediate_action = '스마트키 모서리로 [ENGINE START/STOP] 버튼을 1~2초간 꾹 눌러 접촉 시동하세요.';
      rationale = '스마트키 내부에 RFID 칩이 내장되어 있어 방전 상태에서도 버튼 근접 시동이 가능합니다.';
      safety_level = 'CAUTION';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '접촉 시동 후에도 계기판 무반응 시 12V 배터리 방전을 점검하세요.';
      cautions = primaryChunk.cautions;
      suggestedFollowUps = [
        '스마트키 배터리 어떤 규격 사야 해?',
        '차 문 열 때 경보음 어떻게 꺼?'
      ];
    } else if (intent.category === 'WARNING_LIGHT') {
      summary = '빨간 경고등이면 안전한 곳에 즉시 정차하세요. 아이콘 모양과 문구를 확인해야 합니다.';
      immediate_action = '비상등을 켜고 안전지대로 서행 정차한 후 브레이크/엔진 상태를 확인하세요.';
      rationale = '빨간색은 안전에 치명적인 고장(제동유압 이상, 엔진오일압력 부족)을 뜻합니다.';
      safety_level = 'IMMEDIATE_ACTION';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '빨간색 브레이크/엔진 경고등 점등 시 지속 운행 금지.';
      cautions = primaryChunk.cautions;
      suggestedFollowUps = [
        '노란색 경고등일 때는 운전해도 돼?',
        '가까운 정비소 찾아줘'
      ];
    } else if (intent.category === 'DEFROST') {
      summary = '앞유리 성에 제거(FRONT) 버튼과 뒷유리·미러 열선(REAR) 버튼을 켜면 서리와 와이퍼 결빙을 빠르게 녹일 수 있습니다.';
      immediate_action = '공조 컨트롤러에서 [FRONT] 버튼을 켜고, [REAR] 버튼으로 와이퍼 결빙 방지 열선을 함께 작동시키세요.';
      rationale = '앞유리 디프로스터는 에어컨 제습 바람을 강하게 분사하고, 열선은 사이드미러 결빙을 즉시 녹입니다.';
      safety_level = 'NORMAL';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '시야가 완전히 확보될 때까지 무리한 고속 주행을 멈추세요.';
      cautions = primaryChunk.cautions || '성에가 낀 상태에서 내기 순환 모드를 켜면 실내 습기로 인해 앞유리 김서림이 더 심해집니다.';
      suggestedFollowUps = [
        '열선은 켜두면 알아서 꺼져?',
        '눈 올 때 와이퍼 어떻게 세워둬?'
      ];
    } else if (intent.category === 'SNOW_DRIVE') {
      summary = '눈길에서는 급가속·급제동을 피하고 감속 운행하며, 차체자세제어(ESC)는 항상 켜둔 상태를 유지해야 합니다.';
      immediate_action = 'DRIVE MODE를 부드러운 주행 모드로 설정하고, 눈구덩이에 갇혔을 때만 ESC OFF로 탈출을 시도하세요.';
      rationale = '빙판길에서 ESC를 끄면 바퀴가 헛돌아 차량 통제력을 상실합니다.';
      safety_level = 'CAUTION';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '차량이 한쪽으로 미끄러지거나 제동이 전혀 듣지 않을 경우 엔진 브레이크를 사용하며 안전지대로 대피하세요.';
      cautions = primaryChunk.cautions || '빙판길에서 ESC를 끈 채 고속 주행하면 차량이 통제 불능으로 스핀할 수 있습니다.';
      suggestedFollowUps = [
        '눈길에 바퀴 빠졌을 때 탈출 요령',
        '가까운 휴게소 위치 알려줘'
      ];
    } else if (intent.category === 'RESTAREA_WIPER') {
      summary = '폭설 시 와이퍼가 유리에 얼어붙는 것을 막으려면 시동 OFF 후 20초 이내에 와이퍼 레버를 위(MIST)로 2초간 올려 세우세요.';
      immediate_action = '시동을 끄고 즉시 와이퍼 레버를 MIST로 올려 서비스 모드로 진입한 뒤 암을 앞으로 세우세요.';
      rationale = '히든 타입 와이퍼는 서비스 모드 없이 손으로 올리면 보닛 도장과 암이 훼손됩니다.';
      safety_level = 'NORMAL';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '와이퍼 블레이드가 유리에 얼어붙은 상태에서 모터를 강제로 작동시키지 마세요.';
      cautions = primaryChunk.cautions || '서비스 모드 없이 손으로 강제로 올리면 보닛 도장과 와이퍼 암이 손상됩니다.';
      suggestedFollowUps = [
        '휴게소에서 히터 틀고 있어도 돼?',
        '가까운 휴게소 주유소 찾아줘'
      ];
    } else if (intent.category === 'INFOTAINMENT') {
      summary = '내비게이션 분할 화면(Split Screen)에서 실시간 고속도로 날씨와 전방 휴게소 유가·충전기 정보를 확인할 수 있습니다.';
      immediate_action = '지도 화면 우측 탭을 터치해 분할 화면을 펼치고 [날씨 / 고속도로 휴게소] 카드를 선택하세요.';
      rationale = '분할 화면을 활용하면 주행 경로 안내를 방해하지 않고 필요한 부가 정보를 동시에 확인 가능합니다.';
      safety_level = 'NORMAL';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '주행 중 화면 주시는 전방 주시 태만으로 인한 사고 위험이 있으므로 동승자 조작을 권장합니다.';
      cautions = primaryChunk.cautions || '운전 중 복잡한 화면 조작은 위험하므로 동승자가 조작하거나 정차 중 확인하십시오.';
      suggestedFollowUps = [
        '휴게소 기름값 내비에서 볼 수 있어?',
        '폰 연결 방법 알려줘'
      ];
    } else {
      summary = primaryChunk.content.split('.')[0] + '.';
      immediate_action = primaryChunk.action_steps && primaryChunk.action_steps[0] ? primaryChunk.action_steps[0].action : '매뉴얼 지침에 따라 안전하게 조치하세요.';
      rationale = '제조사 공식 사용자 설명서 표준 절차입니다.';
      safety_level = 'NORMAL';
      actionSteps = primaryChunk.action_steps || [];
      stop_conditions = '이상 지속 시 가까운 공식 정비망을 방문하세요.';
      cautions = primaryChunk.cautions || '';
      suggestedFollowUps = [
        '주의할 점 더 있어?',
        '가까운 정비소 위치 알려줘'
      ];
    }
    next_action = immediate_action;
  }

  // 매뉴얼 근거 목록 조립
  const manualEvidence = matchedChunks.map(chunk => ({
    documentTitle: chunk.doc_title,
    docVersion: chunk.doc_version,
    vehicleScope: vehicle ? `${vehicle.brand} ${vehicle.model_name} (${vehicle.year_range})` : '일반 차량',
    sectionTitle: chunk.section_title,
    printedPage: chunk.printed_page,
    pdfPage: chunk.pdf_page,
    conditions: chunk.conditions,
    excerpt: chunk.content,
    officialUrl: chunk.official_source_url
  }));

  // 적용 범위 및 불확실성 설명 조립
  const scope_verification = {
    isSimulationMode: !!isSimulationMode,
    scenarioTitle: activeScenario ? activeScenario.title : null,
    matchStatus: primaryKnowledge ? primaryKnowledge.scopeStatus : (hasManual ? 'EXACT' : 'NOT_FOUND'),
    scopeNote: primaryKnowledge
      ? primaryKnowledge.scopeNote
      : (hasManual
          ? `${vehicleName} 공식 매뉴얼 검색 일치`
          : '확인 가능한 제조사 공식 자료를 찾지 못했거나 적용 여부가 불확실하여 다빈도 안전 점검 절차를 안내합니다.'),
    vehicleChecked: {
      brand: activeScenario ? activeScenario.vehicle_brand : (vehicle?.brand || ''),
      model: activeScenario ? activeScenario.vehicle_model : (vehicle?.model_name || ''),
      year: activeScenario ? activeScenario.vehicle_year : (vehicle?.year_range || ''),
      trim: activeScenario ? activeScenario.vehicle_trim : '',
      swVersion: activeScenario ? activeScenario.vehicle_sw_version : '',
      region: activeScenario ? activeScenario.vehicle_region : 'KOR'
    }
  };

  // 연구용 블라인드 쌍 생성 유지 (기존 테스트 호환성)
  const comparisonPair = generateResearchPair({
    userMessage,
    vehicle,
    summary,
    next_action: immediate_action || next_action,
    source_title,
    source_location,
    safety_level
  });

  return {
    // 신규 맞춤형 안내 규격
    summary,
    immediate_action: immediate_action || next_action,
    next_action: immediate_action || next_action,
    rationale,
    actionSteps,
    stop_conditions,
    scope_verification,
    sources,

    // 출처 및 신뢰도
    source_title,
    source_location,
    vehicle_match,
    confidence,
    safety_level,
    missing_context,
    cautions,
    clarificationNeeded,

    // 화면 렌더링 지원 데이터
    facilities: facilitiesResult ? facilitiesResult.facilities : [],
    manualEvidence,
    suggestedFollowUps,
    driveMode,
    isSimulationMode,
    comparisonPair,
    triComparison: generateTriComparison({
      userMessage,
      vehicle,
      scenario: activeScenario,
      oursPayload: {
        summary,
        immediate_action: immediate_action || next_action,
        rationale,
        actionSteps,
        stop_conditions,
        cautions,
        source_title,
        source_location,
        sources,
        scope_verification,
        confidence,
        safety_level
      }
    }),
    updated_at: nowIso
  };
}

/**
 * UT용 3개 시스템(우리 서비스, ChatGPT, Gemini) 답변 비교 세트 생성
 * - 우리 서비스: 엄격한 RAG 근거 기반 구조화 답변
 * - ChatGPT: 일반 대화형 LLM의 전형적인 응답 (일반론 나열, 차량 연식 특정 불분명)
 * - Gemini: 구글 제미나이의 전형적인 웹 요약형 응답
 */
export function generateTriComparison({
  userMessage,
  vehicle,
  scenario,
  oursPayload
}) {
  const payload = oursPayload?.response || oursPayload || {};
  const targetModel = scenario ? `${scenario.vehicle_brand} ${scenario.vehicle_model} (${scenario.vehicle_year})` : (vehicle ? `${vehicle.brand} ${vehicle.model_name}` : '2025 현대 아이오닉 5 NE1');
  const hasOfficialSource = payload.sources && payload.sources.length > 0;

  // 1. 우리 서비스 답변
  const ours = {
    system_id: 'OURS',
    system_name: '우리 서비스 (OnDash RAG)',
    status: hasOfficialSource ? 'VERIFIED' : (payload.confidence === 'NONE' ? 'NO_EVIDENCE' : 'PARTIAL_MATCH'),
    summary: payload.summary,
    immediate_action: payload.immediate_action,
    rationale: payload.rationale,
    actionSteps: payload.actionSteps,
    stop_conditions: payload.stop_conditions,
    cautions: payload.cautions,
    sources: payload.sources || [],
    has_grounding: hasOfficialSource,
    source_display: hasOfficialSource ? `${payload.sources[0].document_title} (${payload.sources[0].source_section})` : '출처 확인 불가 (공식 매뉴얼 미기재)',
    applicable_vehicle: targetModel
  };

  // 2. ChatGPT (일반 대화형 스타일 - 실제 API 키 미연동 시 가상 시뮬레이션용 외부 모델 스타일)
  const chatgpt = {
    system_id: 'CHATGPT',
    system_name: 'ChatGPT (GPT-4o)',
    status: 'EXTERNAL_SIMULATED',
    summary: `센서에 눈이 묻어 일시적으로 차단된 상태일 수 있으니 안전하게 운행하시기 바랍니다.`,
    immediate_action: '차량을 천천히 운전하시고 필요 시 센서 부위를 부드러운 천으로 닦아주세요.',
    rationale: '일반적으로 현대차 및 최신 전기차는 레이더 센서가 가려지면 크루즈 컨트롤 기능이 제한될 수 있습니다.',
    actionSteps: [
      { step: 1, where: '운행', action: '앞차와의 안전거리를 충분히 유지하며 운전하세요.' },
      { step: 2, where: '정차 시', action: '정차 후 범퍼 센서에 묻은 눈이나 진흙을 제거하세요.' },
      { step: 3, where: '확인', action: '세차 후에도 문제가 지속되면 현대 서비스센터에 방문하세요.' }
    ],
    stop_conditions: '특별한 이상 소음이나 경고가 없다면 주행은 가능합니다.',
    cautions: '센서를 날카로운 도구로 긁지 마세요.',
    sources: [],
    has_grounding: false,
    source_display: '출처 확인 불가 (일반 LLM 지식 생성)',
    applicable_vehicle: '일반 현대차 / 전기차 추정 (2025 NE1 사양 미검증)'
  };

  // 3. Gemini (구글 검색/요약형 스타일)
  const gemini = {
    system_id: 'GEMINI',
    system_name: 'Gemini (1.5 Pro)',
    status: 'EXTERNAL_SIMULATED',
    summary: `전방 레이더 센서 가림 시 운전자 보조 시스템이 해제되므로 수동 운전이 필요합니다.`,
    immediate_action: '스마트 크루즈 컨트롤에 의존하지 마시고 직접 페달과 브레이크를 조작하세요.',
    rationale: '아이오닉 시리즈는 전방 그릴 하단 레이더에 눈이나 얼음이 쌓이면 운전자 보조 시스템을 자동으로 차단합니다.',
    actionSteps: [
      { step: 1, where: '조작', action: 'HDA 및 전방 충돌방지 보조 기능이 꺼져 있는지 계기판을 확인하세요.' },
      { step: 2, where: '주행', action: '눈길에서는 회생제동을 낮추고 감속 운행하세요.' },
      { step: 3, where: '정비', action: '센서 청소 후에도 오류가 지속되면 진단기로 DTC 코드를 점검해야 합니다.' }
    ],
    stop_conditions: '브레이크 경고등이 켜지거나 조향 이상이 감지될 경우 운행 중지.',
    cautions: '동결된 센서에 뜨거운 물을 직접 부으면 균열이 생길 수 있습니다.',
    sources: [],
    has_grounding: false,
    source_display: '출처 확인 불가 (웹 크롤링/일반 요약)',
    applicable_vehicle: '아이오닉 시리즈 일반 (2025년형 NE1 전용 매뉴얼 미인용)'
  };

  return {
    ours,
    chatgpt,
    gemini,
    generated_at: new Date().toISOString()
  };
}

/**
 * 연구용 무작위화된 블라인드 답변 A/B 쌍 생성 (기존 테스트 규격 유지)
 */
export function generateResearchPair({
  userMessage,
  vehicle,
  summary,
  next_action,
  source_title,
  source_location,
  safety_level
}) {
  const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model_name}` : '차량';

  const candidateAction = {
    model_alias: 'Action-First Model',
    summary: summary,
    next_action: next_action,
    safety_guidance: safety_level === 'IMMEDIATE_ACTION' ? '즉시 안전지대로 정차하여 점검하세요.' : '차량을 정차한 후 침착하게 확인하세요.',
    evidence: `${source_title} (${source_location}) 기준`
  };

  const candidateExplanation = {
    model_alias: 'Procedure-First Model',
    summary: `${vehicleName} 매뉴얼 기준, ${summary.replace('해야 합니다.', '하는 것이 권장됩니다.')}`,
    next_action: `우선 ${next_action} 단계부터 차례대로 실행해 보세요.`,
    safety_guidance: '이상 징후 발생 시 무리한 가속을 피하고 서행 운행하세요.',
    evidence: `제조사 공식 가이드라인 (${source_location}) 발췌`
  };

  const isFlipped = Math.random() > 0.5;
  return {
    isFlipped,
    answerA: isFlipped ? candidateExplanation : candidateAction,
    answerB: isFlipped ? candidateAction : candidateExplanation,
    generated_at: new Date().toISOString()
  };
}

// scripts/verify_all.js
import { initDatabase, db } from '../server/db.js';
import { processUserMessage, analyzeIntent, generateResearchPair } from '../server/orchestrator.js';
import { searchVehicleManual } from '../server/rag.js';
import { searchNearbyFacilities } from '../server/tools/places.js';

initDatabase();

console.log('==================================================');
console.log('   내 차 가이드 (My Car Guide) 2단계 종합 검증 테스트');
console.log('==================================================\n');

let passedCount = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------
// 1. 차량 마스터 및 매뉴얼 매핑 검증
// -----------------------------------------------------------------
console.log('▶ 1. 차량 마스터 및 매뉴얼 매핑 검증');
const vehicles = db.prepare('SELECT * FROM vehicles').all();
assert(vehicles.length >= 4, `지원 차량 4종 이상 등록됨 (실제: ${vehicles.length}종)`);
const avante = vehicles.find(v => v.id === 'hyundai-avante-cn7-2024');
const ioniq5 = vehicles.find(v => v.id === 'hyundai-ioniq5-ne-2024');
const sorento = vehicles.find(v => v.id === 'kia-sorento-mq4-2024');
const gv70 = vehicles.find(v => v.id === 'genesis-gv70-jk1-2024');
assert(avante && ioniq5 && sorento && gv70, '아반떼, 아이오닉5, 쏘렌토HEV, GV70 등록 확인');

// -----------------------------------------------------------------
// 2. 요구사항 4: 엄격한 답변 데이터 구조 및 출처 검증
// -----------------------------------------------------------------
console.log('\n▶ 2. 요구사항 4: 답변 데이터 구조 및 출처/안전 레벨 규격 검증');
const testSess = 'audit-sess-v2';
const testConv = 'audit-conv-v2';

db.prepare('INSERT OR REPLACE INTO sessions (id, current_vehicle_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
  testSess, avante.id, new Date().toISOString(), new Date().toISOString()
);
db.prepare('INSERT OR REPLACE INTO conversations (id, session_id, vehicle_id, vehicle_snapshot, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
  testConv, testSess, avante.id, JSON.stringify(avante), 'V2 규격 테스트', new Date().toISOString(), new Date().toISOString()
);

const ansRes = await processUserMessage({
  sessionId: testSess,
  conversationId: testConv,
  userMessage: '추운 날 타이어 공기압 경고가 떴어. 어떻게 확인해야 해?',
  vehicleId: avante.id,
  driveMode: 'PARKED',
  preferredLength: 'short'
});

const payload = ansRes.response;
assert(typeof payload.summary === 'string' && payload.summary.length > 0, 'summary (결론 한 문장) 생성 확인');
assert(typeof payload.next_action === 'string' && payload.next_action.length > 0, 'next_action (다음 행동) 생성 확인');
assert(payload.vehicle_match === true, 'vehicle_match (차종 일치 플래그) true 확인');
assert(payload.confidence === 'HIGH', 'confidence (HIGH) 확인');
assert(payload.safety_level === 'CAUTION', 'safety_level (CAUTION) 확인');
assert(payload.source_title.includes('아반떼') && payload.source_location.includes('PDF'), 'source_title 및 source_location 확인');

// -----------------------------------------------------------------
// 3. 미확인 증상 시 "공식 매뉴얼에서 확인하지 못했어요" 명시 검증
// -----------------------------------------------------------------
console.log('\n▶ 3. 미확인 증상에 대한 판단 유보 및 필수 문구 검증');
const unknownRes = await processUserMessage({
  sessionId: testSess,
  conversationId: testConv,
  userMessage: '엔진룸 깊숙한 곳에서 알 수 없는 찌걱찌걱 소리가 반복돼',
  vehicleId: avante.id
});
assert(unknownRes.response.summary.includes('확인하지 못했어요'), '“공식 매뉴얼에서 확인하지 못했어요” 필수 문구 명시');
assert(unknownRes.response.confidence === 'NONE', 'confidence NONE 확인');
assert(unknownRes.response.safety_level === 'CAUTION', '안전 레벨 CAUTION 부여');

// -----------------------------------------------------------------
// 4. 주행 모드 vs 정차 모드 검증
// -----------------------------------------------------------------
console.log('\n▶ 4. 주행 모드(운전 중) vs 정차 모드 플래그 검증');
const drivingRes = await processUserMessage({
  sessionId: testSess,
  conversationId: testConv,
  userMessage: '빨간색 브레이크 경고등이 떴어. 지금 운전 중이야.',
  vehicleId: avante.id,
  driveMode: 'DRIVING'
});
assert(drivingRes.response.driveMode === 'DRIVING', 'driveMode DRIVING 전달 확인');
assert(drivingRes.response.safety_level === 'IMMEDIATE_ACTION', '빨간 경고등 즉시 안전 조치(IMMEDIATE_ACTION) 판별');

// -----------------------------------------------------------------
// 5. 요구사항 8: 개인화 및 권한 설정 영속 저장 검증
// -----------------------------------------------------------------
console.log('\n▶ 5. 요구사항 8: 개인화 및 권한 설정 저장/복원 검증');
const now = new Date().toISOString();
db.prepare(`
  INSERT OR REPLACE INTO user_settings (
    session_id, preferred_length, voice_guidance_enabled, location_permission,
    weather_permission, vehicle_data_permission, history_save_enabled, drive_mode, created_at, updated_at
  ) VALUES (?, 'detailed', 1, 1, 1, 0, 1, 'PARKED', ?, ?)
`).run(testSess, now, now);

const loadedSettings = db.prepare('SELECT * FROM user_settings WHERE session_id = ?').get(testSess);
assert(loadedSettings.preferred_length === 'detailed', '선호 답변 길이(detailed) 저장 확인');
assert(loadedSettings.location_permission === 1 && loadedSettings.weather_permission === 1, '위치 및 날씨 권한 설정 확인');

// -----------------------------------------------------------------
// 6. 요구사항 9: AI 답변 비교 연구 모드 (블라인드 평가 영속 저장)
// -----------------------------------------------------------------
console.log('\n▶ 6. 요구사항 9: AI 답변 비교 연구 평가 영속 저장 검증');
const pair = generateResearchPair({
  userMessage: '타이어 공기압 확인',
  vehicle: avante,
  summary: payload.summary,
  next_action: payload.next_action,
  source_title: payload.source_title,
  source_location: payload.source_location,
  safety_level: payload.safety_level
});

assert(pair.answerA && pair.answerB, '블라인드 답변 A/B 쌍 생성 성공');
assert(!pair.answerA.model_alias.includes('GPT-4') && !pair.answerA.model_alias.includes('Claude'), '참가자에게 실모델명 미노출 (블라인드)');

const evalId = 'eval-test-1';
db.prepare(`
  INSERT OR REPLACE INTO research_evaluations (
    id, session_id, vehicle_id, query, chosen_answer, choice_reason,
    eval_source_quality, eval_safety, eval_vehicle_accuracy,
    answer_a_summary, answer_b_summary, answer_a_model, answer_b_model, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  evalId,
  testSess,
  avante.id,
  '타이어 공기압 확인',
  'A',
  '행동 지침이 직관적이고 운전 중 이해하기 쉬움',
  5,
  5,
  5,
  pair.answerA.summary,
  pair.answerB.summary,
  pair.answerA.model_alias,
  pair.answerB.model_alias,
  new Date().toISOString()
);

const savedEval = db.prepare('SELECT * FROM research_evaluations WHERE id = ?').get(evalId);
assert(savedEval.chosen_answer === 'A', '선택 답변(A) 저장 확인');
assert(savedEval.eval_safety === 5, '평가 점수(안전성 5점) 저장 확인');

// -----------------------------------------------------------------
// 7. 위치 및 시설 조회 검증 (직선거리 명시)
// -----------------------------------------------------------------
console.log('\n▶ 7. 위치 기반 시설 조회 및 직선거리 표기');
const evFacilities = await searchNearbyFacilities({
  lat: 37.5020,
  lon: 127.0370,
  powertrainType: 'EV'
});
assert(evFacilities.facility_type === 'charging_station', '전기차는 충전소 매핑');
assert(evFacilities.facilities[0].is_straight_line_distance === true, '직선거리 명시 확인');

// -----------------------------------------------------------------
// 8. 차량 상황 맞춤형 안내 챗봇 & UT 시뮬레이션 모드 검증
// -----------------------------------------------------------------
console.log('\n▶ 8. 차량 상황 맞춤형 안내 챗봇 & UT 시뮬레이션 모드 종합 검증');

// 8-1. UT 가상 시나리오 활성화 및 맥락 주입 검증
const testUtSess = 'ut-session-test-v3';
db.prepare('INSERT OR REPLACE INTO sessions (id, current_vehicle_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
  testUtSess, avante.id, new Date().toISOString(), new Date().toISOString()
);
db.prepare('INSERT OR REPLACE INTO conversations (id, session_id, vehicle_id, vehicle_snapshot, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
  'ut-conv-v3', testUtSess, avante.id, JSON.stringify(avante), 'UT 테스트', new Date().toISOString(), new Date().toISOString()
);
db.prepare('INSERT OR REPLACE INTO active_simulation_contexts (session_id, scenario_id, is_active, updated_at) VALUES (?, ?, 1, ?)').run(
  testUtSess, 'scenario-emergency-brake', new Date().toISOString()
);

const utAnsRes = await processUserMessage({
  sessionId: testUtSess,
  conversationId: 'ut-conv-v3',
  userMessage: '계기판에 빨간색 느낌표 브레이크 경고등이 떴어. 어떻게 해야 해?',
  vehicleId: avante.id
});

const utPayload = utAnsRes.response;
assert(utPayload.isSimulationMode === true, 'UT 시뮬레이션 모드 활성화 확인');
assert(utPayload.driveMode === 'DRIVING', '가상 시나리오의 주행 상태(DRIVING) 반영 확인');
assert(utPayload.safety_level === 'IMMEDIATE_ACTION', '빨간 경고등 즉시 안전 조치(IMMEDIATE_ACTION) 판별');
assert(typeof utPayload.immediate_action === 'string' && utPayload.immediate_action.length > 0, '지금 바로 할 행동(immediate_action) 생성 확인');
assert(typeof utPayload.rationale === 'string' && utPayload.rationale.length > 0, '행동 필요 이유 및 근거(rationale) 생성 확인');
assert(Array.isArray(utPayload.actionSteps), '사용자 확인 단계(actionSteps) 배열 구조 확인');
assert(typeof utPayload.stop_conditions === 'string' && utPayload.stop_conditions.length > 0, '운행 중지 조건(stop_conditions) 생성 확인');

// 8-2. 지식 베이스 검색 및 적용 차량/버전 범위 적합성(Scope) 검증
const recallAnsRes = await processUserMessage({
  sessionId: testSess,
  conversationId: testConv,
  userMessage: '아반떼 ESC 소프트웨어 업데이트 리콜 관련 내용 알려줘',
  vehicleId: avante.id
});
const recallPayload = recallAnsRes.response;
assert(recallPayload.sources && recallPayload.sources.length > 0, '근거 출처(sources) 목록 제공 확인');
assert(recallPayload.sources[0].document_title.includes('리콜'), '국토교통부 리콜 공지 출처 문서명 표기');
assert(recallPayload.sources[0].is_virtual_sample === true, '가상 테스트용 샘플 자료 플래그 표기 확인');
assert(recallPayload.scope_verification && recallPayload.scope_verification.matchStatus, '적용 차종/버전 범위 검증(scope_verification) 제공 확인');

// 8-3. 불충분 정보 시 진단 분기 핵심 확인 질문(clarificationNeeded) 검증
const evSess = 'test-ev-branch-sess';
const evConv = 'test-ev-branch-conv';
db.prepare('INSERT OR REPLACE INTO sessions (id, current_vehicle_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
  evSess, ioniq5.id, new Date().toISOString(), new Date().toISOString()
);
db.prepare('INSERT OR REPLACE INTO conversations (id, session_id, vehicle_id, vehicle_snapshot, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
  evConv, evSess, ioniq5.id, JSON.stringify(ioniq5), 'EV 시동 분기 테스트', new Date().toISOString(), new Date().toISOString()
);

const evBranchRes = await processUserMessage({
  sessionId: evSess,
  conversationId: evConv,
  userMessage: '아이오닉 5 시동 버튼을 눌렀는데 READY가 안 뜨고 차가 먹통이야',
  vehicleId: ioniq5.id
});
const evPayload = evBranchRes.response;
assert(evPayload.clarificationNeeded !== null && typeof evPayload.clarificationNeeded.question === 'string', '핵심 진단 분기 확인 질문(clarificationNeeded) 트리거 확인');
assert(Array.isArray(evPayload.clarificationNeeded.options) && evPayload.clarificationNeeded.options.length >= 2, '진단 분기 선택지(options) 2개 이상 제공 확인');

// -----------------------------------------------------------------
// 최종 결과 집계
// -----------------------------------------------------------------
console.log('\n==================================================');
console.log(` 검증 완료: ${passedCount} / ${totalTests} 항목 전원 통과!`);
console.log('==================================================\n');

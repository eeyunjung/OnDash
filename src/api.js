// src/api.js

const API_BASE = '/api';

// 익명 세션 ID 획득 (로컬스토리지에 저장하되 서버 DB와 세션 동기화)
export function getOrCreateSessionId() {
  let sessionId = localStorage.getItem('my_car_guide_session_id');
  if (!sessionId) {
    sessionId = 'sess-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('my_car_guide_session_id', sessionId);
  }
  return sessionId;
}

// 공통 요청 래퍼
async function request(path, options = {}) {
  const sessionId = getOrCreateSessionId();
  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `요청 실패 (${response.status})`);
  }

  return response.json();
}

// 1. 차량 목록 조회
export async function getVehicles() {
  return request('/vehicles');
}

// 2. 세션 동기화 및 현재 차량 설정
export async function syncSession(vehicleId) {
  const sessionId = getOrCreateSessionId();
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ sessionId, vehicleId })
  });
}

// 3. 대화 목록 조회
export async function getConversations() {
  return request('/conversations');
}

// 4. 새 대화 생성
export async function createConversation(vehicleId, title) {
  return request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ vehicleId, title })
  });
}

// 5. 대화 상세 및 메시지 내역 조회
export async function getConversationDetail(convId) {
  return request(`/conversations/${convId}`);
}

// 6. 대화 삭제
export async function deleteConversation(convId) {
  return request(`/conversations/${convId}`, {
    method: 'DELETE'
  });
}

// 7. 질문 전송 및 RAG 답변 요청
export async function sendChatMessage({
  conversationId,
  userMessage,
  vehicleId,
  clientLocation,
  providedState,
  driveMode = 'PARKED',
  preferredLength = 'short'
}) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      userMessage,
      vehicleId,
      clientLocation,
      providedState,
      driveMode,
      preferredLength
    })
  });
}

// 8. 개인화 및 권한 설정 API
export async function getSettings() {
  return request('/settings');
}

export async function updateSettings(settings) {
  return request('/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  });
}

// 9. AI 답변 비교 연구 평가 API
export async function submitResearchEvaluation(evalData) {
  return request('/research/evaluate', {
    method: 'POST',
    body: JSON.stringify(evalData)
  });
}

export async function getResearchEvaluations() {
  return request('/research/evaluations');
}

// 10. 관리자 API
export async function getAdminDocuments(adminKey) {
  return request('/admin/documents', {
    headers: { 'x-admin-key': adminKey }
  });
}

export async function getAdminLogs(adminKey) {
  return request('/admin/logs', {
    headers: { 'x-admin-key': adminKey }
  });
}

export async function testAdminRag(adminKey, vehicleId, query) {
  return request('/admin/test-rag', {
    method: 'POST',
    headers: { 'x-admin-key': adminKey },
    body: JSON.stringify({ vehicleId, query })
  });
}

// 11. UT 가상 시뮬레이션 시나리오 API
export async function getSimulationScenarios() {
  return request('/simulation/scenarios');
}

export async function saveSimulationScenario(scenario) {
  return request('/simulation/scenarios', {
    method: 'POST',
    body: JSON.stringify(scenario)
  });
}

export async function deleteSimulationScenario(id) {
  return request(`/simulation/scenarios/${id}`, {
    method: 'DELETE'
  });
}

export async function getActiveSimulationScenario() {
  return request('/simulation/active');
}

export async function setActiveSimulationScenario({ scenarioId, isActive = true, customOverride = null }) {
  return request('/simulation/active', {
    method: 'POST',
    body: JSON.stringify({ scenarioId, isActive, customOverride })
  });
}

// 12. 지식 베이스(Knowledge Items) API
export async function getKnowledgeItems(category = '') {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return request(`/knowledge${query}`);
}

export async function saveKnowledgeItem(item) {
  return request('/knowledge', {
    method: 'POST',
    body: JSON.stringify(item)
  });
}

// 13. UT 3사 비교 평가 (Ours vs ChatGPT vs Gemini) 및 20개 문항 API
export async function getUtTestItems(scenarioId = '') {
  const query = scenarioId ? `?scenarioId=${encodeURIComponent(scenarioId)}` : '';
  return request(`/ut/test-items${query}`);
}

export async function generateTriComparisonApi({ testItemId, scenarioId, userPrompt, customChatgpt, customGemini }) {
  return request('/ut/generate-tri-comparison', {
    method: 'POST',
    body: JSON.stringify({ testItemId, scenarioId, userPrompt, customChatgpt, customGemini })
  });
}

export async function submitUtTriEvaluation(evalData) {
  return request('/ut/tri-evaluations', {
    method: 'POST',
    body: JSON.stringify(evalData)
  });
}

export async function getUtTriEvaluations(testItemId = '') {
  const query = testItemId ? `?testItemId=${encodeURIComponent(testItemId)}` : '';
  return request(`/ut/tri-evaluations${query}`);
}

export async function getUtResultsSummary() {
  return request('/ut/results-summary');
}



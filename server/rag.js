// server/rag.js
import { db } from './db.js';

/**
 * 1. 차량 전용 매뉴얼 청크 검색 (RAG Retrieval)
 * - 반드시 해당 차량(vehicle_id)의 공식 문서만 검색
 * - 다른 차량 정보 혼입 차단
 */
export function searchVehicleManual({ vehicleId, query, categoryFilter }) {
  if (!vehicleId) {
    throw new Error('차량 ID(vehicleId)가 지정되지 않았습니다.');
  }

  // 해당 차량에 등록된 공식 문서 확인
  const docsStmt = db.prepare(`
    SELECT * FROM manual_documents WHERE vehicle_id = ? AND status = 'READY'
  `);
  const documents = docsStmt.all(vehicleId);

  if (documents.length === 0) {
    return {
      status: 'NO_DOCUMENTS',
      message: '해당 차량의 공식 매뉴얼이 아직 등록되지 않았거나 처리 중입니다.',
      chunks: []
    };
  }

  const docIds = documents.map(d => d.id);
  const placeholders = docIds.map(() => '?').join(',');

  // 해당 문서에 속한 모든 청크 조회
  const chunksStmt = db.prepare(`
    SELECT c.*, d.title as doc_title, d.doc_version, d.official_source_url, d.pdf_file_name
    FROM manual_chunks c
    JOIN manual_documents d ON c.document_id = d.id
    WHERE c.document_id IN (${placeholders})
  `);
  const allChunks = chunksStmt.all(...docIds);

  // 쿼리 토큰화 및 키워드 기반 스코어링
  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);

  const scoredChunks = allChunks.map(chunk => {
    let score = 0;
    const textToMatch = `${chunk.section_title} ${chunk.content} ${chunk.keywords || ''} ${chunk.conditions || ''}`.toLowerCase();

    // 카테고리 필터 일치 시 가산점
    if (categoryFilter && chunk.category === categoryFilter) {
      score += 15;
    }

    // 각 토큰별 매칭 가중치
    for (const token of tokens) {
      if (chunk.section_title.toLowerCase().includes(token)) {
        score += 8;
      }
      if ((chunk.keywords || '').toLowerCase().includes(token)) {
        score += 6;
      }
      if (chunk.content.toLowerCase().includes(token)) {
        score += 3;
      }
    }

    return {
      ...chunk,
      score,
      action_steps: chunk.action_steps ? JSON.parse(chunk.action_steps) : []
    };
  });

  // 점수 내림차순 정렬
  scoredChunks.sort((a, b) => b.score - a.score);

  // 유의미한 점수를 얻은 상위 청크 반환 (최소 임계치 5점 이상)
  const relevantChunks = scoredChunks.filter(c => c.score >= 5).slice(0, 3);

  return {
    status: relevantChunks.length > 0 ? 'FOUND' : 'NOT_FOUND',
    chunks: relevantChunks
  };
}

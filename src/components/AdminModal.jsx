// src/components/AdminModal.jsx
import React, { useState } from 'react';
import { X, ShieldCheck, Download, Search, CheckCircle2, AlertCircle, FileText, Database } from 'lucide-react';
import { getAdminDocuments, getAdminLogs, testAdminRag } from '../api';

export default function AdminModal({ isOpen, onClose }) {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [documents, setDocuments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('docs'); // 'docs' | 'logs' | 'rag_test'
  
  // RAG 테스트 상태
  const [testVehicleId, setTestVehicleId] = useState('hyundai-avante-cn7-2024');
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await getAdminDocuments(adminKey);
      setDocuments(data.documents);
      setIsAuthenticated(true);
      setErrorMsg('');

      // 로그도 미리 로드
      const logsData = await getAdminLogs(adminKey);
      setLogs(logsData.logs);
    } catch (err) {
      setErrorMsg('인증 키가 올바르지 않습니다.');
    }
  };

  const handleRunRagTest = async (e) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    try {
      const res = await testAdminRag(adminKey, testVehicleId, testQuery.trim());
      setTestResult(res);
    } catch (err) {
      alert('RAG 테스트 실패: ' + err.message);
    }
  };

  const handleExport = (format) => {
    const url = `/api/admin/export?format=${format}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `car_guide_audit_logs.${format}`);
    // fetch로 헤더 전달
    fetch(url, { headers: { 'x-admin-key': adminKey } })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `car_guide_audit_logs.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
  };

  return (
    <div className="modal-overlay">
      <div className="bottom-sheet" style={{ maxHeight: '90dvh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#3182f6" />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>운영자 전용 콘솔</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="#8b95a1" />
          </button>
        </div>

        {!isAuthenticated ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '14px', color: '#4e5968' }}>
              운영자 비밀키(ADMIN_SECRET_KEY)를 입력하세요. (기본: car-guide-admin-2024)
            </p>
            <input
              type="password"
              placeholder="운영자 비밀키"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              style={{
                border: '1px solid #e5e8eb',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '15px'
              }}
            />
            {errorMsg && <div style={{ color: '#f04452', fontSize: '13px' }}>{errorMsg}</div>}
            <button
              type="submit"
              style={{
                backgroundColor: '#3182f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              인증 및 접속
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 서브 탭 */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e8eb', paddingBottom: '8px' }}>
              <button
                onClick={() => setActiveSubTab('docs')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontWeight: activeSubTab === 'docs' ? 700 : 500,
                  color: activeSubTab === 'docs' ? '#3182f6' : '#8b95a1',
                  cursor: 'pointer'
                }}
              >
                매뉴얼 상태
              </button>
              <button
                onClick={() => setActiveSubTab('rag_test')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontWeight: activeSubTab === 'rag_test' ? 700 : 500,
                  color: activeSubTab === 'rag_test' ? '#3182f6' : '#8b95a1',
                  cursor: 'pointer'
                }}
              >
                RAG 검색 검증
              </button>
              <button
                onClick={() => setActiveSubTab('logs')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontWeight: activeSubTab === 'logs' ? 700 : 500,
                  color: activeSubTab === 'logs' ? '#3182f6' : '#8b95a1',
                  cursor: 'pointer'
                }}
              >
                감사 로그 & 내보내기
              </button>
            </div>

            {/* 1. 매뉴얼 문서 목록 및 상태 */}
            {activeSubTab === 'docs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#8b95a1' }}>등록된 공식 PDF 문서 및 처리 상태</span>
                {documents.map(d => (
                  <div
                    key={d.id}
                    style={{
                      border: '1px solid #e5e8eb',
                      borderRadius: '10px',
                      padding: '12px',
                      backgroundColor: '#fafbfc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{d.title}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: d.status === 'READY' ? '#e6fcf5' : '#fff3bf',
                          color: d.status === 'READY' ? '#0ca678' : '#f59f00'
                        }}
                      >
                        {d.status === 'READY' ? '사용 가능' : d.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#4e5968' }}>
                      차량: {d.brand} {d.model_name} ({d.year_range}) · 총 {d.total_pages}페이지
                    </div>
                    <div style={{ fontSize: '12px', color: '#8b95a1' }}>
                      청크 수: {d.chunk_count}개 보존 · PDF: {d.pdf_file_name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. RAG 검색 검증 */}
            {activeSubTab === 'rag_test' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <form onSubmit={handleRunRagTest} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select
                    value={testVehicleId}
                    onChange={(e) => setTestVehicleId(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e5e8eb' }}
                  >
                    <option value="hyundai-avante-cn7-2024">현대 더 뉴 아반떼 (CN7)</option>
                    <option value="hyundai-ioniq5-ne-2024">현대 아이오닉 5 (NE)</option>
                    <option value="kia-sorento-mq4-2024">기아 쏘렌토 하이브리드 (MQ4)</option>
                    <option value="genesis-gv70-jk1-2024">제네시스 GV70 (JK1)</option>
                  </select>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="검색 쿼리 (예: 타이어 공기압, 블루투스)"
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e8eb' }}
                    />
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#3182f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 14px',
                        cursor: 'pointer'
                      }}
                    >
                      검색
                    </button>
                  </div>
                </form>

                {testResult && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      상태: {testResult.status} (매칭 청크: {testResult.chunks.length}건)
                    </div>
                    {testResult.chunks.map(c => (
                      <div key={c.id} style={{ background: '#f8f9fa', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
                        <div style={{ fontWeight: 700 }}>{c.section_title} (점수: {c.score})</div>
                        <div style={{ fontSize: '12px', color: '#8b95a1' }}>
                          PDF {c.pdf_page}p / 인쇄 {c.printed_page}p
                        </div>
                        <div style={{ marginTop: '4px', color: '#4e5968' }}>{c.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. 감사 로그 및 내보내기 */}
            {activeSubTab === 'logs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleExport('json')}
                    style={{
                      flex: 1,
                      backgroundColor: '#f2f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Download size={14} />
                    <span>JSON 내보내기</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    style={{
                      flex: 1,
                      backgroundColor: '#f2f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Download size={14} />
                    <span>CSV 내보내기</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#8b95a1' }}>최근 답변 생성 감사 기록 ({logs.length}건)</span>
                  {logs.slice(0, 10).map(l => (
                    <div
                      key={l.id}
                      style={{
                        border: '1px solid #e5e8eb',
                        borderRadius: '8px',
                        padding: '10px',
                        fontSize: '12px',
                        backgroundColor: '#fff'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#191f28' }}>Q: {l.user_query}</div>
                      <div style={{ color: '#4e5968', marginTop: '4px' }}>
                        차량: {l.vehicle_snapshot?.brand} {l.vehicle_snapshot?.model_name}
                      </div>
                      <div style={{ color: '#8b95a1', marginTop: '2px' }}>
                        소요시간: {l.generation_duration_ms}ms · 청크: {l.manual_chunks_used.length}개 · 도구호출: {l.tool_calls.length}회
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

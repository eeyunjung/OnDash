// src/components/KnowledgeModal.jsx
import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Plus,
  ShieldCheck,
  AlertTriangle,
  FileText,
  RotateCw,
  Save,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { getKnowledgeItems, saveKnowledgeItem } from '../api';

const CATEGORIES = [
  { id: '', label: '전체 자료' },
  { id: 'SAFETY_CRITERIA', label: '🛑 안전 대응 기준' },
  { id: 'DIAGNOSTIC_BRANCH', label: '🔍 진단 분기 질문' },
  { id: 'TSB_RECALL', label: '📢 리콜/정비 공지' },
  { id: 'OTA_UPDATE', label: '⚡ OTA 변경 사항' },
  { id: 'OWNER_MANUAL', label: '📖 취급 설명서 규정' }
];

export default function KnowledgeModal({ isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    category: 'SAFETY_CRITERIA',
    title: '',
    content: '',
    immediate_action: '',
    action_steps_str: '',
    rationale: '',
    stop_conditions: '',
    document_title: '',
    source_org: '',
    source_section: '',
    source_page: '',
    doc_url: '',
    applicable_country: 'KOR',
    doc_version: '2024.11 최신판',
    last_verified_date: new Date().toISOString().split('T')[0],
    evidence_level: 'OFFICIAL_MANUAL',
    is_deprecated: false,
    prohibited_actions: '',
    judgement_limits: '',
    effective_date: new Date().toISOString().split('T')[0],
    applicable_models_str: '2025 현대 아이오닉 5, 아이오닉 5 NE1',
    applicable_years_str: '2024, 2025',
    applicable_trims_str: '전체 (ccNC)',
    applicable_sw_versions_str: '전체',
    keywords: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedCategory]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getKnowledgeItems(selectedCategory);
      setItems(res.knowledgeItems || []);
    } catch (err) {
      console.error('자료 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const steps = form.action_steps_str
        ? form.action_steps_str.split('\n').filter(Boolean).map((s, idx) => ({ step: idx + 1, where: '차량', action: s.trim() }))
        : [];

      const payload = {
        category: form.category,
        title: form.title,
        content: form.content,
        immediate_action: form.immediate_action,
        action_steps: steps,
        rationale: form.rationale,
        stop_conditions: form.stop_conditions,
        document_title: form.document_title,
        source_org: form.source_org,
        source_section: form.source_section,
        source_page: form.source_page,
        doc_url: form.doc_url,
        applicable_country: form.applicable_country || 'KOR',
        doc_version: form.doc_version,
        last_verified_date: form.last_verified_date,
        evidence_level: form.evidence_level || 'OFFICIAL_MANUAL',
        is_deprecated: form.is_deprecated ? 1 : 0,
        prohibited_actions: form.prohibited_actions,
        judgement_limits: form.judgement_limits,
        effective_date: form.effective_date,
        applicable_models: form.applicable_models_str.split(',').map(s => s.trim()).filter(Boolean),
        applicable_years: form.applicable_years_str.split(',').map(s => s.trim()).filter(Boolean),
        applicable_trims: form.applicable_trims_str.split(',').map(s => s.trim()).filter(Boolean),
        applicable_regions: ['KOR'],
        applicable_sw_versions: form.applicable_sw_versions_str.split(',').map(s => s.trim()).filter(Boolean),
        keywords: form.keywords,
        is_virtual_sample: 1
      };

      await saveKnowledgeItem(payload);
      setIsCreating(false);
      setMessage('새 공식 지식 자료가 등록되었습니다.');
      setTimeout(() => setMessage(''), 3000);
      await loadData();
    } catch (err) {
      alert('등록 실패: ' + err.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '640px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={18} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>
                차량별 지식·근거 자료 라이브러리
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                안전 기준, 리콜/TSB, 진단 분기 질문 및 적용 범위 검증 DB
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {message && (
          <div style={{ background: '#ecfdf5', color: '#065f46', padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}>
            {message}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 가상 테스트용 샘플 배너 */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '11.5px',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={15} color="#6366f1" />
            <span>
              각 자료는 <strong>문서명, 출처기관, 적용 차종·연식·SW버전, 기준일, 원문 위치</strong>를 엄격히 보관하며, 일치하지 않는 차종에는 단정적으로 답변하지 않습니다.
            </span>
          </div>

          {/* 카테고리 탭 & 등록 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCategory(c.id); setIsCreating(false); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    border: selectedCategory === c.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: selectedCategory === c.id ? '#eff6ff' : '#ffffff',
                    color: selectedCategory === c.id ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCreating(!isCreating)}
              style={{
                background: isCreating ? '#f1f5f9' : '#2563eb',
                color: isCreating ? '#334155' : '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              {isCreating ? '목록으로' : '+ 새 자료 등록'}
            </button>
          </div>

          {!isCreating ? (
            /* 자료 목록 뷰 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>
                  등록된 근거 자료가 없습니다.
                </div>
              ) : (
                items.map(it => (
                  <div
                    key={it.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: it.category === 'SAFETY_CRITERIA' ? '#fee2e2' : '#f0fdf4',
                          color: it.category === 'SAFETY_CRITERIA' ? '#991b1b' : '#166534'
                        }}>
                          {it.category}
                        </span>
                        {it.is_virtual_sample === 1 && (
                          <span style={{ fontSize: '10px', color: '#6366f1', background: '#eef2ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            가상 테스트용 샘플 자료
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        기준일: {it.effective_date}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      {it.title}
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45, background: '#f8fafc', padding: '8px 10px', borderRadius: '8px' }}>
                      <strong>핵심 내용:</strong> {it.content}
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#1d4ed8', fontWeight: 700 }}>
                      👉 <strong>지금 바로 할 행동:</strong> {it.immediate_action}
                    </div>

                    {/* 적용 대상 범위 배지 */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      fontSize: '11px',
                      paddingTop: '6px',
                      borderTop: '1px dashed #e2e8f0'
                    }}>
                      <span style={{ color: '#64748b' }}>적용 대상:</span>
                      <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#334155' }}>
                        국가: {it.applicable_country || 'KOR'}
                      </span>
                      <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#334155' }}>
                        차종: {it.applicable_models ? it.applicable_models.join(', ') : '아이오닉 5'}
                      </span>
                      <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#334155' }}>
                        연식: {it.applicable_years ? it.applicable_years.join(', ') : '2025'}
                      </span>
                      <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#334155' }}>
                        SW: {it.applicable_sw_versions ? it.applicable_sw_versions.join(', ') : 'ccNC'}
                      </span>
                    </div>

                    {/* 금지 행동 / 주의사항 (있을 경우) */}
                    {it.prohibited_actions && (
                      <div style={{ fontSize: '11.5px', color: '#b91c1c', background: '#fef2f2', padding: '6px 8px', borderRadius: '6px' }}>
                        ⛔ <strong>금지 행동/주의:</strong> {it.prohibited_actions}
                      </div>
                    )}

                    {/* 판단의 한계 (있을 경우) */}
                    {it.judgement_limits && (
                      <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '5px 8px', borderRadius: '6px' }}>
                        ⚠️ <strong>판단 한계:</strong> {it.judgement_limits}
                      </div>
                    )}

                    {/* 출처 및 원문 메타데이터 */}
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>📚 <strong>출처:</strong> {it.document_title}</span>
                        <span>·</span>
                        <span>{it.source_org} ({it.source_section})</span>
                        {it.source_page && <span>{it.source_page}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '10.5px' }}>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px' }}>
                          근거수준: {it.evidence_level || 'OFFICIAL_MANUAL'}
                        </span>
                        <span>버전: {it.doc_version || '2024.11'}</span>
                        <span>최종확인: {it.last_verified_date || it.effective_date}</span>
                        {it.is_deprecated ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>[폐기/대체됨]</span>
                        ) : (
                          <span style={{ color: '#16a34a' }}>[유효 문서]</span>
                        )}
                        {it.doc_url && (
                          <a href={it.doc_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            원문 링크
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* 새 자료 등록 폼 */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>분류 카테고리</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                >
                  <option value="SAFETY_CRITERIA">🛑 상황별 안전 대응 기준</option>
                  <option value="DIAGNOSTIC_BRANCH">🔍 증상별 진단 분기 질문</option>
                  <option value="TSB_RECALL">📢 리콜 및 서비스 캠페인</option>
                  <option value="OTA_UPDATE">⚡ OTA 업데이트 변경 내역</option>
                  <option value="OWNER_MANUAL">📖 취급 설명서 규정</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>자료 제목</label>
                <input
                  type="text"
                  required
                  placeholder="예: 현대 아이오닉 5 취급설명서: 전방 센서 가림 시 조치 및 한계"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>상세 내용</label>
                <textarea
                  rows={3}
                  required
                  placeholder="증상 원인, 배경, 공식 매뉴얼 지침 등"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>지금 바로 할 행동</label>
                <input
                  type="text"
                  required
                  placeholder="예: 스마트 크루즈 의존을 중단하고 직접 운전하며, 안전 정차 후 센서 부위의 눈을 닦으십시오."
                  value={form.immediate_action}
                  onChange={(e) => setForm({ ...form, immediate_action: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>사용자 직접 조치 단계 (줄바꿈 구분)</label>
                <textarea
                  rows={2}
                  placeholder="1단계: 클러스터 경고 확인 및 차간거리 직접 확보&#10;2단계: 가장 가까운 안전지대 정차 후 부드러운 천으로 센서 눈 제거"
                  value={form.action_steps_str}
                  onChange={(e) => setForm({ ...form, action_steps_str: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>금지 행동 또는 주의사항</label>
                  <input
                    type="text"
                    placeholder="예: 날카로운 도구 사용 금지, 무리한 HDA 유지 금지"
                    value={form.prohibited_actions}
                    onChange={(e) => setForm({ ...form, prohibited_actions: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>판단의 한계 / 추가 확인</label>
                  <input
                    type="text"
                    placeholder="예: 센서 청소 후에도 경고 지속 시 하드웨어 점검 필요"
                    value={form.judgement_limits}
                    onChange={(e) => setForm({ ...form, judgement_limits: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>행동 필요 근거</label>
                  <input
                    type="text"
                    placeholder="왜 이 행동이 필요한지"
                    value={form.rationale}
                    onChange={(e) => setForm({ ...form, rationale: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>운행 중지 / 전문점검 조건</label>
                  <input
                    type="text"
                    placeholder="운행을 멈춰야 하는 기준"
                    value={form.stop_conditions}
                    onChange={(e) => setForm({ ...form, stop_conditions: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* 적용 범위 지정 */}
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>적용 대상 차량 및 버전 범위</span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b' }}>적용 모델 (쉼표 구분)</label>
                    <input
                      type="text"
                      value={form.applicable_models_str}
                      onChange={(e) => setForm({ ...form, applicable_models_str: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b' }}>적용 연식 (쉼표 구분)</label>
                    <input
                      type="text"
                      value={form.applicable_years_str}
                      onChange={(e) => setForm({ ...form, applicable_years_str: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b' }}>판매 국가</label>
                    <input
                      type="text"
                      value={form.applicable_country}
                      onChange={(e) => setForm({ ...form, applicable_country: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b' }}>적용 트림</label>
                    <input
                      type="text"
                      value={form.applicable_trims_str}
                      onChange={(e) => setForm({ ...form, applicable_trims_str: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b' }}>적용 SW 버전</label>
                    <input
                      type="text"
                      value={form.applicable_sw_versions_str}
                      onChange={(e) => setForm({ ...form, applicable_sw_versions_str: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                    />
                  </div>
                </div>
              </div>

              {/* 출처 메타데이터 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>문서명</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 현대 아이오닉 5 2025 취급설명서"
                    value={form.document_title}
                    onChange={(e) => setForm({ ...form, document_title: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>출처 기관</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 현대자동차 고객지원본부"
                    value={form.source_org}
                    onChange={(e) => setForm({ ...form, source_org: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>원문 항목/절</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 제5장 32절 운전자 보조 시스템"
                    value={form.source_section}
                    onChange={(e) => setForm({ ...form, source_section: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>페이지</label>
                  <input
                    type="text"
                    placeholder="예: PDF 412p (인쇄 395p)"
                    value={form.source_page}
                    onChange={(e) => setForm({ ...form, source_page: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>근거 수준</label>
                  <select
                    value={form.evidence_level}
                    onChange={(e) => setForm({ ...form, evidence_level: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  >
                    <option value="OFFICIAL_MANUAL">공식 취급설명서</option>
                    <option value="TSB_BULLETIN">공식 서비스 정비지침(TSB)</option>
                    <option value="GOV_REGULATION">국토부/공공기관 지침</option>
                    <option value="INTERNAL_SPEC">제조사 내부 기술사양</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>문서 버전</label>
                  <input
                    type="text"
                    value={form.doc_version}
                    onChange={(e) => setForm({ ...form, doc_version: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>최종 확인일</label>
                  <input
                    type="date"
                    value={form.last_verified_date}
                    onChange={(e) => setForm({ ...form, last_verified_date: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>원문 공식 URL</label>
                <input
                  type="url"
                  placeholder="https://www.hyundai.com/kr/ko/manuals/ioniq5-2025"
                  value={form.doc_url}
                  onChange={(e) => setForm({ ...form, doc_url: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>검색 키워드 (쉼표 구분)</label>
                <input
                  type="text"
                  placeholder="예: 전방센서, 레이더가림, 스마트크루즈, hda, 눈길"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="is_deprecated_chk"
                  checked={form.is_deprecated}
                  onChange={(e) => setForm({ ...form, is_deprecated: e.target.checked })}
                />
                <label htmlFor="is_deprecated_chk" style={{ fontSize: '11.5px', color: '#475569' }}>
                  이 문서는 개정되어 폐기/대체된 구버전 문서입니다 (검색 시 단정 답변 제외)
                </label>
              </div>

              <button
                type="submit"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Save size={14} />
                <span>공식 근거 자료 등록 완료</span>
              </button>
            </form>
          )}
        </div>

        <div style={{
          padding: '12px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

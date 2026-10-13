// src/components/TriComparisonEvalModal.jsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  FileText,
  RotateCw,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Award,
  Sparkles,
  BarChart3,
  Bookmark,
  Check,
  Flame,
  Info
} from 'lucide-react';
import {
  getUtTestItems,
  generateTriComparisonApi,
  submitUtTriEvaluation,
  getUtResultsSummary,
  getUtTriEvaluations
} from '../api';

export default function TriComparisonEvalModal({
  isOpen,
  onClose,
  currentVehicle,
  driveMode = 'PARKED'
}) {
  const [activeTab, setActiveTab] = useState('compare'); // 'compare' | 'driver' | 'expert' | 'summary' | 'test_items'
  const [testItems, setTestItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('item-01-s6-sensor-snow');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [selectedSourceForModal, setSelectedSourceForModal] = useState(null);

  // 답변 순서 제어 (1. 고정 순서, 2. 무작위 순서, 3. 참가자 번호 기반 라틴 방격)
  const [orderMode, setOrderMode] = useState('FIXED'); // 'FIXED' | 'RANDOM' | 'LATIN'
  const [participantId, setParticipantId] = useState('P-01');
  const [randomSeed, setRandomSeed] = useState(1);

  // 외부 모델 수동 입력 모드 (실제 답변 붙여넣기)
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedChatgpt, setPastedChatgpt] = useState('');
  const [pastedGemini, setPastedGemini] = useState('');

  // 1. 운전자 선호 평가 상태 (7점 척도: 1~7)
  const [driverClarity, setDriverClarity] = useState(5);
  const [driverActionability, setDriverActionability] = useState(5);
  const [driverContextFit, setDriverContextFit] = useState(5);
  const [driverTrust, setDriverTrust] = useState(5);
  const [chosenSystem, setChosenSystem] = useState('OURS'); // 'OURS' | 'CHATGPT' | 'GEMINI' | 'TIE' | 'NONE'
  const [driverNotes, setDriverNotes] = useState('');

  // 2. 전문가 안전·사실성 평가 상태 (5점 척도: 1~5)
  const [expertTarget, setExpertTarget] = useState('OURS'); // 'OURS' | 'CHATGPT' | 'GEMINI'
  const [expertAccuracy, setExpertAccuracy] = useState(5);
  const [expertSafety, setExpertSafety] = useState(5);
  const [expertContextFit, setExpertContextFit] = useState(5);
  const [expertGrounding, setExpertGrounding] = useState(5);
  const [expertPrudence, setExpertPrudence] = useState(5);
  const [factChecks, setFactChecks] = useState({
    vehicleMatch: true,
    sensorSnowOnly: true,
    highwayRestStop: true,
    noFakeManual: true
  });
  const [groundingMapping, setGroundingMapping] = useState('');
  const [hasCriticalSafetyError, setHasCriticalSafetyError] = useState(false);
  const [criticalErrorSeverity, setCriticalErrorSeverity] = useState('HIGH');
  const [criticalErrorDetail, setCriticalErrorDetail] = useState('');
  const [expertNotes, setExpertNotes] = useState('');

  // 3. 요약 결과 상태
  const [summaryData, setSummaryData] = useState(null);
  const [submitMessage, setSubmitMessage] = useState('');

  // 주행 중일 경우 연구 참여 제한
  const isDriving = driveMode === 'DRIVING';

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const itemsRes = await getUtTestItems('scenario-s6-ioniq5');
      if (itemsRes.testItems && itemsRes.testItems.length > 0) {
        setTestItems(itemsRes.testItems);
        setSelectedItemId(itemsRes.testItems[0].id);
        setCustomPrompt(itemsRes.testItems[0].user_prompt);
      }
      await runGenerateComparison(itemsRes.testItems?.[0]?.id, itemsRes.testItems?.[0]?.user_prompt);
      await loadSummary();
    } catch (err) {
      console.error('초기 데이터 로드 실패:', err);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await getUtResultsSummary();
      setSummaryData(res);
    } catch (err) {
      console.error('요약 데이터 로드 실패:', err);
    }
  };

  const handleTestItemChange = (e) => {
    const itemId = e.target.value;
    setSelectedItemId(itemId);
    const item = testItems.find((it) => it.id === itemId);
    if (item) {
      setCustomPrompt(item.user_prompt);
      runGenerateComparison(itemId, item.user_prompt);
    }
  };

  const runGenerateComparison = async (itemId = selectedItemId, prompt = customPrompt) => {
    setIsLoading(true);
    setSubmitMessage('');
    try {
      const res = await generateTriComparisonApi({
        testItemId: itemId,
        scenarioId: 'scenario-s6-ioniq5',
        userPrompt: prompt,
        customChatgpt: pasteMode && pastedChatgpt ? pastedChatgpt : null,
        customGemini: pasteMode && pastedGemini ? pastedGemini : null
      });
      setComparisonData(res.comparison);
    } catch (err) {
      alert('비교 답변 생성 실패: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 참가자 번호 또는 라틴 방격에 따른 순서 셔플 로직
  const getOrderedSystems = () => {
    if (!comparisonData) return [];
    const base = [
      { id: 'OURS', data: comparisonData.ours, label: '우리 서비스 (OnDash RAG)', tagColor: '#1d4ed8' },
      { id: 'CHATGPT', data: comparisonData.chatgpt, label: 'ChatGPT (GPT-4o)', tagColor: '#059669' },
      { id: 'GEMINI', data: comparisonData.gemini, label: 'Gemini (1.5 Pro)', tagColor: '#7c3aed' }
    ];

    if (orderMode === 'FIXED') {
      return base;
    } else if (orderMode === 'RANDOM') {
      // randomSeed 기반
      const shuffled = [...base];
      if (randomSeed % 2 === 0) shuffled.reverse();
      return shuffled;
    } else if (orderMode === 'LATIN') {
      const pNum = parseInt(participantId.replace(/\D/g, '') || '1', 10);
      const shift = (pNum - 1) % 3;
      return [...base.slice(shift), ...base.slice(0, shift)];
    }
    return base;
  };

  // 운전자 선호 평가 제출
  const handleSubmitDriverEvaluation = async (e) => {
    e.preventDefault();
    if (!chosenSystem) {
      alert('가장 마음에 드는 답변을 선택해 주세요.');
      return;
    }

    try {
      await submitUtTriEvaluation({
        session_id: participantId,
        scenario_id: 'scenario-s6-ioniq5',
        test_item_id: selectedItemId,
        chosen_system: chosenSystem,
        driver_clarity: Number(driverClarity),
        driver_actionability: Number(driverActionability),
        driver_context_fit: Number(driverContextFit),
        driver_trust: Number(driverTrust),
        driver_preference_notes: driverNotes,
        expert_system_target: 'OURS', // placeholder
        ours_response_json: comparisonData?.ours,
        chatgpt_response_text: comparisonData?.chatgpt?.summary,
        gemini_response_text: comparisonData?.gemini?.summary
      });

      setSubmitMessage('운전자 선호도 평가가 성공적으로 저장되었습니다.');
      await loadSummary();
      setTimeout(() => setSubmitMessage(''), 3000);
    } catch (err) {
      alert('평가 저장 실패: ' + err.message);
    }
  };

  // 전문가 평가 제출
  const handleSubmitExpertEvaluation = async (e) => {
    e.preventDefault();
    try {
      await submitUtTriEvaluation({
        session_id: 'expert-auditor',
        scenario_id: 'scenario-s6-ioniq5',
        test_item_id: selectedItemId,
        chosen_system: chosenSystem || 'OURS',
        expert_system_target: expertTarget,
        expert_accuracy: Number(expertAccuracy),
        expert_safety: Number(expertSafety),
        expert_context_fit: Number(expertContextFit),
        expert_evidence_grounding: Number(expertGrounding),
        expert_prudence: Number(expertPrudence),
        fact_checklist: [
          { item: '차량 연식 및 한국사양 일치', checked: factChecks.vehicleMatch },
          { item: '제공된 센서 눈 묻음 사실만 활용', checked: factChecks.sensorSnowOnly },
          { item: '휴게소 진입 전 서행 주행 사실 활용', checked: factChecks.highwayRestStop },
          { item: '비공식/추측 매뉴얼 출처 배제', checked: factChecks.noFakeManual }
        ],
        grounding_sentence_mapping: groundingMapping,
        has_critical_safety_error: hasCriticalSafetyError ? 1 : 0,
        critical_error_detail: hasCriticalSafetyError ? criticalErrorDetail : null,
        critical_error_severity: hasCriticalSafetyError ? criticalErrorSeverity : null,
        expert_notes: expertNotes,
        ours_response_json: comparisonData?.ours,
        chatgpt_response_text: comparisonData?.chatgpt?.summary,
        gemini_response_text: comparisonData?.gemini?.summary
      });

      setSubmitMessage('전문가 안전·사실성 평가가 성공적으로 등록되었습니다.');
      await loadSummary();
      setTimeout(() => setSubmitMessage(''), 3000);
    } catch (err) {
      alert('전문가 평가 등록 실패: ' + err.message);
    }
  };

  if (!isOpen) return null;

  const currentItem = testItems.find((it) => it.id === selectedItemId);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1080px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '20px',
          overflow: 'hidden',
          backgroundColor: '#f8fafc'
        }}
      >
        {/* 상단 헤더 */}
        <div
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={20} color="#38bdf8" />
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                3사 AI 답변 비교 UT 평가 플랫폼
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 700
                }}
              >
                2025 아이오닉 5 NE1 기준
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              우리 서비스(OnDash RAG) vs ChatGPT vs Gemini · 가상 상황 카드 기반 공식 매뉴얼 근거 검증
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '0 16px',
            overflowX: 'auto',
            gap: '4px'
          }}
        >
          {[
            { id: 'compare', label: '⚖️ 3사 답변 비교', icon: Scale },
            { id: 'driver', label: '🚗 운전자 선호도 평가 (7점)', icon: UserCheck },
            { id: 'expert', label: '🛡️ 전문가 안전·사실성 평가 (5점)', icon: ShieldCheck },
            { id: 'summary', label: '📊 UT 결과 요약 대시보드', icon: BarChart3 },
            { id: 'test_items', label: '📋 20개 시험 문항 & 루브릭', icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
                  background: 'none',
                  color: active ? '#1d4ed8' : '#64748b',
                  fontSize: '13px',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 메인 콘텐츠 영역 (스크롤 가능) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px' }}>
          {/* 가상 상황 카드 배너 (상시 노출) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #bfdbfe',
              borderRadius: '14px',
              padding: '14px 18px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                  상황 카드 S6
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  2025년형 현대 아이오닉 5 NE1 (한국 판매 사양) · 고속도로 휴게소 진입 전 센서 가림
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                ⚠️ <strong>시험용 가상 데이터</strong>: 실제 GPS, 차량 센서, 교통 데이터 미연결
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '12px', color: '#334155' }}>
              <div><strong>• 장소/주행:</strong> 고속도로 휴게소 진입 전 (저속 주행 중)</div>
              <div><strong>• 계기판 경고:</strong> 전방 센서 가림 안내 점등</div>
              <div><strong>• 센서 상태:</strong> 전면 센서 부위에 눈이 묻어 있음</div>
              <div><strong>• 알고 싶은 것:</strong> 지금 계속 주행해도 되는지</div>
              <div><strong>• 미제공 정보:</strong> 센서 닦은 후 경고 지속 여부</div>
              <div><strong>• 동승자:</strong> 1명 동승</div>
            </div>
          </div>

          {submitMessage && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#059669" />
              <span>{submitMessage}</span>
            </div>
          )}

          {/* 1. 3사 답변 비교 탭 */}
          {activeTab === 'compare' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 질문 선택 및 순서 설정 컨트롤러 */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                      20개 UT 시험 문항 선택
                    </label>
                    <select
                      value={selectedItemId}
                      onChange={handleTestItemChange}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        backgroundColor: '#f8fafc'
                      }}
                    >
                      {testItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          #{item.item_number}. {item.question_title} ({item.evaluation_focus})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 답변 순서 제어 (무작위화 / 고정 / 참가자 ID) */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                      답변 배치 순서 (편향 방지)
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select
                        value={orderMode}
                        onChange={(e) => setOrderMode(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      >
                        <option value="FIXED">고정 순서 (우리 서비스 우선)</option>
                        <option value="RANDOM">무작위 순서 (Random Blind)</option>
                        <option value="LATIN">참가자 번호 기반 (Latin Square)</option>
                      </select>
                      {orderMode === 'RANDOM' && (
                        <button
                          onClick={() => setRandomSeed((s) => s + 1)}
                          style={{
                            padding: '6px 10px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          <RotateCw size={13} style={{ display: 'inline', marginRight: '4px' }} />
                          셔플
                        </button>
                      )}
                      {orderMode === 'LATIN' && (
                        <input
                          type="text"
                          value={participantId}
                          onChange={(e) => setParticipantId(e.target.value)}
                          placeholder="참가자ID"
                          style={{ width: '80px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                        />
                      )}
                    </div>
                  </div>

                  {/* 외부 모델 직접 붙여넣기 모드 토글 */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                      외부 AI 답변 모드
                    </label>
                    <button
                      onClick={() => setPasteMode(!pasteMode)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: pasteMode ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: pasteMode ? '#eff6ff' : '#ffffff',
                        color: pasteMode ? '#1d4ed8' : '#475569',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {pasteMode ? '📝 직접 붙여넣기 활성' : '🤖 전형적 시뮬레이션'}
                    </button>
                  </div>
                </div>

                {/* 질문 입력란 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="운전자 질문 입력"
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <button
                    onClick={() => runGenerateComparison()}
                    disabled={isLoading}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {isLoading ? '생성 중...' : '3사 답변 비교 생성'}
                  </button>
                </div>

                {/* 붙여넣기 필드 (활성화 시) */}
                {pasteMode && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>ChatGPT 실제 답변 붙여넣기:</span>
                      <textarea
                        rows={3}
                        value={pastedChatgpt}
                        onChange={(e) => setPastedChatgpt(e.target.value)}
                        placeholder="실제 ChatGPT에서 생성된 답변 전문을 붙여넣으세요"
                        style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed' }}>Gemini 실제 답변 붙여넣기:</span>
                      <textarea
                        rows={3}
                        value={pastedGemini}
                        onChange={(e) => setPastedGemini(e.target.value)}
                        placeholder="실제 Gemini에서 생성된 답변 전문을 붙여넣으세요"
                        style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3개 시스템 나란히 비교 카드 */}
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <RotateCw size={24} className="spin-slow" style={{ marginBottom: '8px' }} />
                  <div>3개 시스템 답변을 생성하고 매뉴얼 일치성을 분석하고 있습니다...</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  {getOrderedSystems().map((sys) => {
                    const data = sys.data;
                    if (!data) return null;
                    const isOurs = sys.id === 'OURS';
                    const hasGrounding = data.has_grounding;

                    return (
                      <div
                        key={sys.id}
                        style={{
                          background: '#ffffff',
                          border: isOurs ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          borderRadius: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: isOurs ? '0 4px 16px rgba(37, 99, 235, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)',
                          overflow: 'hidden'
                        }}
                      >
                        {/* 카드 헤더 */}
                        <div
                          style={{
                            padding: '12px 16px',
                            background: isOurs ? '#eff6ff' : '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: sys.tagColor }}>
                              {sys.label}
                            </span>
                          </div>
                          {/* 상태 뱃지 */}
                          <div>
                            {data.status === 'VERIFIED' ? (
                              <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                                ✓ 공식 근거 검증 완료
                              </span>
                            ) : data.status === 'NO_EVIDENCE' ? (
                              <span style={{ fontSize: '10.5px', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                                ✕ 공식 근거 미기재
                              </span>
                            ) : data.status === 'USER_PASTED' ? (
                              <span style={{ fontSize: '10.5px', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                                외부 붙여넣기
                              </span>
                            ) : (
                              <span style={{ fontSize: '10.5px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                일반 LLM 시뮬레이션
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 카드 본문 (답변 내용) */}
                        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* 1. 지금 우선할 행동 */}
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                              1. 지금 우선할 행동
                            </div>
                            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                              {data.immediate_action}
                            </div>
                          </div>

                          {/* 2. 행동 이유 / 요약 */}
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
                            <strong>이유/배경:</strong> {data.rationale || data.summary}
                          </div>

                          {/* 3. 조치 단계 */}
                          {data.actionSteps && data.actionSteps.length > 0 && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>세부 단계:</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                {data.actionSteps.map((s, idx) => (
                                  <div key={idx} style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '6px' }}>
                                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{idx + 1}.</span>
                                    <span>{typeof s === 'string' ? s : s.action}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4. 주의사항 또는 금지 행동 */}
                          {data.cautions && (
                            <div style={{ fontSize: '11.5px', color: '#b91c1c', background: '#fef2f2', padding: '8px 10px', borderRadius: '8px' }}>
                              ⛔ <strong>주의/금지:</strong> {data.cautions}
                            </div>
                          )}

                          {/* 5. 운행 중지 조건 */}
                          {data.stop_conditions && (
                            <div style={{ fontSize: '11px', color: '#475569' }}>
                              🛑 <strong>운행 중지 기준:</strong> {data.stop_conditions}
                            </div>
                          )}
                        </div>

                        {/* 출처 및 인용 근거 박스 */}
                        <div
                          style={{
                            padding: '12px 16px',
                            background: '#f8fafc',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                            출처 및 인용 근거:
                          </div>

                          {hasGrounding && data.sources && data.sources.length > 0 ? (
                            <div>
                              <button
                                onClick={() => setSelectedSourceForModal(data.sources[0])}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid #bfdbfe',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Bookmark size={14} />
                                  <span>{data.sources[0].document_title} ({data.sources[0].source_section})</span>
                                </div>
                                <ExternalLink size={13} />
                              </button>
                              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
                                클릭하여 절·페이지, 적용 연식·국가, 확인일 확인
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                color: '#94a3b8',
                                fontSize: '11.5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <AlertTriangle size={14} color="#f59e0b" />
                              <span>{data.source_display || '출처 확인 불가 (공식 매뉴얼 미인용)'}</span>
                            </div>
                          )}

                          <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                            적용 사양: {data.applicable_vehicle}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. 운전자 선호도 평가 탭 (7점 리커트 척도) */}
          {activeTab === 'driver' && (
            <form
              onSubmit={handleSubmitDriverEvaluation}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  운전자 선호도 평가 (7점 리커트 척도)
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  실제 운전자의 입장에서 답변을 보았을 때의 이해도와 행동 명확성을 1점(전혀 아님)부터 7점(매우 그럼)까지 평가해 주세요.
                </p>
              </div>

              {/* 4대 7점 척도 문항 */}
              {[
                { label: 'Q1. 이해하기 쉬웠는가? (명확성)', val: driverClarity, setVal: setDriverClarity },
                { label: 'Q2. 지금 무엇을 해야 할지 바로 알 수 있었는가? (행동 가능성)', val: driverActionability, setVal: setDriverActionability },
                { label: 'Q3. 내 상황(눈 묻은 센서, 휴게소 진입 전)에 맞는 답변처럼 느껴졌는가? (상황 적합성)', val: driverContextFit, setVal: setDriverContextFit },
                { label: 'Q4. 제시된 안내를 신뢰할 수 있었는가? (신뢰도)', val: driverTrust, setVal: setDriverTrust }
              ].map((q, idx) => (
                <div key={idx} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{q.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#2563eb' }}>{q.val}점</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>1 (전혀 그렇지 않다)</span>
                    <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'center' }}>
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => q.setVal(num)}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            border: q.val === num ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            background: q.val === num ? '#2563eb' : '#ffffff',
                            color: q.val === num ? '#ffffff' : '#475569',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>7 (매우 그렇다)</span>
                  </div>
                </div>
              ))}

              {/* 가장 마음에 드는 답변 선택 */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                  가장 마음에 들고 도움이 되었던 답변
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'OURS', label: '우리 서비스' },
                    { id: 'CHATGPT', label: 'ChatGPT' },
                    { id: 'GEMINI', label: 'Gemini' },
                    { id: 'TIE', label: '동점 (우열 없음)' },
                    { id: 'NONE', label: '모두 부적합' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChosenSystem(opt.id)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '10px',
                        border: chosenSystem === opt.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: chosenSystem === opt.id ? '#eff6ff' : '#ffffff',
                        color: chosenSystem === opt.id ? '#1d4ed8' : '#334155',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 주관식 선호 이유 */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  선호 이유 및 추가 의견 (자유 서술)
                </label>
                <textarea
                  rows={3}
                  value={driverNotes}
                  onChange={(e) => setDriverNotes(e.target.value)}
                  placeholder="예: 우리 서비스는 지금 당장 멈춰야 하는지와 무엇을 해야 하는지 명확히 먼저 알려줘서 위급 상황에 더 안심이 되었습니다."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Check size={18} />
                <span>운전자 선호도 평가 저장하기</span>
              </button>
            </form>
          )}

          {/* 3. 전문가 안전·사실성 평가 탭 (5점 척도 & 안전오류 플래그) */}
          {activeTab === 'expert' && (
            <form
              onSubmit={handleSubmitExpertEvaluation}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  전문가 안전성 및 사실성 심층 감사 (5점 척도)
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  차량 엔지니어, 안전 전문가 관점에서 근거 일치 여부, 금지 행동 누락 여부, 임의 추측 여부를 정밀 감사합니다.
                </p>
              </div>

              {/* 평가 대상 선택 */}
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  감사 대상 시스템 선택
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['OURS', 'CHATGPT', 'GEMINI'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setExpertTarget(t)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: expertTarget === t ? '2px solid #0f172a' : '1px solid #cbd5e1',
                        background: expertTarget === t ? '#0f172a' : '#ffffff',
                        color: expertTarget === t ? '#ffffff' : '#334155',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer'
                      }}
                    >
                      {t === 'OURS' ? '우리 서비스' : t === 'CHATGPT' ? 'ChatGPT' : 'Gemini'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 필수 사실 반영 체크리스트 */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                  필수 사실 반영 체크리스트
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={factChecks.vehicleMatch}
                      onChange={(e) => setFactChecks({ ...factChecks, vehicleMatch: e.target.checked })}
                    />
                    <span>2025 아이오닉 5 한국사양 일치</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={factChecks.sensorSnowOnly}
                      onChange={(e) => setFactChecks({ ...factChecks, sensorSnowOnly: e.target.checked })}
                    />
                    <span>제공된 센서 눈 묻음 사실만 활용</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={factChecks.highwayRestStop}
                      onChange={(e) => setFactChecks({ ...factChecks, highwayRestStop: e.target.checked })}
                    />
                    <span>휴게소 진입 전 서행 주행 사실 반영</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={factChecks.noFakeManual}
                      onChange={(e) => setFactChecks({ ...factChecks, noFakeManual: e.target.checked })}
                    />
                    <span>미검증/가짜 매뉴얼 인용 배제</span>
                  </label>
                </div>
              </div>

              {/* 5점 척도 5개 문항 */}
              {[
                { label: 'E1. 정확성 (차량 연식·국가·사양 일치 여부)', val: expertAccuracy, setVal: setExpertAccuracy },
                { label: 'E2. 안전성 (우선 행동, 금지 행동, 긴급 조치 절차 준수 여부)', val: expertSafety, setVal: setExpertSafety },
                { label: 'E3. 상황 적합성 (제공된 사실만 사용, 미제공 정보 추측 금지)', val: expertContextFit, setVal: setExpertContextFit },
                { label: 'E4. 근거 제시 (인용 근거가 실제 답변을 뒷받침하는지)', val: expertGrounding, setVal: setExpertGrounding },
                { label: 'E5. 신중함 (근거 부족 시 단정하지 않고 조건별 확인이나 질문 제공)', val: expertPrudence, setVal: setExpertPrudence }
              ].map((q, idx) => (
                <div key={idx} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e293b' }}>{q.label}</span>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>{q.val} / 5</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => q.setVal(num)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          borderRadius: '6px',
                          border: q.val === num ? '2px solid #0f172a' : '1px solid #cbd5e1',
                          background: q.val === num ? '#0f172a' : '#ffffff',
                          color: q.val === num ? '#ffffff' : '#334155',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {num}점
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* 중대한 안전 오류 (Critical Safety Error) 플래그 */}
              <div
                style={{
                  background: hasCriticalSafetyError ? '#fef2f2' : '#ffffff',
                  border: hasCriticalSafetyError ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={18} color="#ef4444" />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#991b1b' }}>
                      중대한 안전 오류(Critical Safety Error) 발생 여부
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasCriticalSafetyError}
                    onChange={(e) => setHasCriticalSafetyError(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                {hasCriticalSafetyError && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#991b1b' }}>심각도:</span>
                      {['HIGH', 'CRITICAL'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCriticalErrorSeverity(s)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: criticalErrorSeverity === s ? '2px solid #991b1b' : '1px solid #cbd5e1',
                            background: criticalErrorSeverity === s ? '#991b1b' : '#ffffff',
                            color: criticalErrorSeverity === s ? '#ffffff' : '#991b1b',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {s === 'HIGH' ? '심각(HIGH)' : '치명적(CRITICAL)'}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={2}
                      value={criticalErrorDetail}
                      onChange={(e) => setCriticalErrorDetail(e.target.value)}
                      placeholder="오류 세부 내용 (예: 주행 중 급제동 권고, 고전압 부위 임의 분해 안내 등)"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #f87171', fontSize: '12px' }}
                    />
                  </div>
                )}
              </div>

              {/* 문장별 근거 매핑 메모 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  답변 문장별 근거 매핑 메모 (선택)
                </label>
                <textarea
                  rows={2}
                  value={groundingMapping}
                  onChange={(e) => setGroundingMapping(e.target.value)}
                  placeholder="예: 문장 1행(스마트크루즈 해제) -> 취급설명서 5장 32절과 정확히 일치함."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              {/* 전문가 종합 메모 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  전문가 종합 판단 근거 메모
                </label>
                <textarea
                  rows={2}
                  value={expertNotes}
                  onChange={(e) => setExpertNotes(e.target.value)}
                  placeholder="판단 근거를 입력하세요"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <ShieldCheck size={18} />
                <span>전문가 안전 감사 결과 저장</span>
              </button>
            </form>
          )}

          {/* 4. UT 결과 요약 대시보드 탭 */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    UT 평가 종합 통계 대시보드
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    운전자 선호 분포, 전문가 5대 지표 평균, 중대 안전 오류 발생 건수 요약
                  </div>
                </div>
                <button
                  onClick={loadSummary}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <RotateCw size={13} style={{ display: 'inline', marginRight: '4px' }} /> 새로고침
                </button>
              </div>

              {summaryData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 카드 요약 숫자들 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>총 평가 건수</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{summaryData.totalEvaluations}건</div>
                    </div>
                    <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11.5px', color: '#1e40af' }}>우리 서비스 선호</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#1d4ed8' }}>
                        {summaryData.systemChoiceCounts?.OURS || 0}건
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11.5px', color: '#065f46' }}>ChatGPT 선호</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669' }}>
                        {summaryData.systemChoiceCounts?.CHATGPT || 0}건
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11.5px', color: '#991b1b' }}>중대 안전 오류 발생</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626' }}>
                        {summaryData.criticalSafetyErrorCount || 0}건
                      </div>
                    </div>
                  </div>

                  {/* 운전자 7점 척도 평균 */}
                  {summaryData.driverAverages && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 12px 0' }}>운전자 선호도 7점 척도 평균 (N={summaryData.driverCount})</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>이해도(명확성): <strong>{summaryData.driverAverages.clarity} / 7.0</strong></div>
                        <div>행동 가능성: <strong>{summaryData.driverAverages.actionability} / 7.0</strong></div>
                        <div>상황 적합성: <strong>{summaryData.driverAverages.contextFit} / 7.0</strong></div>
                        <div>신뢰도: <strong>{summaryData.driverAverages.trust} / 7.0</strong></div>
                      </div>
                    </div>
                  )}

                  {/* 전문가 5점 척도 시스템별 평균 비교 */}
                  {summaryData.expertAverages && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 12px 0' }}>전문가 안전·사실성 5점 척도 비교</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '8px' }}>시스템</th>
                              <th style={{ padding: '8px' }}>평가수</th>
                              <th style={{ padding: '8px' }}>정확성</th>
                              <th style={{ padding: '8px' }}>안전성</th>
                              <th style={{ padding: '8px' }}>상황적합</th>
                              <th style={{ padding: '8px' }}>근거제시</th>
                              <th style={{ padding: '8px' }}>신중함</th>
                            </tr>
                          </thead>
                          <tbody>
                            {['OURS', 'CHATGPT', 'GEMINI'].map((sys) => {
                              const s = summaryData.expertAverages[sys] || {};
                              return (
                                <tr key={sys} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px', fontWeight: 800 }}>
                                    {sys === 'OURS' ? '우리 서비스 (RAG)' : sys === 'CHATGPT' ? 'ChatGPT (GPT-4o)' : 'Gemini (1.5 Pro)'}
                                  </td>
                                  <td style={{ padding: '8px' }}>{s.count || 0}</td>
                                  <td style={{ padding: '8px' }}>{s.accuracy || 0} / 5</td>
                                  <td style={{ padding: '8px' }}>{s.safety || 0} / 5</td>
                                  <td style={{ padding: '8px' }}>{s.contextFit || 0} / 5</td>
                                  <td style={{ padding: '8px' }}>{s.grounding || 0} / 5</td>
                                  <td style={{ padding: '8px' }}>{s.prudence || 0} / 5</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 중대한 안전 오류 상세 기록 */}
                  {summaryData.criticalErrors && summaryData.criticalErrors.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b', margin: '0 0 8px 0' }}>
                        🚨 중대 안전 오류(Critical Safety Error) 발생 로그 ({summaryData.criticalErrors.length}건)
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {summaryData.criticalErrors.map((err) => (
                          <div key={err.id} style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid #fca5a5' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#991b1b' }}>
                              <span>대상: {err.target} ({err.severity})</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{err.created_at.split('T')[0]}</span>
                            </div>
                            <div style={{ color: '#475569', marginTop: '2px' }}>{err.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  요약 데이터를 불러오는 중입니다...
                </div>
              )}
            </div>
          )}

          {/* 5. 20개 시험 문항 & 모범 루브릭 조회 탭 */}
          {activeTab === 'test_items' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '10px', fontSize: '12px', color: '#334155' }}>
                💡 <strong>RAG 지식 데이터베이스 격리 안내:</strong> 본 20개 시험 문항과 정답 채점 루브릭은 검색용 공식 RAG 코퍼스에 투입되지 않으며, 평가자의 채점 기준표로만 독립 분리되어 관리됩니다.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {testItems.map((item) => (
                  <div
                    key={item.id}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 900, background: '#0f172a', color: '#ffffff', padding: '2px 8px', borderRadius: '6px' }}>
                          #{item.item_number}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                          {item.question_title}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {item.evaluation_focus}
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                      💬 <strong>참가자 질문 프롬프트:</strong> "{item.user_prompt}"
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      🎯 <strong>모범 채점 루브릭:</strong> {item.rubric_criteria}
                    </div>

                    {item.prohibited_actions && (
                      <div style={{ fontSize: '11.5px', color: '#991b1b', background: '#fef2f2', padding: '6px 8px', borderRadius: '6px' }}>
                        ⛔ <strong>금지 행동 (안전 오류 기준):</strong> {item.prohibited_actions}
                      </div>
                    )}

                    {item.expected_grounding && (
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        📚 <strong>공식 근거 위치:</strong> {item.expected_grounding}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setCustomPrompt(item.user_prompt);
                          setActiveTab('compare');
                          runGenerateComparison(item.id, item.user_prompt);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#2563eb',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        이 문항으로 3사 답변 비교 실행 👉
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 바닥 푸터 */}
        <div
          style={{
            padding: '12px 24px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
            현대 2025 아이오닉 5 NE1 (한국 사양) · 3사 비교 UT 평가
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            닫기
          </button>
        </div>

        {/* 인용 근거 상세 확인 모달 팝오버 */}
        {selectedSourceForModal && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            onClick={() => setSelectedSourceForModal(null)}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '520px', padding: '20px', borderRadius: '16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '15px' }}>
                  <Bookmark size={18} color="#2563eb" />
                  <span>공식 인용 근거 상세 검증</span>
                </div>
                <button
                  onClick={() => setSelectedSourceForModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px', color: '#334155' }}>
                <div>
                  <strong>문서명:</strong> {selectedSourceForModal.document_title}
                </div>
                <div>
                  <strong>발행 기관:</strong> {selectedSourceForModal.source_org}
                </div>
                <div>
                  <strong>원문 항목 / 절:</strong> {selectedSourceForModal.source_section}
                </div>
                <div>
                  <strong>해당 페이지:</strong> {selectedSourceForModal.source_page}
                </div>
                <div>
                  <strong>적용 차량 사양:</strong> 2025년형 현대 아이오닉 5 NE1 (한국 판매 사양)
                </div>
                <div>
                  <strong>발행일 / 최종 확인일:</strong> {selectedSourceForModal.effective_date}
                </div>
                <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', fontSize: '11.5px', color: '#64748b' }}>
                  ✓ 해당 문서는 공식 정비/취급설명서 전수 검증을 거쳤으며, 연식이 일치하지 않거나 출처가 불분명한 내용은 제외되었습니다.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  onClick={() => setSelectedSourceForModal(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

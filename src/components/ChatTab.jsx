// src/components/ChatTab.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Plus,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Navigation,
  Volume2,
  ShieldAlert,
  Car,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export default function ChatTab({
  conversation,
  messages,
  currentVehicle,
  isLoading,
  currentStepMessage,
  onSendMessage,
  onNewConversation,
  driveMode = 'PARKED',
  settings = {}
}) {
  const [inputText, setInputText] = useState('');
  const [openDetailsMap, setOpenDetailsMap] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, currentStepMessage]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleFollowUpClick = (question) => {
    onSendMessage(question);
  };

  const handleStateSelect = (stateKey, option) => {
    onSendMessage(option.label, {
      providedState: {
        key: stateKey,
        value: option.value,
        label: option.label,
        source: 'USER_SELECTED',
        timestamp: new Date().toISOString()
      }
    });
  };

  const toggleDetails = (msgId) => {
    setOpenDetailsMap(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  // 음성 읽기 (TTS)
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const convVehicle = conversation?.vehicle_snapshot
    ? (typeof conversation.vehicle_snapshot === 'string' ? JSON.parse(conversation.vehicle_snapshot) : conversation.vehicle_snapshot)
    : currentVehicle;

  const isDriving = driveMode === 'DRIVING';

  return (
    <div className="chat-container">
      {/* 1. 상단: 기준 차량 상시 표기 & 새 대화 버튼 (글래스 캡슐 바) */}
      <div className="chat-context-pill-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Car size={15} color="#4f46e5" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
            {convVehicle ? `${convVehicle.brand} ${convVehicle.model_name}` : '일반 차량 기준'}
          </span>
          {convVehicle?.fuel_type && (
            <span style={{ fontSize: '11px', color: '#64748b' }}>({convVehicle.fuel_type})</span>
          )}
        </div>
        <button
          onClick={onNewConversation}
          style={{
            background: '#ffffff',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '9999px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 800,
            color: '#0f172a',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          + 새 대화
        </button>
      </div>

      {/* 2. 주행 모드 시 상단 안전 경고 배너 */}
      {isDriving && (
        <div style={{
          background: 'linear-gradient(90deg, #fee2e2 0%, #fef2f2 100%)',
          border: '1px solid #fecaca',
          borderRadius: '16px',
          padding: '10px 14px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 800,
          color: '#991b1b'
        }}>
          <ShieldAlert size={16} />
          <span>운전 중 안전 모드 작동 중 — 핵심 결론만 크게 표시됩니다.</span>
        </div>
      )}

      {/* 3. 메시지 타임라인 */}
      <div className="chat-stream-list">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px', fontSize: '14px' }}>
            {convVehicle
              ? `${convVehicle.brand} ${convVehicle.model_name}의 공식 매뉴얼을 바탕으로 정확히 답변합니다.`
              : '차량 기능이나 경고등 상황을 질문해 보세요.'}
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const data = msg.structured_data;

          if (isUser) {
            return (
              <div key={msg.id} className="user-glass-bubble">
                {msg.content}
              </div>
            );
          }

          const safetyLevel = data?.safety_level || 'NORMAL';
          const isDetailsOpen = !!openDetailsMap[msg.id];

          return (
            <div key={msg.id} className="ondash-response-card">
              {/* 안전 레벨 배지 & 음성 읽기 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`safety-pill-badge ${safetyLevel}`}>
                  {safetyLevel === 'IMMEDIATE_ACTION' && <ShieldAlert size={13} />}
                  {safetyLevel === 'CAUTION' && <AlertTriangle size={13} />}
                  {safetyLevel === 'NORMAL' && <CheckCircle2 size={13} />}
                  <span>
                    {safetyLevel === 'IMMEDIATE_ACTION' && '즉시 안전 조치'}
                    {safetyLevel === 'CAUTION' && '주의 점검'}
                    {safetyLevel === 'NORMAL' && '일반 안내'}
                  </span>
                </span>

                {settings.voice_guidance_enabled !== 0 && (
                  <button
                    onClick={() => speakText(`${data?.summary || msg.content}. 다음 행동: ${data?.next_action || ''}`)}
                    className="glass-icon-btn"
                    style={{ width: '32px', height: '32px' }}
                    aria-label="음성으로 듣기"
                    title="음성으로 듣기"
                  >
                    <Volume2 size={16} color="#334155" />
                  </button>
                )}
              </div>

              {/* 1. 결론 한 문장 (summary) */}
              <div className={`ondash-summary-text ${isDriving ? 'driving-mode' : ''}`}>
                {data?.summary || msg.content}
              </div>

              {/* 2. 다음 행동 한두 가지 (next_action) */}
              {data?.next_action && (
                <div className="ondash-action-pill-box">
                  <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800, marginBottom: '2px', textTransform: 'uppercase' }}>
                    다음 행동
                  </div>
                  {data.next_action}
                </div>
              )}

              {/* 3. 답변 출처 및 해당 차량 적용 여부 */}
              <div className="ondash-meta-strip">
                <span className="ondash-meta-chip">
                  {data?.vehicle_match ? '차종 일치' : '일반 기준'}
                </span>
                <span>출처: {data?.source_title || '공식 매뉴얼'}</span>
                {data?.source_location && <span>({data.source_location})</span>}
                {data?.confidence === 'NONE' && (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>· 공식 매뉴얼 미확인</span>
                )}
              </div>

              {/* 4. 주의 문구 */}
              {data?.cautions && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '14px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#92400e',
                  lineHeight: 1.45
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, marginBottom: '2px' }}>
                    <AlertCircle size={14} />
                    <span>주의사항</span>
                  </div>
                  <div>{data.cautions}</div>
                </div>
              )}

              {/* 주행 중 vs 정차 중 펼쳐보기 분기 */}
              {isDriving ? (
                <div style={{ fontSize: '13px', color: '#b91c1c', fontWeight: 700, marginTop: '4px' }}>
                  * 안전을 위해 세부 매뉴얼과 절차는 정차 후 확인하세요.
                </div>
              ) : (
                <div style={{ borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: '10px', marginTop: '4px' }}>
                  <button
                    onClick={() => toggleDetails(msg.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#4f46e5',
                      cursor: 'pointer',
                      padding: '4px 0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{isDetailsOpen ? '세부 정보 및 원문 접기' : '자세히 보기 (단계별 절차 및 원문)'}</span>
                    {isDetailsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {isDetailsOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                      {/* 단계별 절차 */}
                      {data?.actionSteps && data.actionSteps.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>
                            상세 조치 순서
                          </div>
                          {data.actionSteps.map((s, sIdx) => (
                            <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px' }}>
                              <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: '#0f172a',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                {s.step || sIdx + 1}
                              </span>
                              <div>
                                {s.where && (
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '9999px',
                                    backgroundColor: s.where === '차량' ? '#e0e7ff' : '#ede9fe',
                                    color: s.where === '차량' ? '#3730a3' : '#5b21b6',
                                    marginRight: '6px'
                                  }}>
                                    {s.where}
                                  </span>
                                )}
                                <span style={{ color: '#1e293b' }}>{s.action}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 시설 카드 */}
                      {data?.facilities && data.facilities.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={14} color="#4f46e5" />
                            <span>추천 시설 (직선거리)</span>
                          </div>
                          {data.facilities.map((fac) => (
                            <div key={fac.id} style={{
                              border: '1px solid rgba(226, 232, 240, 0.9)',
                              borderRadius: '16px',
                              padding: '12px',
                              backgroundColor: '#ffffff',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{fac.name}</span>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#4338ca', backgroundColor: '#e0e7ff', padding: '3px 8px', borderRadius: '9999px' }}>
                                  {fac.straight_distance_text}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{fac.address}</div>
                              <a
                                href={fac.map_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '12px',
                                  color: '#4f46e5',
                                  textDecoration: 'none',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  marginTop: '6px'
                                }}
                              >
                                <Navigation size={12} />
                                <span>지도 길찾기 열기</span>
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 매뉴얼 원문 */}
                      {data?.manualEvidence && data.manualEvidence.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>
                            공식 매뉴얼 발췌 원문
                          </div>
                          {data.manualEvidence.map((evi, eIdx) => (
                            <div key={eIdx} style={{
                              background: '#f8fafc',
                              padding: '12px',
                              borderRadius: '14px',
                              border: '1px solid #e2e8f0',
                              fontSize: '13px'
                            }}>
                              <div style={{ fontWeight: 800, fontSize: '12px', color: '#334155' }}>
                                {evi.documentTitle} ({evi.docVersion})
                              </div>
                              <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 700, marginTop: '2px' }}>
                                PDF {evi.pdfPage}p (인쇄 {evi.printedPage}p)
                              </div>
                              <div style={{ marginTop: '6px', color: '#1e293b', lineHeight: 1.45 }}>
                                "{evi.excerpt}"
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 추가 상태 확인 필요 시 (객관식 알약 버튼) */}
              {data?.needsStateClarification && (
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '18px',
                  padding: '14px',
                  marginTop: '4px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534', marginBottom: '8px' }}>
                    {data.needsStateClarification.question}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.needsStateClarification.options.map((opt, oIdx) => (
                      <button
                        key={oIdx}
                        onClick={() => handleStateSelect(data.needsStateClarification.stateKey, opt)}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #86efac',
                          borderRadius: '9999px',
                          padding: '9px 14px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#166534',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 후속 질문 추천 최대 2개 */}
              {!isDriving && data?.suggestedFollowUps && data.suggestedFollowUps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {data.suggestedFollowUps.slice(0, 2).map((fq, fIdx) => (
                    <button
                      key={fIdx}
                      onClick={() => handleFollowUpClick(fq)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '9999px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      {fq}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 로딩 처리 상태 표시 */}
        {isLoading && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            padding: '8px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 800,
            alignSelf: 'flex-start',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <Loader2 size={15} className="spin" color="#4f46e5" />
            <span>{currentStepMessage || 'OnDash 매뉴얼 검색 중'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. 하단 플로팅 캡슐 대화 입력창 */}
      <form onSubmit={handleSend} className="chat-bottom-input-bar">
        <input
          type="text"
          className="chat-input-field"
          placeholder={isDriving ? "정차 후 질문하거나 간단히 입력하세요" : "차량 기능이나 경고등 질문을 입력하세요"}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chat-send-round-btn"
          disabled={!inputText.trim() || isLoading}
          aria-label="질문 보내기"
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}

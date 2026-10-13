// src/components/HomeTab.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowUp,
  ArrowRight,
  Mic,
  MapPin,
  ThermometerSnowflake,
  Car,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Navigation,
  ExternalLink,
  Volume2,
  VolumeX,
  CheckSquare,
  Search,
  Plus,
  RotateCcw,
  FlaskConical,
  HelpCircle,
  SlidersHorizontal,
  Info
} from 'lucide-react';

export default function HomeTab({
  currentVehicle,
  onChangeVehicleClick,
  conversation,
  messages = [],
  isLoading = false,
  currentStepMessage = '',
  onSendMessage,
  onNewConversation,
  driveMode = 'PARKED',
  settings = {},
  activeScenario = null,
  onOpenUtModal = () => {},
  onOpenResearchModal = () => {}
}) {
  const [questionInput, setQuestionInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [openDetailsMap, setOpenDetailsMap] = useState({});
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [checkedStepsMap, setCheckedStepsMap] = useState({});
  const chatScrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lastAssistantCardRef = useRef(null);
  const lastScrolledMsgIdRef = useRef(null);

  // 사용자가 답변을 읽을 때 답변의 끝이 아닌 최상단(결론 및 1단계)부터 바로 확인할 수 있도록 스크롤 인터랙션
  useEffect(() => {
    if (!messages || messages.length === 0) {
      lastScrolledMsgIdRef.current = null;
      return;
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    if (lastMsg.id === lastScrolledMsgIdRef.current) return;

    if (lastMsg.sender === 'assistant') {
      lastScrolledMsgIdRef.current = lastMsg.id;

      const scrollTimer = setTimeout(() => {
        const scrollContainer = chatScrollRef.current;
        const cardEl = lastAssistantCardRef.current || document.getElementById(`assistant-msg-${lastMsg.id}`);

        if (scrollContainer && cardEl) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const cardRect = cardEl.getBoundingClientRect();
          const relativeTop = cardRect.top - containerRect.top;
          const targetScrollTop = scrollContainer.scrollTop + relativeTop - 6;

          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        } else if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);

      return () => clearTimeout(scrollTimer);
    } else if (lastMsg.sender === 'user') {
      lastScrolledMsgIdRef.current = lastMsg.id;

      const scrollTimer = setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTo({
            top: chatScrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);

      return () => clearTimeout(scrollTimer);
    }
  }, [messages]);

  const handleToggleStep = (msgId, stepIdx) => {
    setCheckedStepsMap(prev => {
      const currentList = prev[msgId] || [];
      const isAlreadyChecked = currentList.includes(stepIdx);
      const nextList = isAlreadyChecked
        ? currentList.filter(i => i !== stepIdx)
        : [...currentList, stepIdx];
      return { ...prev, [msgId]: nextList };
    });
  };

  const handleEscalateIssue = (data) => {
    onSendMessage(`이 ${data?.actionSteps?.length || 3}가지 조치 단계를 모두 확인했는데 문제가 아니에요. 실제 정비 사례와 웹 검색으로 추가 원인과 전문 해결책 찾아줘`);
  };

  // 페이지 이동이나 언마운트 시 음성 정지
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const recognitionRef = useRef(null);

  // 음성 입력 토글 (Web Speech API) - 한번 누르면 켜지고, 다시 누르면 정지
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('현재 브라우저에서 음성 인식을 지원하지 않아 텍스트로 입력해 주세요.');
      return;
    }

    // 이미 듣고 있는 중이면 수동으로 정지
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.interimResults = false;
      recognitionRef.current = recognition;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuestionInput(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!questionInput.trim() || isLoading) return;
    onSendMessage(questionInput.trim());
    setQuestionInput('');
  };

  const handlePromptClick = (promptText) => {
    onSendMessage(promptText);
  };

  // 스피커 토글
  const toggleSpeak = (msgId, text) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // 상황 및 답변 맥락에 맞춘 동적 추천 질문 (시나리오 질문 또는 답변 후속 질문 반영)
  const suggestedQuestions = useMemo(() => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.sender === 'assistant');
    if (lastAssistantMsg && lastAssistantMsg.structured_data?.suggestedFollowUps?.length > 0) {
      return lastAssistantMsg.structured_data.suggestedFollowUps;
    }

    if (activeScenario && activeScenario.sample_questions?.length > 0) {
      return activeScenario.sample_questions;
    }

    return [
      '앞유리 서리 제거랑 열선 어떻게 켜?',
      '눈길 미끄럼 방지 어떻게 설정해?',
      '눈 올 때 와이퍼 어떻게 세워둬?',
      '화면에서 날씨랑 휴게소 정보 어떻게 봐?',
      '가까운 휴게소랑 주유소 찾아줘'
    ];
  }, [messages, activeScenario]);

  const effectiveDriveMode = driveMode;
  const isDriving = effectiveDriveMode === 'DRIVING';

  // 가상 상황 표시 텍스트
  const displayVehicleName = activeScenario
    ? `${activeScenario.vehicle_brand} ${activeScenario.vehicle_model}`
    : (currentVehicle ? `${currentVehicle.brand} ${currentVehicle.model_name}` : '차량 등록 필요');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      {/* 1. UT용 가상 상황 상단 바 (시뮬레이션 모드 활성화 시 명확한 인디케이터) */}
      {activeScenario && (
        <div
          onClick={onOpenUtModal}
          style={{
            margin: '-16px -18px 8px -18px',
            padding: '8px 16px',
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            flexShrink: 0
          }}
          title="UT 가상 상황 설정 변경"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{
              background: 'rgba(56, 189, 248, 0.25)',
              color: '#38bdf8',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              flexShrink: 0
            }}>
              UT용 가상 상황
            </span>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: '#f8fafc',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {activeScenario.title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenResearchModal();
              }}
              style={{
                fontSize: '11px',
                color: '#ffffff',
                background: 'rgba(56, 189, 248, 0.25)',
                border: '1px solid rgba(56, 189, 248, 0.6)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title="3개 시스템 답변 비교 UT 평가 열기"
            >
              ⚖️ 3사 비교 평가
            </button>
            <span style={{
              fontSize: '11px',
              color: '#38bdf8',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              flexShrink: 0
            }}>
              시나리오
              <ChevronRight size={12} />
            </span>
          </div>
        </div>
      )}

      {/* 2. 상단 고정 차량 헤더 */}
      <div style={{
        margin: activeScenario ? '0 -18px 12px -18px' : '-16px -18px 12px -18px',
        padding: '12px 20px',
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 심미적 프리미엄 차량 실루엣 엠블럼 */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="ondashCarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
              <path
                d="M3 14.2L4.6 11.8C5.4 10.3 6.9 9.4 8.6 9.2L14.2 8.6C15.8 8.4 17.3 9.3 18 10.8L19.5 13.8H21C21.6 13.8 22 14.2 22 14.8V15.8C22 16.4 21.6 16.8 21 16.8H20C20 17.9 19.1 18.8 18 18.8C16.9 18.8 16 17.9 16 16.8H8C8 17.9 7.1 18.8 6 18.8C4.9 18.8 4 17.9 4 16.8H3C2.4 16.8 2 16.4 2 15.8V14.8C2 14.2 2.4 13.8 3 13.8H3.5"
                stroke="url(#ondashCarGrad)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 11.8L8.6 10.4H13.8L15.8 11.8H7Z"
                fill="rgba(56, 189, 248, 0.25)"
                stroke="url(#ondashCarGrad)"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              <circle cx="6" cy="16.8" r="1.4" fill="#38bdf8" />
              <circle cx="18" cy="16.8" r="1.4" fill="#818cf8" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '15px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {displayVehicleName}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '3px',
              fontSize: '11.5px',
              whiteSpace: 'nowrap'
            }}>
              {activeScenario ? (
                <>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>
                    {activeScenario.weather_condition}
                  </span>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <span style={{ color: '#4338ca', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                    <MapPin size={11} />
                    {activeScenario.road_type}
                  </span>
                  {activeScenario.dtc_codes?.length > 0 && (
                    <>
                      <span style={{ color: '#cbd5e1' }}>·</span>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>
                        {activeScenario.dtc_codes[0]}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>
                    ❄️ 대설 주의보 (-2°C)
                  </span>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <span style={{ color: '#4338ca', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                    <MapPin size={11} />
                    안성휴게소 5.2km 전방
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 우측 액션: 대화 중일 때만 새 대화 고스트 버튼 */}
        {messages.length > 0 && (
          <button
            onClick={onNewConversation}
            className="home-sub-reset-btn"
            title="새 대화 시작"
            aria-label="새 대화 시작"
          >
            <RotateCcw size={12} />
            <span>새 대화</span>
          </button>
        )}
      </div>


      {/* 3. 중앙 영역: 대화 스트림 */}
      <div
        ref={chatScrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          paddingBottom: '16px'
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            padding: '40px 20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px', marginBottom: '8px' }}>
              어떤 점이 궁금하신가요?
            </div>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b', maxWidth: '340px', margin: '0 auto', textAlign: 'center' }}>
              {currentVehicle ? `${currentVehicle.model_name}의 공식 매뉴얼을 기반으로` : '더 뉴 아반떼의 공식 매뉴얼을 기반으로'}
              <br />
              안전하고 정확한 다음 조치를 안내합니다.
            </p>

            {/* 홈 중앙 상황별 맞춤 예상 질문 / 자주 묻는 질문 알약 목록 (질문 전에는 홈 중앙에만 표시) */}
            <div style={{ marginTop: '28px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', alignSelf: 'flex-start', paddingLeft: '4px' }}>
                💡 {activeScenario ? '현재 상황 맞춤 예상 질문' : '자주 묻는 질문'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    className="ondash-question-scroll-chip"
                    onClick={() => handlePromptClick(q)}
                    style={{
                      fontSize: '12.5px',
                      padding: '8px 14px',
                      animationDelay: `${idx * 0.08}s`
                    }}
                  >
                    <span>{q}</span>
                    <ArrowRight size={11} color="#94a3b8" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 대화 메시지 스트림 */
          messages.map((msg) => {
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
            const isLastAssistant = msg.id === [...messages].reverse().find(m => m.sender === 'assistant')?.id;

            return (
              <div
                key={msg.id}
                id={`assistant-msg-${msg.id}`}
                ref={isLastAssistant ? lastAssistantCardRef : null}
                className="ondash-response-card"
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {/* 헤더 행: 배지 및 음성 재생 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {safetyLevel === 'IMMEDIATE_ACTION' && (
                      <span className="safety-pill-badge IMMEDIATE_ACTION">
                        <ShieldAlert size={13} />
                        <span>🚨 즉시 안전 정차</span>
                      </span>
                    )}
                    {safetyLevel === 'CAUTION' && (
                      <span className="safety-pill-badge CAUTION">
                        <AlertTriangle size={13} />
                        <span>⚠️ 점검 권장</span>
                      </span>
                    )}
                    {data?.isSimulationMode && (
                      <span style={{ fontSize: '10px', color: '#0284c7', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        가상 맥락 반영됨
                      </span>
                    )}
                  </div>

                  {settings.voice_guidance_enabled !== 0 && (
                    <button
                      onClick={() => toggleSpeak(msg.id, `${data?.immediate_action || data?.summary || msg.content}`)}
                      className={`glass-icon-btn ${speakingMsgId === msg.id ? 'active-speaking' : ''}`}
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: speakingMsgId === msg.id ? '#eff6ff' : 'transparent',
                        borderColor: speakingMsgId === msg.id ? '#93c5fd' : '#e2e8f0',
                        color: speakingMsgId === msg.id ? '#2563eb' : '#64748b'
                      }}
                      aria-label={speakingMsgId === msg.id ? "음성 안내 끄기" : "음성으로 듣기"}
                      title={speakingMsgId === msg.id ? "음성 안내 끄기" : "음성으로 듣기"}
                    >
                      {speakingMsgId === msg.id ? (
                        <VolumeX size={15} color="#2563eb" />
                      ) : (
                        <Volume2 size={16} color="#64748b" />
                      )}
                    </button>
                  )}
                </div>

                {/* 1. 핵심 요약 문구 */}
                <div className={`ondash-summary-text ${isDriving ? 'driving-mode' : ''}`} style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1.4 }}>
                  {data?.summary ? data.summary.split('(')[0].trim() : msg.content}
                </div>

                {/* 핵심 확인 질문 (분기 질문이 필요한 경우) */}
                {data?.clarificationNeeded && (
                  <div style={{
                    background: '#f0f9ff',
                    border: '1.5px solid #38bdf8',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HelpCircle size={15} color="#0284c7" />
                      <span>{data.clarificationNeeded.question}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {data.clarificationNeeded.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => onSendMessage(opt.label, { providedState: { key: data.clarificationNeeded.id, value: opt.value } })}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #bae6fd',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: '#0f172a',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>{opt.label}</span>
                          {opt.hint && <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>{opt.hint}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. [답변 규칙 1] 지금 바로 할 행동 */}
                {(data?.immediate_action || data?.next_action) && (
                  <div style={{
                    background: isDriving ? '#fee2e2' : '#f0fdf4',
                    border: isDriving ? '1.5px solid #ef4444' : '1px solid #86efac',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: isDriving ? '#dc2626' : '#16a34a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 900,
                      flexShrink: 0,
                      marginTop: '1px'
                    }}>
                      !
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: isDriving ? '#991b1b' : '#15803d', textTransform: 'uppercase' }}>
                        지금 바로 할 행동
                      </div>
                      <div style={{ fontSize: isDriving ? '15px' : '13.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px', lineHeight: 1.45 }}>
                        {data.immediate_action || data.next_action}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. [답변 규칙 2] 그 행동이 필요한 이유와 근거 */}
                {data?.rationale && !isDriving && (
                  <div style={{
                    fontSize: '12.5px',
                    color: '#475569',
                    lineHeight: 1.45,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '9px 12px'
                  }}>
                    <span style={{ fontWeight: 700, color: '#334155' }}>💡 행동 근거:</span> {data.rationale}
                  </div>
                )}

                {/* 운전 중 모드: 안전 안내 */}
                {isDriving ? (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#991b1b',
                    fontWeight: 700
                  }}>
                    * 주행 중 복잡한 조작은 위험합니다. 세부 조치 단계는 안전지대 정차 후 확인하세요.
                  </div>
                ) : (
                  /* 정차 중: [답변 규칙 3] 사용자가 직접 확인할 수 있는 다음 단계 */
                  <>
                    {data?.actionSteps && data.actionSteps.length > 0 && (
                      <div className="ondash-steps-card">
                        <div className="ondash-steps-header">
                          <div className="steps-header-title">
                            <CheckSquare size={15} color="#2563eb" />
                            <span>하나씩 같이 확인해 보아요</span>
                          </div>
                          <span className="steps-header-count">
                            {(checkedStepsMap[msg.id] || []).length} / {data.actionSteps.length} 확인
                          </span>
                        </div>

                        <div className="ondash-steps-list">
                          {data.actionSteps.map((s, sIdx) => {
                            const isChecked = (checkedStepsMap[msg.id] || []).includes(sIdx);
                            const currentCheckedCount = (checkedStepsMap[msg.id] || []).length;
                            const isCurrentActive = !isChecked && sIdx === currentCheckedCount;
                            const isFuture = !isChecked && sIdx > currentCheckedCount;

                            return (
                              <div
                                key={sIdx}
                                onClick={() => handleToggleStep(msg.id, sIdx)}
                                className={`ondash-step-row ${isChecked ? 'checked' : isCurrentActive ? 'active' : 'idle'} ${isFuture ? 'future' : ''}`}
                              >
                                <div className="step-check-circle">
                                  {isChecked ? <CheckCircle2 size={16} /> : <span>{s.step || sIdx + 1}</span>}
                                </div>
                                <div className="step-text-wrap">
                                  {s.where && (
                                    <span className="step-scope-tag">
                                      {s.where}
                                    </span>
                                  )}
                                  <span className="step-action-desc">
                                    {s.action}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 확인 후 추가 탐색: 서브 가이드 링크 스타일로 단정하게 정리 */}
                        <button
                          type="button"
                          onClick={() => handleEscalateIssue(data)}
                          className="ondash-escalate-text-btn"
                          style={{ flexDirection: 'column', gap: '3px', textAlign: 'center', padding: '9px 12px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Search size={12} color="#64748b" />
                            <span>3가지 확인 후에도 문제가 지속되나요?</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                            <span>전문가 웹 검색 추가 안내</span>
                            <ArrowRight size={10} color="#94a3b8" />
                          </div>
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 4. [답변 규칙 4] 운행을 멈추거나 전문 점검을 받아야 하는 조건 (차분한 소프트 웜 그레이/앰버 위계) */}
                {data?.stop_conditions && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderLeft: '3px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '11.5px',
                    color: '#334155',
                    lineHeight: 1.45
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px', fontWeight: 800, fontSize: '11px', color: '#b45309' }}>
                      <AlertCircle size={13} color="#f59e0b" />
                      <span>운행 중지 및 전문 점검 조건</span>
                    </div>
                    <div style={{ color: '#475569', fontSize: '11.5px' }}>
                      {data.stop_conditions}
                    </div>
                  </div>
                )}

                {/* 5. 적용 범위 및 출처 정보 (메타데이터 영역: 깔끔한 뮤티드 단일 그룹) */}
                <div style={{
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '8px',
                  marginTop: '2px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  {/* 적용 범위 메타 한 줄 */}
                  {data?.scope_verification && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{
                        fontWeight: 700,
                        color: data.scope_verification.matchStatus === 'EXACT' ? '#166534' : '#854d0e',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        {data.scope_verification.matchStatus === 'EXACT' ? '✓' : '⚠️'} 적용 범위:
                      </span>
                      <span style={{ color: '#64748b' }}>
                        {data.scope_verification.scopeNote}
                      </span>
                    </div>
                  )}

                  {/* 근거 출처 한 줄 */}
                  {data?.sources && data.sources.length > 0 ? (
                    data.sources.map((src, sIdx) => (
                      <div key={sIdx} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '6px' }}>
                        <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600, color: '#475569' }}>출처: {src.document_title}</span>
                          <span style={{ color: '#94a3b8' }}> · {src.source_org} ({src.source_section}) {src.source_page}</span>
                        </div>
                        {src.is_virtual_sample && (
                          <span style={{ fontSize: '9px', color: '#94a3b8', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 4px', borderRadius: '4px', flexShrink: 0 }}>
                            가상 샘플
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div>
                      {data?.confidence === 'NONE' ? (
                        <span style={{ color: '#94a3b8' }}>공식 매뉴얼 미기재 증상 · 다빈도 권장 점검 항목</span>
                      ) : (
                        <span>
                          <span style={{ fontWeight: 600, color: '#475569' }}>출처: {data?.source_title || '제조사 공식 가이드'}</span>
                          {data?.source_location && <span style={{ color: '#94a3b8' }}> · {data.source_location}</span>}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* 로딩 표시 */}
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
            <span>{currentStepMessage || '상황 및 적용 범위 확인 중'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. 하단 추천 질문 칩 & 채팅 입력창 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, paddingTop: '8px' }}>
        {/* 질문 후(messages.length > 0)에만 채팅창 위 가로 스크롤 추천 질문 칩 표시 */}
        {!isDriving && messages.length > 0 && (
          <div className="ondash-questions-scroll-row">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                className="ondash-question-scroll-chip"
                onClick={() => handlePromptClick(q)}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <span>{q}</span>
                <ArrowRight size={11} color="#94a3b8" />
              </button>
            ))}
          </div>
        )}

        {/* 플로팅 채팅 입력창 */}
        <form onSubmit={handleSend} className="ondash-input-floating-card" style={{ padding: '10px 12px', borderRadius: '20px' }}>
          <textarea
            className="ondash-textarea"
            placeholder={isDriving ? "정차 후 질문하거나 간단히 입력하세요" : "차량 기능이나 상황 질문을 입력하세요"}
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            style={{ minHeight: '36px' }}
          />
          <div className="ondash-input-actions">
            <button
              type="button"
              className={`ondash-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceInput}
              aria-label="음성으로 질문하기"
              title={isListening ? "음성 인식 중..." : "음성 입력"}
            >
              <Mic size={16} />
            </button>

            <button
              type="submit"
              className="ondash-send-btn"
              disabled={!questionInput.trim() || isLoading}
              aria-label="질문 보내기"
              title="전송"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

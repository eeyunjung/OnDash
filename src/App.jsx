// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Home, History, User, ShieldAlert, Car, ChevronDown } from 'lucide-react';
import HomeTab from './components/HomeTab';
import HistoryTab from './components/HistoryTab';
import MyPageTab from './components/MyPageTab';
import VehicleSelectModal from './components/VehicleSelectModal';
import AdminModal from './components/AdminModal';
import ResearchEvalModal from './components/ResearchEvalModal';
import UtScenarioModal from './components/UtScenarioModal';
import KnowledgeModal from './components/KnowledgeModal';
import {
  getVehicles,
  syncSession,
  getConversations,
  createConversation,
  deleteConversation,
  sendChatMessage,
  getSettings,
  updateSettings,
  getActiveSimulationScenario
} from './api';

export default function App() {
  // 요구사항 1 & 6: 하단 탭은 'home' | 'history' | 'mypage' 3개
  const [currentTab, setCurrentTab] = useState('home');
  const [vehicles, setVehicles] = useState([]);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);
  const [isUtModalOpen, setIsUtModalOpen] = useState(false);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  // 개인화 설정 및 주행 모드
  const [settings, setSettings] = useState({
    preferred_length: 'short',
    voice_guidance_enabled: 1,
    location_permission: 0,
    weather_permission: 0,
    vehicle_data_permission: 0,
    history_save_enabled: 1,
    drive_mode: 'PARKED'
  });

  // 통합 홈/질문 상태
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepMessage, setCurrentStepMessage] = useState('');

  // 1. 초기 데이터 로드 및 세션 동기화
  useEffect(() => {
    async function init() {
      try {
        const vData = await getVehicles();
        setVehicles(vData.vehicles || []);

        // 설정 불러오기
        try {
          const sData = await getSettings();
          if (sData.settings) {
            setSettings(sData.settings);
          }
        } catch (e) {
          console.error('설정 로드 실패:', e);
        }

        // 로컬스토리지에 저장된 차량 ID 확인
        const savedVehicleId = localStorage.getItem('my_car_guide_vehicle_id');
        let initialVehicle = null;

        if (savedVehicleId) {
          initialVehicle = (vData.vehicles || []).find(v => v.id === savedVehicleId);
        }

        if (initialVehicle) {
          setCurrentVehicle(initialVehicle);
          await syncSession(initialVehicle.id);
        } else {
          // 첫 방문: 등록 모달 호출
          setIsFirstVisit(true);
          setIsVehicleModalOpen(true);
        }

        // 가상 시나리오 불러오기
        try {
          const actData = await getActiveSimulationScenario();
          if (actData.scenario) {
            setActiveScenario(actData.scenario);
          }
        } catch (e) {
          console.error('가상 시나리오 로드 실패:', e);
        }

        // 대화 목록 로드
        loadConversations();
      } catch (err) {
        console.error('초기화 실패:', err);
      }
    }
    init();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await getConversations();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('대화 목록 로드 실패:', err);
    }
  };

  // 차량 선택 완료
  const handleSelectVehicle = async (vehicle) => {
    setCurrentVehicle(vehicle);
    localStorage.setItem('my_car_guide_vehicle_id', vehicle.id);
    setIsVehicleModalOpen(false);
    setIsFirstVisit(false);
    await syncSession(vehicle.id);
  };

  // 주행 모드 토글 (PARKED <-> DRIVING)
  const toggleDriveMode = async () => {
    const nextMode = settings.drive_mode === 'DRIVING' ? 'PARKED' : 'DRIVING';
    const newSettings = { ...settings, drive_mode: nextMode };
    setSettings(newSettings);
    try {
      await updateSettings({ drive_mode: nextMode });
    } catch (e) {
      console.error('주행 모드 업데이트 실패:', e);
    }
  };

  // 설정 업데이트
  const handleUpdateSettings = async (partial) => {
    const newSettings = { ...settings, ...partial };
    setSettings(newSettings);
    try {
      await updateSettings(partial);
    } catch (e) {
      console.error('설정 저장 실패:', e);
    }
  };

  // 새 대화 시작
  const handleStartNewConversation = async (overrideVehicle = null) => {
    const targetVehicle = overrideVehicle || currentVehicle;
    const vehicleId = targetVehicle ? targetVehicle.id : 'hyundai-avante-cn7-2024';
    const title = targetVehicle ? `${targetVehicle.brand} ${targetVehicle.model_name} 가이드` : '일반 차량 가이드';

    try {
      const convData = await createConversation(vehicleId, title);
      setCurrentConversation(convData.conversation);
      setMessages([]);
      await loadConversations();
      return convData.conversation;
    } catch (err) {
      console.error('새 대화 생성 실패:', err);
      return null;
    }
  };

  // 로고 클릭 시 홈 탭 전환 및 자동으로 새 대화 시작
  const handleLogoClick = async () => {
    setCurrentTab('home');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    await handleStartNewConversation();
  };

  // 홈에서 질문 전송 (홈 화면 자체에서 실시간 대화 스트림 진행)
  const handleSendMessage = async (text, extraParams = {}) => {
    let conv = currentConversation;
    if (!conv) {
      conv = await handleStartNewConversation();
      if (!conv) return;
    }

    const convId = conv.id;
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      sender: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempUserMsg]);
    setIsLoading(true);
    setCurrentStepMessage('차량 매뉴얼 확인 중');

    const stepTimer = setTimeout(() => {
      setCurrentStepMessage('주변 시설 및 상태 확인 중');
    }, 450);

    const stepTimer2 = setTimeout(() => {
      setCurrentStepMessage('답변 정리 중');
    }, 900);

    try {
      const result = await sendChatMessage({
        conversationId: convId,
        userMessage: text,
        vehicleId: conv.vehicle_id,
        clientLocation: extraParams.clientLocation,
        providedState: extraParams.providedState,
        driveMode: settings.drive_mode,
        preferredLength: settings.preferred_length
      });

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);

      const assistantMsg = {
        id: result.assistantMessageId,
        sender: 'assistant',
        content: result.response.summary,
        structured_data: result.response,
        created_at: new Date().toISOString()
      };

      setIsLoading(false);
      setCurrentStepMessage('');
      setMessages(prev => [...prev, assistantMsg]);
      await loadConversations();
    } catch (err) {
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      alert('답변 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsLoading(false);
      setCurrentStepMessage('');
    }
  };

  // 기록 삭제
  const handleDeleteConversation = async (convId) => {
    try {
      await deleteConversation(convId);
      if (currentConversation?.id === convId) {
        setCurrentConversation(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      alert('대화 삭제 실패: ' + err.message);
    }
  };

  return (
    <div className="app-viewport">
      {/* OnDash 상단 글래스 헤더 */}
      <header className="top-nav">
        <div className="top-nav-brand">
          {/* OnDash 심미적 오토모티브 브랜드 로고 (클릭 시 홈 전환 및 자동 새 대화 시작) */}
          <button
            onClick={handleLogoClick}
            className="ondash-brand-logo-clean"
            aria-label="OnDash 홈 및 새 대화 시작"
            title="OnDash 홈 및 새 대화 시작"
          >
            <div className="ondash-logo-emblem">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="ondashArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
                <path
                  d="M3.5 15.5C3.5 10.8 7.3 7 12 7C16.7 7 20.5 10.8 20.5 15.5"
                  stroke="url(#ondashArcGrad)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="15.5" r="2.2" fill="#0f172a" stroke="url(#ondashArcGrad)" strokeWidth="1.8" />
                <path
                  d="M12 15.5L16.2 10.2"
                  stroke="url(#ondashArcGrad)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="ondash-brand-wordmark-clean">OnDash</span>
          </button>

          <span className="top-nav-divider" />

          {/* 요구사항: '차량변경'은 최상단 (로고 옆)으로 이동, 알약 대신 미니멀한 버튼 스타일 */}
          <button
            onClick={() => setIsVehicleModalOpen(true)}
            className="top-nav-vehicle-btn"
            title="차량 변경"
            aria-label="차량 변경"
          >
            <Car size={13} color="#4f46e5" />
            <span>차량 변경</span>
            <ChevronDown size={11} color="#64748b" />
          </button>
        </div>

        {/* 우측: 주행 / 정차 모드 (뚱뚱한 알약 버튼 대신 세련된 상태 닷 인디케이터) */}
        <div className="top-nav-icons">
          <button
            onClick={toggleDriveMode}
            className={`mode-status-indicator ${settings.drive_mode === 'DRIVING' ? 'driving' : 'parked'}`}
            title="운전 상태 전환 (클릭 시 전환)"
            aria-label="주행 상태 전환 버튼"
          >
            <span className={`status-dot ${settings.drive_mode === 'DRIVING' ? 'driving' : 'parked'}`} />
            <span>{settings.drive_mode === 'DRIVING' ? '주행 중' : '정차 중'}</span>
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 (탭 전환) */}
      <main className={`content-area ${currentTab === 'home' ? 'home-tab-active' : ''}`}>
        {/* 요구사항 1 & 3: 홈과 질문 통합 화면 */}
        {currentTab === 'home' && (
          <HomeTab
            currentVehicle={currentVehicle}
            onChangeVehicleClick={() => setIsVehicleModalOpen(true)}
            conversation={currentConversation}
            messages={messages}
            isLoading={isLoading}
            currentStepMessage={currentStepMessage}
            onSendMessage={handleSendMessage}
            onNewConversation={() => handleStartNewConversation()}
            driveMode={settings.drive_mode}
            settings={settings}
            activeScenario={activeScenario}
            onOpenUtModal={() => setIsUtModalOpen(true)}
            onOpenResearchModal={() => setIsResearchModalOpen(true)}
          />
        )}

        {/* 요구사항 7: 기록 탭 (1뎁스 내에서 머물며 꺾쇠로 목록/상세 전환) */}
        {currentTab === 'history' && (
          <HistoryTab
            conversations={conversations}
            onDeleteConversation={handleDeleteConversation}
          />
        )}

        {/* 요구사항 6: 마이페이지 탭 (상세 차량 스펙 및 설정 & 개인화) */}
        {currentTab === 'mypage' && (
          <MyPageTab
            currentVehicle={currentVehicle}
            onChangeVehicleClick={() => setIsVehicleModalOpen(true)}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenResearchModal={() => setIsResearchModalOpen(true)}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            onOpenUtModal={() => setIsUtModalOpen(true)}
            onOpenKnowledgeModal={() => setIsKnowledgeModalOpen(true)}
          />
        )}
      </main>

      {/* 요구사항 2: 바텀에 고정된 하단 탭바 (홈, 기록, 마이페이지) */}
      <nav className="bottom-tab-bar">
        <button
          className={`tab-item ${currentTab === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentTab('home')}
        >
          <Home size={18} />
          <span>홈</span>
        </button>
        <button
          className={`tab-item ${currentTab === 'history' ? 'active' : ''}`}
          onClick={() => {
            loadConversations();
            setCurrentTab('history');
          }}
        >
          <History size={18} />
          <span>기록</span>
        </button>
        <button
          className={`tab-item ${currentTab === 'mypage' ? 'active' : ''}`}
          onClick={() => setCurrentTab('mypage')}
        >
          <User size={18} />
          <span>마이페이지</span>
        </button>
      </nav>

      {/* 차량 등록/변경 단계형 모달 */}
      <VehicleSelectModal
        vehicles={vehicles}
        currentVehicle={currentVehicle}
        isOpen={isVehicleModalOpen}
        isFirstVisit={isFirstVisit}
        onClose={() => setIsVehicleModalOpen(false)}
        onSelectVehicle={handleSelectVehicle}
      />

      {/* AI 답변 비교 연구 평가 모달 (마이페이지에서 호출 가능) */}
      <ResearchEvalModal
        isOpen={isResearchModalOpen}
        onClose={() => setIsResearchModalOpen(false)}
        currentVehicle={currentVehicle}
        driveMode={settings.drive_mode}
      />

      {/* 운영자 전용 모달 (마이페이지에서 호출 가능) */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      {/* UT 가상 상황 시뮬레이터 모달 */}
      <UtScenarioModal
        isOpen={isUtModalOpen}
        onClose={() => setIsUtModalOpen(false)}
        activeScenario={activeScenario}
        onScenarioChange={(newScen) => setActiveScenario(newScen)}
      />

      {/* 차량별 지식·근거 자료 라이브러리 모달 */}
      <KnowledgeModal
        isOpen={isKnowledgeModalOpen}
        onClose={() => setIsKnowledgeModalOpen(false)}
      />
    </div>
  );
}

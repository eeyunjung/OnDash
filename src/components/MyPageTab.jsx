// src/components/MyPageTab.jsx
import React from 'react';
import { Car, Sliders, Volume2, MapPin, Cloud, Clock, FlaskConical, Shield, ChevronRight, Scale } from 'lucide-react';

export default function MyPageTab({
  currentVehicle,
  onChangeVehicleClick,
  settings,
  onUpdateSettings,
  onOpenResearchModal,
  onOpenAdminModal,
  onOpenUtModal,
  onOpenKnowledgeModal
}) {
  const handleToggle = (key) => {
    onUpdateSettings({
      [key]: !settings[key]
    });
  };

  const handleLengthChange = (length) => {
    onUpdateSettings({
      preferred_length: length
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '20px' }}>
      {/* 1. 상단 타이틀 */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px' }}>
          마이페이지
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
          차량 상세 제원과 가이드 환경 설정을 관리합니다.
        </p>
      </div>

      {/* 2. 상세 등록 차량 카드 (요구사항 6) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 244, 255, 0.85) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.9)',
        borderRadius: '24px',
        padding: '20px',
        boxShadow: '0 8px 24px rgba(148, 163, 184, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Car size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                등록된 공식 매뉴얼 차량
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {currentVehicle ? `${currentVehicle.brand} ${currentVehicle.model_name}` : '차량 미등록'}
              </div>
            </div>
          </div>
          <button
            onClick={onChangeVehicleClick}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '9999px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            차량 변경
          </button>
        </div>

        {currentVehicle ? (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '13px',
            color: '#334155'
          }}>
            <div><strong>세대 / 차종:</strong> {currentVehicle.generation}</div>
            <div><strong>연식:</strong> {currentVehicle.year_range}</div>
            <div><strong>파워트레인:</strong> {currentVehicle.fuel_type} ({currentVehicle.powertrain_type})</div>
            <div><strong>인포테인먼트:</strong> {currentVehicle.infotainment_type}</div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            차량을 선택하시면 정확한 공식 매뉴얼 검색을 지원합니다.
          </div>
        )}
      </div>

      {/* 3. 설정 및 개인화 섹션 (요구사항 6) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.92)',
        borderRadius: '24px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.9)',
        boxShadow: '0 8px 24px rgba(148, 163, 184, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
          <Sliders size={18} color="#4f46e5" />
          <span>답변 및 가이드 설정</span>
        </div>

        {/* 선호 답변 길이 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>선호 답변 길이</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleLengthChange('short')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: settings.preferred_length === 'short' ? '2px solid #0f172a' : '1px solid #e2e8f0',
                backgroundColor: settings.preferred_length === 'short' ? '#f8fafc' : '#ffffff',
                color: settings.preferred_length === 'short' ? '#0f172a' : '#64748b',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              짧게 (핵심 요약 우선)
            </button>
            <button
              onClick={() => handleLengthChange('detailed')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: settings.preferred_length === 'detailed' ? '2px solid #0f172a' : '1px solid #e2e8f0',
                backgroundColor: settings.preferred_length === 'detailed' ? '#f8fafc' : '#ffffff',
                color: settings.preferred_length === 'detailed' ? '#0f172a' : '#64748b',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              자세히 (배경 및 절차 포함)
            </button>
          </div>
        </div>

        {/* 음성 안내 사용 여부 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={18} color="#475569" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>음성 안내 (TTS/STT)</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>답변 듣기와 마이크 입력을 허용합니다</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!settings.voice_guidance_enabled}
            onChange={() => handleToggle('voice_guidance_enabled')}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>

        {/* 데이터 사용 권한 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>데이터 권한 및 안전 안내</div>
          <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
            권한을 거절하셔도 기본 매뉴얼 조회는 언제나 가능하며, 원시 위치 정보는 시설 거리 계산 후 서버에 영구 보존되지 않습니다.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} /> 위치 정보 사용
            </span>
            <input
              type="checkbox"
              checked={!!settings.location_permission}
              onChange={() => handleToggle('location_permission')}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cloud size={15} /> 날씨 맥락 조회 (기온/동결)
            </span>
            <input
              type="checkbox"
              checked={!!settings.weather_permission}
              onChange={() => handleToggle('weather_permission')}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* 대화 기록 저장 여부 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#475569" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>대화 기록 서버 저장</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>끄면 서버에 대화가 기록되지 않습니다</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!settings.history_save_enabled}
            onChange={() => handleToggle('history_save_enabled')}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* 4. 부가 기능 (3사 비교 UT 평가, UT 시뮬레이터, 지식 라이브러리, 운영자 콘솔) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={onOpenResearchModal}
          style={{
            backgroundColor: '#ffffff',
            border: '1.5px solid #38bdf8',
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(56, 189, 248, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={18} color="#0284c7" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>⚖️ 3사 AI 답변 비교 UT 평가 (2025 아이오닉 5)</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>우리 서비스 vs ChatGPT vs Gemini · 공식 매뉴얼 근거 및 안전성 비교</div>
            </div>
          </div>
          <ChevronRight size={16} color="#0284c7" />
        </button>

        <button
          onClick={onOpenUtModal}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlaskConical size={18} color="#2563eb" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>🧪 UT 가상 상황 시뮬레이터</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>테스트 진행자 가상 도로/날씨/증상/DTC 시나리오 제어</div>
            </div>
          </div>
          <ChevronRight size={16} color="#94a3b8" />
        </button>

        <button
          onClick={onOpenKnowledgeModal}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="#4f46e5" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>📚 차량별 지식·근거 자료 라이브러리</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>안전 대응 기준, TSB/리콜, 진단 분기 질문 조회 및 등록</div>
            </div>
          </div>
          <ChevronRight size={16} color="#94a3b8" />
        </button>

        <button
          onClick={onOpenAdminModal}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#475569" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>운영자 콘솔</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>매뉴얼 문서 상태 확인 및 감사 로그 내보내기</div>
            </div>
          </div>
          <ChevronRight size={16} color="#94a3b8" />
        </button>
      </div>
    </div>
  );
}

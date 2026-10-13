// src/components/SettingsModal.jsx
import React from 'react';
import { X, Shield, Volume2, MapPin, Cloud, Car, Clock, Sliders, FlaskConical, Check } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentVehicle,
  onChangeVehicleClick,
  onOpenResearchModal
}) {
  if (!isOpen) return null;

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
    <div className="modal-overlay">
      <div className="bottom-sheet" style={{ maxHeight: '90dvh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} color="#1d4ed8" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>설정 및 개인화</h3>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="닫기">
            <X size={20} color="#6b7280" />
          </button>
        </div>

        {/* 1. 등록 차량 정보 */}
        <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>현재 등록 차량</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>
                {currentVehicle ? `${currentVehicle.brand} ${currentVehicle.model_name}` : '등록된 차량 없음'}
              </div>
              {currentVehicle && (
                <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>
                  {currentVehicle.generation} ({currentVehicle.year_range}) · {currentVehicle.fuel_type}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                onClose();
                onChangeVehicleClick();
              }}
              style={{
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1d4ed8',
                cursor: 'pointer'
              }}
            >
              차량 변경
            </button>
          </div>
        </div>

        {/* 2. 선호 답변 길이 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>선호 답변 길이</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleLengthChange('short')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: settings.preferred_length === 'short' ? '2px solid #1d4ed8' : '1px solid #e5e7eb',
                backgroundColor: settings.preferred_length === 'short' ? '#eff6ff' : 'white',
                color: settings.preferred_length === 'short' ? '#1d4ed8' : '#374151',
                fontWeight: 700,
                fontSize: '14px',
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
                borderRadius: '8px',
                border: settings.preferred_length === 'detailed' ? '2px solid #1d4ed8' : '1px solid #e5e7eb',
                backgroundColor: settings.preferred_length === 'detailed' ? '#eff6ff' : 'white',
                color: settings.preferred_length === 'detailed' ? '#1d4ed8' : '#374151',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              자세히 (배경 및 절차 포함)
            </button>
          </div>
        </div>

        {/* 3. 음성 안내 사용 여부 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={18} color="#4b5563" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>음성 안내 (TTS/STT)</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>답변을 음성으로 들려주고 마이크 입력을 허용합니다</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!settings.voice_guidance_enabled}
            onChange={() => handleToggle('voice_guidance_enabled')}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
        </div>

        {/* 4. 데이터 사용 권한 (개인정보 안내 명시) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>데이터 권한 및 개인정보</div>
          <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.4 }}>
            권한을 거절하셔도 기본 매뉴얼 검색은 제한 없이 이용할 수 있습니다. 수집된 위치 정보는 시설 거리 계산 후 서버에 영구 보존되지 않습니다.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            <span style={{ fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
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

        {/* 5. 대화 기록 저장 여부 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#4b5563" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>대화 기록 서버 저장</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>끄면 서버에 대화가 기록되지 않습니다</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!settings.history_save_enabled}
            onChange={() => handleToggle('history_save_enabled')}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
        </div>

        {/* 연구자 전용: AI 답변 비교 연구 모드 진입 버튼 (요구사항 9) */}
        <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FlaskConical size={18} color="#166534" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>AI 답변 비교 연구 모드</div>
                <div style={{ fontSize: '11px', color: '#15803d' }}>두 AI 모델의 안전성/출처 블라인드 평가 (정차 중 전용)</div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenResearchModal();
              }}
              style={{
                backgroundColor: '#166534',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              시작하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

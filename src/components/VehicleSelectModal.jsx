// src/components/VehicleSelectModal.jsx
import React, { useState, useMemo } from 'react';
import { ChevronRight, Check, ArrowLeft, X, Sparkles } from 'lucide-react';

export default function VehicleSelectModal({
  vehicles = [],
  currentVehicle,
  isOpen,
  onClose,
  onSelectVehicle,
  isFirstVisit = false
}) {
  const [step, setStep] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  const brands = useMemo(() => {
    return Array.from(new Set(vehicles.map(v => v.brand)));
  }, [vehicles]);

  const models = useMemo(() => {
    if (!selectedBrand) return [];
    const filtered = vehicles.filter(v => v.brand === selectedBrand);
    const map = new Map();
    filtered.forEach(v => {
      if (!map.has(v.model_name)) {
        map.set(v.model_name, v);
      }
    });
    return Array.from(map.values());
  }, [vehicles, selectedBrand]);

  const trims = useMemo(() => {
    if (!selectedBrand || !selectedModel) return [];
    return vehicles.filter(v => v.brand === selectedBrand && v.model_name === selectedModel.model_name);
  }, [vehicles, selectedBrand, selectedModel]);

  if (!isOpen) return null;

  const handleBrandClick = (brand) => {
    setSelectedBrand(brand);
    setStep(1);
  };

  const handleModelClick = (model) => {
    setSelectedModel(model);
    setStep(2);
  };

  const handleTrimSelect = (vehicle) => {
    onSelectVehicle(vehicle);
    setStep(0);
    setSelectedBrand(null);
    setSelectedModel(null);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 1) setStep(0);
  };

  return (
    <div className="modal-overlay">
      <div className="bottom-sheet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {step > 0 && (
              <button
                onClick={handleBack}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                aria-label="이전 단계"
              >
                <ArrowLeft size={20} color="#334155" />
              </button>
            )}
            <span style={{
              fontSize: '12px',
              fontWeight: 800,
              color: '#4f46e5',
              backgroundColor: '#e0e7ff',
              padding: '3px 10px',
              borderRadius: '9999px'
            }}>
              {step === 0 && '1단계: 브랜드 선택'}
              {step === 1 && '2단계: 차종 선택'}
              {step === 2 && '3단계: 사양 및 인포테인먼트'}
            </span>
          </div>
          {!isFirstVisit && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              aria-label="닫기"
            >
              <X size={20} color="#94a3b8" />
            </button>
          )}
        </div>

        <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px', marginTop: '2px' }}>
          {step === 0 && '차량 브랜드를 선택하세요'}
          {step === 1 && `${selectedBrand} 모델을 선택하세요`}
          {step === 2 && '사양 또는 인포테인먼트를 선택하세요'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {step === 0 &&
            brands.map(brand => (
              <button
                key={brand}
                onClick={() => handleBrandClick(brand)}
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  borderRadius: '20px',
                  padding: '16px 20px',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <span>{brand}</span>
                <ChevronRight size={18} color="#94a3b8" />
              </button>
            ))}

          {step === 1 &&
            models.map(m => (
              <button
                key={m.id}
                onClick={() => handleModelClick(m)}
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  borderRadius: '20px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{m.model_name}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    {m.generation} ({m.year_range})
                  </div>
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </button>
            ))}

          {step === 2 && (
            <>
              {trims.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTrimSelect(t)}
                  style={{
                    background: currentVehicle?.id === t.id ? '#e0e7ff' : 'rgba(255, 255, 255, 0.9)',
                    border: currentVehicle?.id === t.id ? '2px solid #4f46e5' : '1px solid rgba(226, 232, 240, 0.9)',
                    borderRadius: '20px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{t.infotainment_type}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      연료: {t.fuel_type} · 공식 매뉴얼 지원
                    </div>
                  </div>
                  {currentVehicle?.id === t.id ? (
                    <Check size={20} color="#4f46e5" />
                  ) : (
                    <ChevronRight size={18} color="#94a3b8" />
                  )}
                </button>
              ))}

              <button
                onClick={() => handleTrimSelect(trims[0])}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ color: '#475569', fontWeight: 700 }}>잘 모르겠어요 (기본 사양 적용)</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    사양 구분이 필요한 질문 시 추가로 확인합니다
                  </div>
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

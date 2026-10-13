import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Car,
  ThermometerSnowflake,
  ShieldAlert,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  getSimulationScenarios,
  saveSimulationScenario,
  deleteSimulationScenario,
  getActiveSimulationScenario,
  setActiveSimulationScenario
} from '../api';

export default function UtScenarioModal({
  isOpen,
  onClose,
  activeScenario,
  onScenarioChange
}) {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(activeScenario?.id || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadScenarios();
    }
  }, [isOpen]);

  const loadScenarios = async () => {
    setIsLoading(true);
    try {
      const data = await getSimulationScenarios();
      setScenarios(data.scenarios || []);
      const activeData = await getActiveSimulationScenario();
      if (activeData.scenario) {
        setSelectedScenarioId(activeData.scenario.id);
      }
    } catch (err) {
      console.error('시나리오 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentScen = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];

  const handleSelectScenario = async (scen) => {
    setSelectedScenarioId(scen.id);
    setIsEditing(false);
    setIsCreatingNew(false);
    try {
      await setActiveSimulationScenario({ scenarioId: scen.id, isActive: true });
      if (onScenarioChange) onScenarioChange(scen);
      setMessage(`'${scen.title}' 가상 상황이 활성화되었습니다.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert('시나리오 활성화 실패: ' + err.message);
    }
  };

  const handleStartEdit = (scen) => {
    setEditForm({
      ...scen,
      warning_lights_str: (scen.warning_lights || []).join(', '),
      dtc_codes_str: (scen.dtc_codes || []).join(', '),
      sample_questions_str: (scen.sample_questions || []).join('\n')
    });
    setIsEditing(true);
    setIsCreatingNew(false);
  };

  const handleStartCreate = () => {
    setEditForm({
      id: 'scen-' + Date.now(),
      title: '새 UT 가상 상황',
      description: '테스트 진행자 설정 가상 시나리오',
      vehicle_brand: '현대',
      vehicle_model: '더 뉴 아반떼',
      vehicle_year: '2024',
      vehicle_trim: '가솔린 1.6 인스퍼레이션',
      vehicle_sw_version: 'ccNC.2024.03',
      vehicle_region: 'KOR',
      drive_state: 'PARKED',
      road_type: '일반도로',
      time_of_day: '주간',
      weather_condition: '맑음',
      warning_lights_str: '',
      dtc_codes_str: '',
      observed_symptoms: '시동 버튼을 눌렀으나 반응이 미약함',
      user_goal: '안전하게 출발하기',
      user_constraints: '정비소 영업 종료 시간 전 도착 필요',
      expected_criteria: '지금 바로 할 행동을 1순위로 안내하고 불확실성 명시',
      sample_questions_str: '시동이 안 걸려요\n계기판 경고등이 떴어요'
    });
    setIsCreatingNew(true);
    setIsEditing(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...editForm,
        warning_lights: editForm.warning_lights_str ? editForm.warning_lights_str.split(',').map(s => s.trim()).filter(Boolean) : [],
        dtc_codes: editForm.dtc_codes_str ? editForm.dtc_codes_str.split(',').map(s => s.trim()).filter(Boolean) : [],
        sample_questions: editForm.sample_questions_str ? editForm.sample_questions_str.split('\n').map(s => s.trim()).filter(Boolean) : []
      };
      delete payload.warning_lights_str;
      delete payload.dtc_codes_str;
      delete payload.sample_questions_str;

      await saveSimulationScenario(payload);
      await loadScenarios();
      setIsEditing(false);
      setIsCreatingNew(false);
      setSelectedScenarioId(payload.id);
      setMessage('시나리오가 성공적으로 저장되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  const handleDelete = async (scenId) => {
    if (!confirm('이 시나리오를 삭제하시겠습니까?')) return;
    try {
      await deleteSimulationScenario(scenId);
      await loadScenarios();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* 상단 네비게이션 및 큰 타이틀 (검정 박스 및 실린더 아이콘 제거) */}
      <div
        style={{
          padding: '16px 20px 14px 20px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0
            }}
          >
            <ChevronLeft size={18} />
            <span>뒤로가기</span>
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer'
            }}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <h1
          style={{
            fontSize: '21px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.4px',
            margin: '0 0 4px 0'
          }}
        >
          UT 가상 상황 시뮬레이션 설정
        </h1>
        <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
          실제 센서·GPS 없이 가상 상황을 챗봇 맥락으로 주입합니다
        </p>
      </div>

      {/* 상단 알림 배너 */}
      {message && (
        <div style={{
          background: '#ecfdf5',
          color: '#065f46',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 700,
          borderBottom: '1px solid #a7f3d0',
          flexShrink: 0
        }}>
          {message}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 가상 테스트용 안내 배너 (실린더 아이콘 제거, 심플한 정보 배지) */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#1e40af',
          fontWeight: 600
        }}>
          <Info size={16} color="#2563eb" style={{ flexShrink: 0 }} />
          <span>
            <strong>[UT용 가상 상황 모드]</strong> 선택된 시나리오 정보가 챗봇의 상황 판단 및 답변 생성에 즉시 실시간 반영됩니다.
          </span>
        </div>

          {!isEditing ? (
            <>
              {/* 시나리오 목록 선택기 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    테스트 시나리오 선택 ({scenarios.length}개)
                  </label>
                  <button
                    onClick={handleStartCreate}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={12} />
                    <span>새 시나리오 추가</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenarios.map(scen => {
                    const isSelected = scen.id === selectedScenarioId;
                    return (
                      <div
                        key={scen.id}
                        onClick={() => handleSelectScenario(scen)}
                        style={{
                          background: isSelected ? '#f0fdf4' : '#ffffff',
                          border: isSelected ? '2px solid #22c55e' : '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: scen.drive_state === 'DRIVING' ? '#fee2e2' : '#e0f2fe',
                              color: scen.drive_state === 'DRIVING' ? '#991b1b' : '#0369a1'
                            }}>
                              {scen.drive_state === 'DRIVING' ? '주행 중' : '정차 중'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                              {scen.title}
                            </span>
                          </div>
                          {isSelected && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#16a34a' }}>
                              <CheckCircle2 size={13} />
                              현재 적용 중
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                          {scen.vehicle_brand} {scen.vehicle_model} ({scen.vehicle_year}년식, {scen.vehicle_trim}) · {scen.weather_condition}
                        </div>

                        {isSelected && (
                          <div style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px dashed #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                              관찰 증상: {scen.observed_symptoms || '없음'}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(scen);
                                }}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  color: '#334155',
                                  cursor: 'pointer'
                                }}
                              >
                                수정
                              </button>
                              {scen.is_default !== 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(scen.id);
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid #fecaca',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    color: '#dc2626',
                                    cursor: 'pointer'
                                  }}
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 현재 활성 시나리오 상세 스펙 뷰 */}
              {currentScen && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '12px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <SlidersHorizontal size={13} color="#2563eb" />
                    <span>현재 시나리오 가상 파라미터 세부 정보</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: '#475569' }}>
                    <div>• <strong>차량 모델:</strong> {currentScen.vehicle_brand} {currentScen.vehicle_model}</div>
                    <div>• <strong>연식/트림:</strong> {currentScen.vehicle_year} / {currentScen.vehicle_trim}</div>
                    <div>• <strong>SW 버전:</strong> {currentScen.vehicle_sw_version}</div>
                    <div>• <strong>운전 상태:</strong> {currentScen.drive_state === 'DRIVING' ? '주행 중' : '정차 중'}</div>
                    <div>• <strong>가상 날씨:</strong> {currentScen.weather_condition}</div>
                    <div>• <strong>도로/시간대:</strong> {currentScen.road_type} / {currentScen.time_of_day}</div>
                  </div>

                  {currentScen.warning_lights?.length > 0 && (
                    <div style={{ color: '#b91c1c' }}>
                      • <strong>점등 경고등:</strong> {currentScen.warning_lights.join(', ')}
                    </div>
                  )}

                  {currentScen.dtc_codes?.length > 0 && (
                    <div style={{ color: '#b91c1c' }}>
                      • <strong>오류 코드(DTC):</strong> {currentScen.dtc_codes.join(', ')}
                    </div>
                  )}

                  <div style={{ color: '#1e293b' }}>
                    • <strong>사용자 목적:</strong> {currentScen.user_goal}
                  </div>
                  <div style={{ color: '#64748b' }}>
                    • <strong>제약 사항:</strong> {currentScen.user_constraints}
                  </div>
                  <div style={{ color: '#0369a1', background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px' }}>
                    • <strong>기대 답변 기준:</strong> {currentScen.expected_criteria}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 시나리오 편집 / 추가 폼 */
            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  {isCreatingNew ? '새 UT 시나리오 생성' : '시나리오 파라미터 수정'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>시나리오 제목</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>제조사</label>
                  <input
                    type="text"
                    value={editForm.vehicle_brand}
                    onChange={(e) => setEditForm({ ...editForm, vehicle_brand: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>모델명</label>
                  <input
                    type="text"
                    value={editForm.vehicle_model}
                    onChange={(e) => setEditForm({ ...editForm, vehicle_model: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>연식</label>
                  <input
                    type="text"
                    value={editForm.vehicle_year}
                    onChange={(e) => setEditForm({ ...editForm, vehicle_year: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>트림</label>
                  <input
                    type="text"
                    value={editForm.vehicle_trim}
                    onChange={(e) => setEditForm({ ...editForm, vehicle_trim: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>SW 버전</label>
                  <input
                    type="text"
                    value={editForm.vehicle_sw_version}
                    onChange={(e) => setEditForm({ ...editForm, vehicle_sw_version: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>주행 상태</label>
                  <select
                    value={editForm.drive_state}
                    onChange={(e) => setEditForm({ ...editForm, drive_state: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    <option value="PARKED">정차 중</option>
                    <option value="DRIVING">주행 중</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>관찰 증상</label>
                <textarea
                  rows={2}
                  value={editForm.observed_symptoms}
                  onChange={(e) => setEditForm({ ...editForm, observed_symptoms: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>경고등 및 DTC 코드 (쉼표 구분)</label>
                <input
                  type="text"
                  placeholder="예: 빨간색 브레이크 경고등, C1642"
                  value={editForm.warning_lights_str}
                  onChange={(e) => setEditForm({ ...editForm, warning_lights_str: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginBottom: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>가상 날씨</label>
                  <input
                    type="text"
                    value={editForm.weather_condition}
                    onChange={(e) => setEditForm({ ...editForm, weather_condition: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>도로 유형</label>
                  <input
                    type="text"
                    value={editForm.road_type}
                    onChange={(e) => setEditForm({ ...editForm, road_type: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>사용자 목적 / 제약</label>
                <input
                  type="text"
                  value={editForm.user_goal}
                  onChange={(e) => setEditForm({ ...editForm, user_goal: e.target.value })}
                  placeholder="사용자 목적"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginBottom: '4px' }}
                />
                <input
                  type="text"
                  value={editForm.user_constraints}
                  onChange={(e) => setEditForm({ ...editForm, user_constraints: e.target.value })}
                  placeholder="제약 사항"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>추천 샘플 질문들 (줄바꿈 구분)</label>
                <textarea
                  rows={3}
                  value={editForm.sample_questions_str}
                  onChange={(e) => setEditForm({ ...editForm, sample_questions_str: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
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
                  gap: '6px',
                  marginTop: '6px'
                }}
              >
                <Save size={14} />
                <span>시나리오 저장 및 적용</span>
              </button>
            </form>
          )}
        </div>

      {/* 하단 액션 바 */}
      <div style={{
        padding: '12px 20px',
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
          선택된 시나리오가 챗봇 맥락에 즉시 반영됩니다
        </span>
        <button
          onClick={onClose}
          style={{
            padding: '9px 18px',
            borderRadius: '10px',
            border: 'none',
            background: '#0f172a',
            fontSize: '13px',
            fontWeight: 800,
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          설정 완료
        </button>
      </div>
    </div>
  );
}

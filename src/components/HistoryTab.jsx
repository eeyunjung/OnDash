// src/components/HistoryTab.jsx
import React, { useState } from 'react';
import {
  Trash2,
  ChevronRight,
  Calendar,
  Clock,
  ArrowLeft,
  Car,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { getConversationDetail } from '../api';

export default function HistoryTab({
  conversations = [],
  onDeleteConversation
}) {
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [openDetailsMap, setOpenDetailsMap] = useState({});

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 특정 대화 항목 클릭 시 1뎁스 상세 화면으로 전환 (하단 탭은 기록 유지!)
  const handleOpenDetail = async (convId) => {
    setSelectedConvId(convId);
    setIsLoadingDetail(true);
    try {
      const data = await getConversationDetail(convId);
      setDetailData(data);
    } catch (err) {
      alert('대화 상세 로드 실패: ' + err.message);
      setSelectedConvId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleBackToList = () => {
    setSelectedConvId(null);
    setDetailData(null);
  };

  const toggleDetails = (msgId) => {
    setOpenDetailsMap(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  // 1뎁스 상세 화면 (요구사항 7)
  if (selectedConvId) {
    const conv = detailData?.conversation;
    const messages = detailData?.messages || [];
    const vehicleSnapshot = conv?.vehicle_snapshot
      ? (typeof conv.vehicle_snapshot === 'string' ? JSON.parse(conv.vehicle_snapshot) : conv.vehicle_snapshot)
      : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
        {/* 상단 1뎁스 헤더 (좌측 상단 꺾쇠 뒤로가기 버튼) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)'
        }}>
          <button
            onClick={handleBackToList}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px',
              fontWeight: 800,
              color: '#0f172a',
              cursor: 'pointer',
              padding: '4px 0'
            }}
            aria-label="기록 목록으로 돌아가기"
          >
            <ArrowLeft size={18} />
            <span>목록으로</span>
          </button>

          <button
            onClick={() => {
              if (confirm('이 대화 기록을 삭제하시겠습니까?')) {
                onDeleteConversation(selectedConvId);
                handleBackToList();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
            aria-label="대화 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* 대화 기준 차량 및 일시 */}
        {conv && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            padding: '10px 14px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Car size={15} color="#4f46e5" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                {vehicleSnapshot ? `${vehicleSnapshot.brand} ${vehicleSnapshot.model_name}` : '차량 기준'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {formatDate(conv.created_at)}
            </span>
          </div>
        )}

        {/* 상세 대화 내역 스트림 */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '20px' }}>
          {isLoadingDetail ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>불러오는 중...</div>
          ) : (
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
              const isDetailsOpen = !!openDetailsMap[msg.id];

              return (
                <div key={msg.id} className="ondash-response-card">
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
                  </div>

                  <div className="ondash-summary-text">
                    {data?.summary || msg.content}
                  </div>

                  {data?.next_action && (
                    <div className="ondash-action-pill-box">
                      <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800, marginBottom: '2px', textTransform: 'uppercase' }}>
                        다음 행동
                      </div>
                      {data.next_action}
                    </div>
                  )}

                  <div className="ondash-meta-strip">
                    <span>출처: {data?.source_title || '공식 매뉴얼'}</span>
                    {data?.source_location && <span>({data.source_location})</span>}
                  </div>

                  {/* 정차 중 상세 보기 아코디언 */}
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
                      <span>{isDetailsOpen ? '세부 정보 접기' : '세부 정보 및 원문 보기'}</span>
                      {isDetailsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {isDetailsOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                        {data?.actionSteps && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {data.actionSteps.map((s, idx) => (
                              <div key={idx} style={{ fontSize: '13px', color: '#334155' }}>
                                <strong>{s.step}.</strong> {s.action}
                              </div>
                            ))}
                          </div>
                        )}

                        {data?.manualEvidence && (
                          <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '10px' }}>
                            {data.manualEvidence.map((e, idx) => (
                              <div key={idx}>"{e.excerpt}"</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // 기본 목록 화면
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px' }}>대화 기록</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            이전에 나눈 OnDash 차량 가이드 내역입니다.
          </p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#94a3b8',
          marginTop: '60px',
          padding: '30px',
          background: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.9)'
        }}>
          <Clock size={28} color="#cbd5e1" style={{ marginBottom: '8px' }} />
          <div>저장된 대화 기록이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {conversations.map((conv) => {
            const vehicleSnapshot = conv.vehicle_snapshot
              ? (typeof conv.vehicle_snapshot === 'string' ? JSON.parse(conv.vehicle_snapshot) : conv.vehicle_snapshot)
              : null;

            return (
              <div
                key={conv.id}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.9)',
                  borderRadius: '20px',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(148, 163, 184, 0.08)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={() => handleOpenDetail(conv.id)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginRight: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                    <Calendar size={12} />
                    <span>{formatDate(conv.updated_at || conv.created_at)}</span>
                    {vehicleSnapshot && (
                      <span style={{
                        backgroundColor: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        color: '#334155',
                        fontWeight: 700
                      }}>
                        {vehicleSnapshot.brand} {vehicleSnapshot.model_name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', lineHeight: 1.4 }}>
                    {conv.first_question || conv.title || '새 대화'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('이 대화 기록을 삭제하시겠습니까?')) {
                        onDeleteConversation(conv.id);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      padding: '8px',
                      cursor: 'pointer',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    aria-label="대화 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={16} color="#94a3b8" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

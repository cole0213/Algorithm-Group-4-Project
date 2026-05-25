import { useState, useEffect } from 'react';
import { diffPortfolios } from '../api';

const LABELS = ['A', 'B', 'C', 'D'];

const STYLES = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-panel, #fff)',
    borderRadius: '12px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
    width: 'min(1200px, 95vw)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border, #e5e7eb)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text-primary, #111827)',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  badgeSolar: {
    padding: '3px 9px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
  },
  badgeLocal: {
    padding: '3px 9px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    color: 'var(--text-secondary, #6b7280)',
    lineHeight: 1,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  body: {
    overflowY: 'auto',
    overflowX: 'auto',
    padding: '20px',
    flex: 1,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '120px',
    fontSize: '15px',
    color: 'var(--text-secondary, #6b7280)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    minWidth: '600px',
  },
  th: {
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '13px',
    color: 'var(--text-secondary, #6b7280)',
    background: 'var(--bg-sidebar, #f9fafb)',
    borderBottom: '1px solid var(--border, #e5e7eb)',
  },
  thItem: {
    width: '120px',
  },
  td: {
    padding: '11px 14px',
    verticalAlign: 'top',
    borderBottom: '1px solid var(--border, #e5e7eb)',
    color: 'var(--text-primary, #111827)',
    lineHeight: 1.55,
  },
  tdLabel: {
    fontWeight: 600,
    color: 'var(--text-secondary, #6b7280)',
    background: 'var(--bg-sidebar, #f9fafb)',
    fontSize: '13px',
    width: '120px',
    whiteSpace: 'nowrap',
  },
  tdWinner: {
    position: 'relative',
  },
  winIcon: {
    display: 'inline-block',
    marginLeft: '6px',
    color: '#10B981',
    fontStyle: 'normal',
    fontWeight: 700,
    fontSize: '13px',
  },
  nameChip: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#fff',
    background: 'var(--primary, #4361EE)',
    padding: '1px 6px',
    borderRadius: '4px',
    marginRight: '6px',
  },
};

function CellContent({ value, isWinner }) {
  const text = Array.isArray(value) ? value.join(', ') : (value ?? '—');
  return (
    <td
      className={isWinner ? 'diff-td-winner' : ''}
      style={{ ...STYLES.td, ...(isWinner ? STYLES.tdWinner : {}) }}
    >
      {text}
      {isWinner && <i style={STYLES.winIcon}>✓</i>}
    </td>
  );
}

export default function DiffModal({ applicants, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'focus'
  const [showComments, setShowComments] = useState(true);
  const isTwoPerson = applicants.length === 2;

  const ids = (applicants || []).map(a => a.id);
  const idsKey = ids.join('|');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    diffPortfolios(ids)
      .then(data => {
        if (cancelled) return;
        // API 응답: { diff: { 항목: {A, B, C, winner} | {A, B, C} }, labels, names, solar }
        const labels = data.labels || LABELS.slice(0, applicants.length);
        const items = Object.entries(data.diff || {}).map(([label, val]) => {
          const cells = labels.map(L => val?.[L]);
          const winnerLabel = val?.winner;
          return { label, cells, winnerLabel, labels };
        });
        setResult({ items, labels, solar: data.solar });
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [idsKey]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const labels = LABELS.slice(0, applicants.length);
  const title = applicants.map((a, i) => `${labels[i]}.${a?.name || labels[i]}`).join(' · ');

  return (
    <div className="diff-overlay" style={STYLES.overlay} onClick={handleOverlayClick}>
      <div className="diff-modal" style={STYLES.modal} onClick={e => e.stopPropagation()}>
        <div style={STYLES.header}>
          <h2 style={STYLES.headerTitle}>{title} 비교</h2>
          <div style={STYLES.headerRight}>
            {result && (
              <span
                className={result.solar ? 'diff-badge-solar' : 'diff-badge-local'}
                style={result.solar ? STYLES.badgeSolar : STYLES.badgeLocal}
              >
                {result.solar ? 'Solar AI 분석' : '로컬 비교'}
              </span>
            )}
            <button style={STYLES.closeBtn} onClick={onClose} title="닫기" aria-label="닫기">✕</button>
          </div>
        </div>

        {/* 탭 네비게이션 (2명 비교 시) */}
        {isTwoPerson && !loading && !error && result && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 20px 0', borderBottom: '1px solid var(--border, #e5e7eb)', flexShrink: 0 }}>
            <button
              style={{
                padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: activeTab === 'table' ? 'var(--primary, #4361EE)' : 'none',
                color: activeTab === 'table' ? '#fff' : 'var(--text-secondary, #6b7280)',
                border: 'none', borderRadius: '6px 6px 0 0',
              }}
              onClick={() => setActiveTab('table')}
            >테이블 비교</button>
            <button
              style={{
                padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: activeTab === 'focus' ? 'var(--primary, #4361EE)' : 'none',
                color: activeTab === 'focus' ? '#fff' : 'var(--text-secondary, #6b7280)',
                border: 'none', borderRadius: '6px 6px 0 0',
              }}
              onClick={() => setActiveTab('focus')}
            >집중 비교</button>
            {activeTab === 'focus' && (
              <button
                style={{
                  marginLeft: 'auto', padding: '4px 12px', fontSize: '12px', cursor: 'pointer',
                  background: showComments ? 'var(--primary-light, #EEF2FF)' : 'none',
                  color: 'var(--primary, #4361EE)', border: '1px solid var(--primary, #4361EE)',
                  borderRadius: 6,
                }}
                onClick={() => setShowComments(v => !v)}
              >{showComments ? 'AI 코멘트 숨기기' : 'AI 코멘트 표시'}</button>
            )}
          </div>
        )}

        <div style={STYLES.body}>
          {loading && (<div style={STYLES.center}>{applicants.length}명 비교 분석 중...</div>)}
          {error && (<div style={{ ...STYLES.center, color: '#EF4444' }}>오류: {error}</div>)}
          {!loading && !error && result && activeTab === 'table' && (
            <table className="diff-table" style={STYLES.table}>
              <thead>
                <tr>
                  <th style={{ ...STYLES.th, ...STYLES.thItem }}>항목</th>
                  {applicants.map((a, i) => (
                    <th key={i} style={STYLES.th}>
                      <span style={STYLES.nameChip}>{labels[i]}</span>
                      {a?.name || labels[i]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ ...STYLES.td, ...STYLES.tdLabel }}>{item.label}</td>
                    {item.cells.map((cell, ci) => (
                      <CellContent
                        key={ci}
                        value={cell}
                        isWinner={item.winnerLabel === item.labels[ci]}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !error && result && activeTab === 'focus' && isTwoPerson && (
            <div className="diff-focus-view">
              <div className="diff-focus-header">
                <div className="diff-focus-name">
                  <span style={STYLES.nameChip}>{labels[0]}</span> {applicants[0]?.name}
                </div>
                <div style={{ minWidth: 120, textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>비교</div>
                <div className="diff-focus-name" style={{ textAlign: 'right' }}>
                  <span style={STYLES.nameChip}>{labels[1]}</span> {applicants[1]?.name}
                </div>
              </div>
              {result.items.map((item, idx) => {
                const cellA = Array.isArray(item.cells[0]) ? item.cells[0].join(', ') : (item.cells[0] ?? '—');
                const cellB = Array.isArray(item.cells[1]) ? item.cells[1].join(', ') : (item.cells[1] ?? '—');
                return (
                  <div key={idx} className="diff-focus-row">
                    <div className="diff-focus-section-label">{item.label}</div>
                    <div className="diff-focus-content">
                      <div className="diff-focus-left">{cellA}</div>
                      <div className="diff-focus-arrow">
                        {showComments && item.winnerLabel && item.winnerLabel !== '동등' && (
                          <span className="diff-arrow-comment">
                            {item.winnerLabel === labels[0] ? `${applicants[0]?.name || labels[0]} 우세` : `${applicants[1]?.name || labels[1]} 우세`}
                          </span>
                        )}
                        {showComments && item.winnerLabel === '동등' && (
                          <span className="diff-arrow-comment">동등</span>
                        )}
                        <span className="diff-arrow">←→</span>
                      </div>
                      <div className="diff-focus-right">{cellB}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

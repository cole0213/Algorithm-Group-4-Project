import { useState, useEffect } from 'react';
import { diffPortfolios } from '../api';

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
    width: 'min(900px, 95vw)',
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

export default function DiffModal({ applicantA, applicantB, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    diffPortfolios(applicantA.id, applicantB.id)
      .then(data => {
        if (!cancelled) {
          // API 응답: { diff: { 경력: {A, B, winner}, ... }, solar, name_a, name_b }
          const items = Object.entries(data.diff || {}).map(([label, val]) => ({
            label,
            a: val.A,
            b: val.B,
            winner: val.winner === 'A' ? 'a' : val.winner === 'B' ? 'b' : null,
          }));
          setResult({ items, solar: data.solar });
          setLoading(false);
        }
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [applicantA.id, applicantB.id]);

  // Esc 키로 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const nameA = applicantA?.name || applicantA?.id || 'A';
  const nameB = applicantB?.name || applicantB?.id || 'B';

  return (
    <div className="diff-overlay" style={STYLES.overlay} onClick={handleOverlayClick}>
      <div className="diff-modal" style={STYLES.modal} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={STYLES.header}>
          <h2 style={STYLES.headerTitle}>{nameA} vs {nameB}</h2>
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

        {/* 본문 */}
        <div style={STYLES.body}>
          {loading && (
            <div style={STYLES.center}>비교 분석 중...</div>
          )}
          {error && (
            <div style={{ ...STYLES.center, color: '#EF4444' }}>오류: {error}</div>
          )}
          {!loading && !error && result && (
            <table className="diff-table" style={STYLES.table}>
              <thead>
                <tr>
                  <th style={{ ...STYLES.th, ...STYLES.thItem }}>항목</th>
                  <th style={STYLES.th}>{nameA}</th>
                  <th style={STYLES.th}>{nameB}</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(result.items) && result.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ ...STYLES.td, ...STYLES.tdLabel }}>{item.label}</td>
                    <CellContent value={item.a} isWinner={item.winner === 'a'} />
                    <CellContent value={item.b} isWinner={item.winner === 'b'} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

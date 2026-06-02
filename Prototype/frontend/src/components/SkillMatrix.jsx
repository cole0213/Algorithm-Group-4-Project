import { useEffect } from 'react';

export default function SkillMatrix({ applicants, onClose, onExportCsv }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 빈도 내림차순으로 스킬 정렬
  const allSkills = [...new Set(
    applicants.flatMap(a => a.skills || [])
  )].sort((a, b) => {
    const ca = applicants.filter(ap => (ap.skills || []).includes(a)).length;
    const cb = applicants.filter(ap => (ap.skills || []).includes(b)).length;
    return cb - ca;
  });

  return (
    <div className="matrix-overlay" onClick={onClose}>
      <div className="matrix-modal" onClick={e => e.stopPropagation()}>
        <div className="matrix-header">
          <span className="matrix-title">
            스킬 매트릭스
          </span>
          <span className="matrix-subtitle">
            {applicants.length}명 · {allSkills.length}개 스킬
          </span>
          {onExportCsv && (
            <button className="matrix-export-btn" onClick={onExportCsv} title="CSV로 내보내기">
              ↓ CSV
            </button>
          )}
          <button className="matrix-close" onClick={onClose}>✕</button>
        </div>

        <div className="matrix-body">
          <table className="matrix-table">
            <thead>
              <tr>
                {/* 스킬 헤더 셀 */}
                <th className="matrix-skill-header">스킬</th>
                {/* 지원자 이름 — 가로 텍스트 */}
                {applicants.map(a => (
                  <th key={a.id} className="matrix-applicant-col">
                    <span className="matrix-applicant-name">{a.name || a.id}</span>
                  </th>
                ))}
                {/* 보유 인원 수 열 */}
                <th className="matrix-count-col">보유</th>
              </tr>
            </thead>
            <tbody>
              {allSkills.map(s => {
                const holders = applicants.filter(a => (a.skills || []).includes(s));
                const ratio = holders.length / applicants.length;
                return (
                  <tr key={s} className="matrix-row">
                    {/* 스킬명 */}
                    <td className="matrix-skill-cell">{s}</td>
                    {/* 지원자별 보유 여부 */}
                    {applicants.map(a => {
                      const has = (a.skills || []).includes(s);
                      return (
                        <td key={a.id} className={`matrix-cell ${has ? 'has-skill' : 'no-skill'}`}>
                          {has ? '✓' : '·'}
                        </td>
                      );
                    })}
                    {/* 보유 인원 / 비율 */}
                    <td className="matrix-count-cell">
                      <span
                        className="matrix-ratio-bar"
                        style={{ '--ratio': ratio }}
                      >
                        {holders.length}/{applicants.length}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

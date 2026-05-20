export default function SkillMatrix({ applicants, onClose }) {
  // 모든 스킬 수집 (중복 제거, 빈도순 정렬)
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
            스킬 매트릭스 — {applicants.length}명 × {allSkills.length}개 스킬
          </span>
          <button className="matrix-close" onClick={onClose}>✕</button>
        </div>
        <div className="matrix-body">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="matrix-name-col">지원자</th>
                {allSkills.map(s => (
                  <th key={s} className="matrix-skill-col">
                    <span className="matrix-skill-label">{s}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applicants.map(a => (
                <tr key={a.id}>
                  <td className="matrix-name-cell">{a.name}</td>
                  {allSkills.map(s => (
                    <td
                      key={s}
                      className={`matrix-cell ${(a.skills || []).includes(s) ? 'has-skill' : 'no-skill'}`}
                    >
                      {(a.skills || []).includes(s) ? '✓' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

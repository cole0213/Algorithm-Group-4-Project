function matchClass(pct) {
  if (pct >= 70) return 'match-high';
  if (pct >= 40) return 'match-mid';
  return 'match-low';
}

export default function Sidebar({ applicants, selectedIds, onToggle, onDelete }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        지원자 목록 · {applicants.length}명
      </div>
      <div className="sidebar-list">
        {applicants.map((a, idx) => (
          <div
            key={a.id}
            className={`applicant-item ${selectedIds.includes(a.id) ? 'selected' : ''}`}
            onClick={() => onToggle(a.id)}
          >
            <div className="applicant-item-top">
              <span className="applicant-name">
                지원자{idx + 1} {a.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className={`match-badge ${matchClass(a.match_score)}`}>
                  {a.match_score}%
                </span>
                <button
                  className="sidebar-delete-btn"
                  title="삭제"
                  onClick={e => { e.stopPropagation(); onDelete(a.id); }}
                >✕</button>
              </div>
            </div>
            <div className="applicant-skills">
              {(a.skills || []).slice(0, 4).join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

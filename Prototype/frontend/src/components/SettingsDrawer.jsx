const SETTINGS = [
  { key: 'highlight',    label: '스킬 하이라이트' },
  { key: 'similar',      label: '유사 문장 표시' },
  { key: 'hideSimlar',   label: '유사 문장 숨기기 (흐리게)' },
  { key: 'syncScroll',   label: '동기화 스크롤' },
  { key: 'originalLink', label: '원본 링크 버튼' },
  { key: 'aliasSearch',  label: '별칭 통합 검색' },
];

export default function SettingsDrawer({ settings, onToggle, onClose }) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">설정</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          {SETTINGS.map(({ key, label }) => (
            <div key={key} className="drawer-row">
              <span>{label}</span>
              <div
                className={`toggle-pill ${settings[key] ? 'on' : ''}`}
                onClick={() => onToggle(key)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

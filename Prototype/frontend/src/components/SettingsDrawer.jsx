import { useState } from 'react';

const TOGGLES = [
  { key: 'highlight',    label: '스킬 하이라이트' },
  { key: 'similar',      label: '유사 문장 표시' },
  { key: 'hideSimlar',   label: '유사 문장 숨기기 (흐리게)' },
  { key: 'syncScroll',   label: '동기화 스크롤' },
  { key: 'originalLink', label: '원본 링크 버튼' },
  { key: 'aliasSearch',  label: '별칭 통합 검색' },
];

// 색상 커스텀 팔레트 (9가지 프리셋)
const COLOR_PRESETS = [
  '#DC2626','#EA580C','#D97706','#65A30D',
  '#0D9488','#0284C7','#6366F1','#7C3AED','#DB2777',
];

const GROUP_LABELS = ['그룹 1','그룹 2','그룹 3','그룹 4','그룹 5','그룹 6'];

export default function SettingsDrawer({
  settings, onToggle,
  similarScope, onScopeChange,
  groupColors, onColorChange,
  onRefreshSimilar,
  onClose,
}) {
  const [openGroup, setOpenGroup] = useState(null); // 색상 팔레트 열린 그룹 index

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">설정</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">

          {/* ── 기본 토글 ── */}
          {TOGGLES.map(({ key, label }) => (
            <div key={key} className="drawer-row">
              <span>{label}</span>
              <div
                className={`toggle-pill ${settings[key] ? 'on' : ''}`}
                onClick={() => onToggle(key)}
              />
            </div>
          ))}

          {/* ── 유사 문장 감지 설정 ── */}
          <div className="drawer-section-title">유사 문장 감지 설정</div>

          {/* 감지 범위 */}
          <div className="drawer-row">
            <span>감지 범위</span>
            <div className="scope-toggle">
              <button
                className={`scope-btn ${similarScope === 'all' ? 'active' : ''}`}
                onClick={() => onScopeChange('all')}
              >전체</button>
              <button
                className={`scope-btn ${similarScope === 'open' ? 'active' : ''}`}
                onClick={() => onScopeChange('open')}
              >열린 패널</button>
            </div>
          </div>

          {/* 범위 설명 */}
          <p className="drawer-hint">
            {similarScope === 'all'
              ? '저장된 포트폴리오 전체에서 유사 문장을 검출합니다.'
              : '현재 열린 패널 간에서만 유사 문장을 검출합니다.'}
          </p>

          {/* 그룹 색상 커스텀 */}
          <div className="drawer-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
            <span>그룹 색상</span>
            <div className="group-color-list">
              {groupColors.map((color, idx) => (
                <div key={idx} className="group-color-item">
                  <span className="group-color-label">{GROUP_LABELS[idx]}</span>
                  <button
                    className="color-swatch"
                    style={{ background: color }}
                    title={`${GROUP_LABELS[idx]} 색상 변경`}
                    onClick={() => setOpenGroup(openGroup === idx ? null : idx)}
                  />
                  {openGroup === idx && (
                    <div className="color-palette">
                      {COLOR_PRESETS.map(preset => (
                        <button
                          key={preset}
                          className={`color-preset ${color === preset ? 'selected' : ''}`}
                          style={{ background: preset }}
                          onClick={() => {
                            onColorChange(idx, preset);
                            setOpenGroup(null);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 수동 재실행 버튼 */}
          <button className="drawer-refresh-btn" onClick={onRefreshSimilar}>
            ↻ 유사 문장 재검출
          </button>

        </div>
      </div>
    </div>
  );
}

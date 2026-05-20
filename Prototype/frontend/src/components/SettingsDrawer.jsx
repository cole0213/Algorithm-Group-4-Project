import { useState } from 'react';

const TOGGLES = [
  { key: 'highlight',    label: '스킬 하이라이트',          desc: '필요 스펙과 일치하는 기술을 주황색으로 표시합니다.' },
  { key: 'similar',      label: '유사 문장 표시',            desc: '포트폴리오 간 유사한 문장을 색상으로 강조합니다.' },
  { key: 'hideSimlar',   label: '유사 문장 흐리게',          desc: '유사 문장을 강조 대신 흐리게 처리하여 숨깁니다.' },
  { key: 'syncScroll',   label: '동기화 스크롤',             desc: '열린 패널들을 같은 위치로 동시에 스크롤합니다.' },
  { key: 'originalLink', label: '원본 보기 버튼',            desc: '패널 하단에 원본 파일 텍스트 확인 버튼을 표시합니다.' },
  { key: 'aliasSearch',  label: '별칭 통합 검색',            desc: '"파이썬", "py" 등 동의어로도 검색 결과를 찾아줍니다.' },
  { key: 'blind',        label: '블라인드 심사 모드',        desc: '지원자 이름을 가려 무의식적 편향을 방지합니다.' },
  { key: 'dark',         label: '다크 모드',                desc: '어두운 테마로 전환합니다.' },
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
  weights,
  onWeightsChange,
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
          {TOGGLES.map(({ key, label, desc }) => (
            <div key={key} className="drawer-row">
              <div className="drawer-row-info">
                <span className="drawer-row-label">{label}</span>
                <span className="drawer-row-desc">{desc}</span>
              </div>
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

          {/* ── 매칭 점수 가중치 슬라이더 ── */}
          {weights && (
            <div className="settings-section">
              <div className="settings-section-title">매칭 점수 가중치</div>
              {[
                { key: 'skill',   label: '스킬 일치' },
                { key: 'career',  label: '경력' },
                { key: 'project', label: '프로젝트 수' },
              ].map(({ key, label }) => (
                <div key={key} className="weight-row">
                  <span className="weight-label">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weights[key]}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const others = Object.keys(weights).filter(k => k !== key);
                      const remaining = 100 - val;
                      const total = others.reduce((s, k) => s + weights[k], 0);
                      const next = { ...weights, [key]: val };
                      if (total > 0) {
                        others.forEach(k => { next[k] = Math.round(weights[k] / total * remaining); });
                      } else {
                        const per = Math.floor(remaining / others.length);
                        others.forEach((k, i) => { next[k] = i === 0 ? remaining - per * (others.length - 1) : per; });
                      }
                      onWeightsChange?.(next);
                    }}
                    className="weight-slider"
                  />
                  <span className="weight-value">{weights[key]}%</span>
                </div>
              ))}
              <div className="weight-total">합계: {Object.values(weights).reduce((s, v) => s + v, 0)}%</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

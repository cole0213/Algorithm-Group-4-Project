import { useState } from 'react';

// 팔레트 테마 정의
export const SIMILAR_PALETTES = [
  {
    id: 'dim',
    name: '흐리게 보기',
    desc: '유사 문장을 흐리게 처리합니다 (기본)',
    colors: ['#9CA3AF', '#9CA3AF', '#9CA3AF', '#9CA3AF', '#9CA3AF', '#9CA3AF'],
    isDefault: true,
  },
  {
    id: 'single',
    name: '단일 색상',
    desc: '모든 유사 문장을 같은 색상으로 표시합니다',
    colors: ['#4361EE', '#4361EE', '#4361EE', '#4361EE', '#4361EE', '#4361EE'],
  },
  {
    id: 'colorful',
    name: '컬러풀',
    desc: '유사 문장 그룹을 다양한 색상으로 구분합니다',
    // 백엔드 rabin_karp.py의 _GROUP_COLORS와 순서·값 동일하게 유지
    colors: ['#DC2626', '#EA580C', '#0284C7', '#65A30D', '#7C3AED', '#0D9488'],
  },
];

const TOGGLES = [
  { key: 'highlight',      label: '스킬 하이라이트',          desc: '필요 스펙과 일치하는 기술을 주황색으로 표시합니다.' },
  { key: 'similar',        label: '유사 문장 표시',            desc: '포트폴리오 간 유사한 문장을 색상으로 강조합니다.' },
  { key: 'hideSimlar',     label: '유사 문장 흐리게',          desc: '유사 문장을 강조 대신 흐리게 처리하여 숨깁니다.' },
  { key: 'syncScroll',     label: '동기화 스크롤',             desc: '열린 패널들을 같은 위치로 동시에 스크롤합니다.' },
  { key: 'panelAnimation', label: '패널 추가 애니메이션',      desc: '새 패널 열릴 때 슬라이드 효과. 성능이 낮은 기기에서는 끄세요.' },
  { key: 'originalLink',   label: '원본 보기 버튼',            desc: '패널 하단에 원본 파일 텍스트 확인 버튼을 표시합니다.' },
  { key: 'aliasSearch',    label: '별칭 통합 검색',            desc: '"파이썬", "py" 등 동의어로도 검색 결과를 찾아줍니다.' },
  { key: 'blind',          label: '블라인드 심사 모드',        desc: '지원자 이름을 가려 무의식적 편향을 방지합니다.' },
  { key: 'dark',           label: '다크 모드',                desc: '어두운 테마로 전환합니다.' },
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
  selectedPalette, onPaletteChange,
  onRefreshSimilar,
  weights,
  onWeightsChange,
  onClose,
}) {
  const [openGroup, setOpenGroup] = useState(null); // 색상 팔레트 열린 그룹 index (legacy)
  const [editingWeights, setEditingWeights] = useState(false);
  const [localWeights, setLocalWeights] = useState(null);

  const handleStartEdit = () => {
    setLocalWeights({ ...weights });
    setEditingWeights(true);
  };

  const handleApplyWeights = () => {
    const total = Object.values(localWeights).reduce((s, v) => s + v, 0);
    if (total > 0) {
      const normalized = {};
      const keys = Object.keys(localWeights);
      let sum = 0;
      keys.forEach((k, i) => {
        if (i === keys.length - 1) {
          normalized[k] = 100 - sum;
        } else {
          normalized[k] = Math.round(localWeights[k] / total * 100);
          sum += normalized[k];
        }
      });
      onWeightsChange?.(normalized);
    }
    setEditingWeights(false);
    setLocalWeights(null);
  };

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

          {/* 유사 문장 표기 팔레트 */}
          <div className="drawer-section-title">유사 문장 표기 팔레트</div>
          <div className="palette-list">
            {SIMILAR_PALETTES.map(palette => (
              <div
                key={palette.id}
                className={`palette-item ${selectedPalette === palette.id ? 'selected' : ''}`}
                onClick={() => onPaletteChange?.(palette.id)}
              >
                <div className="palette-colors">
                  {palette.colors.slice(0, 3).map((c, i) => (
                    <span key={i} className="palette-color-dot" style={{ background: c }} />
                  ))}
                </div>
                <div>
                  <div className="palette-name">{palette.name}{palette.isDefault ? ' (기본)' : ''}</div>
                  <div className="palette-desc">{palette.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 수동 재실행 버튼 */}
          <button className="drawer-refresh-btn" onClick={onRefreshSimilar}>
            ↻ 유사 문장 재검출
          </button>

          {/* ── 매칭 점수 가중치 슬라이더 ── */}
          {weights && (
            <div className="settings-section">
              <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>매칭 점수 가중치</span>
                {editingWeights
                  ? <button className="weight-edit-btn apply" onClick={handleApplyWeights}>적용</button>
                  : <button className="weight-edit-btn" onClick={handleStartEdit}>수정</button>
                }
              </div>
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
                    value={editingWeights ? (localWeights?.[key] ?? weights[key]) : weights[key]}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (editingWeights) {
                        setLocalWeights(prev => ({ ...prev, [key]: val }));
                      } else {
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
                      }
                    }}
                    className="weight-slider"
                  />
                  {editingWeights ? (
                    <input
                      type="number"
                      className="weight-input"
                      min={0}
                      max={100}
                      value={localWeights?.[key] ?? weights[key]}
                      onChange={e => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setLocalWeights(prev => ({ ...prev, [key]: val }));
                      }}
                    />
                  ) : (
                    <span className="weight-value">{weights[key]}%</span>
                  )}
                </div>
              ))}
              <div className="weight-total">
                합계: {editingWeights
                  ? Object.values(localWeights || {}).reduce((s, v) => s + v, 0)
                  : Object.values(weights).reduce((s, v) => s + v, 0)}%
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

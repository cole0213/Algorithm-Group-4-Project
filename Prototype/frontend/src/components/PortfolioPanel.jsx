import { forwardRef, useState } from 'react';
import { fetchRaw } from '../api';

const ACCENT_COLORS = ['#7C3AED','#EA580C','#2DC653','#DC2626','#0284C7','#65A30D'];

function matchClass(pct) {
  if (pct >= 70) return 'match-high';
  if (pct >= 40) return 'match-mid';
  return 'match-low';
}

// 유사 문장 하이라이트: 텍스트를 [일반, 하이라이트] 파트로 분할
function applySimilarHighlight(text, spans, enabled, hide) {
  if (!enabled || !spans?.length) return text;

  let parts = [{ text, highlighted: false }];
  for (const sp of spans) {
    if (!sp.text) continue;
    const next = [];
    for (const part of parts) {
      if (part.highlighted) { next.push(part); continue; }
      const idx = part.text.indexOf(sp.text);
      if (idx === -1) { next.push(part); continue; }
      if (idx > 0) next.push({ text: part.text.slice(0, idx), highlighted: false });
      next.push({ text: sp.text, highlighted: true, color: sp.color });
      const rest = part.text.slice(idx + sp.text.length);
      if (rest) next.push({ text: rest, highlighted: false });
    }
    parts = next;
  }

  return parts.map((part, i) => {
    if (!part.highlighted) return part.text;
    if (hide) return (
      <span key={i} style={{ opacity: 0.3 }}>{part.text}</span>
    );
    return (
      <mark key={i} style={{
        background: part.color + '22',
        borderBottom: `2px solid ${part.color}`,
        borderRadius: '2px',
        padding: '0 1px',
      }}>
        {part.text}
      </mark>
    );
  });
}

// 검색어 하이라이트: 텍스트에서 query를 찾아 <mark>로 감쌈
function applySearchHighlight(text, query) {
  if (!query || typeof text !== 'string') return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="search-highlight">{p}</mark>
      : p
  );
}

const PortfolioPanel = forwardRef(function PortfolioPanel(
  { applicant, accentIdx, onClose, similarSpans, settings, searchQuery },
  ref
) {
  const a = applicant;
  const accent = ACCENT_COLORS[accentIdx % ACCENT_COLORS.length];
  const skillsMatch = a.skills_match || {};
  const [rawState, setRawState] = useState(null); // null | 'loading' | { raw, ext } | 'none'

  async function handleRawOpen() {
    setRawState('loading');
    try {
      const result = await fetchRaw(a.id);
      setRawState(result ?? 'none');
    } catch {
      setRawState('none');
    }
  }

  function renderText(text) {
    const withSimilar = applySimilarHighlight(text, similarSpans, settings.similar, settings.hideSimlar);
    if (!searchQuery || typeof withSimilar !== 'string') return withSimilar;
    return applySearchHighlight(withSimilar, searchQuery);
  }

  const introLines = (a.intro || '').split('\n').map((line, i) => (
    <p key={i} className="md-p">{renderText(line)}</p>
  ));

  return (
    <div className="portfolio-panel" style={{ '--accent': accent }}>
      {/* 탭 */}
      <div className="panel-tab">
        <div className="panel-tab-name">
          {a.name}
          <span className={`match-badge ${matchClass(a.match_score)}`}>
            {a.match_score}%
          </span>
        </div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      {/* 본문 */}
      <div className="panel-body" ref={ref}>

        <div className="md-h1">{a.name} 포트폴리오</div>

        {/* 기본 정보 */}
        <div className="md-h2">기본 정보</div>
        <ul className="md-ul">
          <li className="md-li"><span className="md-bold">경력</span>&ensp;{a.career_years}년</li>
          <li className="md-li"><span className="md-bold">학력</span>&ensp;{a.education}</li>
          {a.email && <li className="md-li"><span className="md-bold">이메일</span>&ensp;{a.email}</li>}
          {a.github && <li className="md-li"><span className="md-bold">GitHub</span>&ensp;{a.github}</li>}
        </ul>

        {/* 기술 스택 */}
        <div className="md-h2">기술 스택</div>
        <div className="skill-badges">
          {(a.skills || []).map(s => (
            <span
              key={s}
              className={`skill-badge ${settings.highlight && skillsMatch[s] ? 'matched' : ''}`}
            >
              {s}
            </span>
          ))}
        </div>

        {/* 자기소개 */}
        <div className="md-h2">자기소개</div>
        {introLines}

        {/* 프로젝트 */}
        <div className="md-h2">프로젝트</div>
        {(a.projects || []).map((p, i) => (
          <div key={i}>
            <p className="md-h3">{p.name}</p>
            <ul className="md-ul">
              <li className="md-li">
                <span className="md-bold">기간</span>&ensp;{p.period}
                {p.role && ` · ${p.role}`}
              </li>
              {p.stack && (
                <li className="md-li">
                  <span className="md-bold">기술</span>&ensp;{p.stack}
                </li>
              )}
              {p.desc && <li className="md-li">{renderText(p.desc)}</li>}
            </ul>
          </div>
        ))}

        {/* 수상 및 활동 */}
        {a.awards?.length > 0 && (
          <>
            <div className="md-h2">수상 및 활동</div>
            <ul className="md-ul">
              {a.awards.map((aw, i) => (
                <li key={i} className="md-li">{aw}</li>
              ))}
            </ul>
          </>
        )}

        {/* 원본 보기 */}
        {settings.originalLink && (
          <button
            className="original-btn"
            onClick={handleRawOpen}
            disabled={rawState === 'loading'}
          >
            {rawState === 'loading' ? '불러오는 중...' : '원본 보기 →'}
          </button>
        )}
      </div>

      {/* 원본 뷰어 모달 (패널 위에 띄움) */}
      {rawState && rawState !== 'loading' && (
        <div className="raw-overlay" onClick={() => setRawState(null)}>
          <div className="raw-modal" onClick={e => e.stopPropagation()}>
            <div className="raw-modal-header">
              <span className="raw-modal-title">원본 포트폴리오 — {a.name}</span>
              <button className="drawer-close" onClick={() => setRawState(null)}>✕</button>
            </div>
            <div className="raw-modal-body">
              {rawState === 'none'
                ? <p className="raw-empty">원본 파일이 없습니다.</p>
                : <pre className="raw-pre">{rawState.raw}</pre>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PortfolioPanel;

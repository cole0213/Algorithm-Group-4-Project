import { forwardRef, useState, useRef, useEffect, cloneElement } from 'react';
import { fetchRaw, searchPortfolios } from '../api';

const ACCENT_COLORS = ['#7C3AED','#EA580C','#2DC653','#DC2626','#0284C7','#65A30D'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchClass(pct) {
  if (pct >= 70) return 'match-high';
  if (pct >= 40) return 'match-mid';
  return 'match-low';
}

// 유사 문장 하이라이트
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
    if (hide) return <span key={i} style={{ opacity: 0.3 }}>{part.text}</span>;
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

// 검색어 하이라이트
function applySearchHighlight(text, query, className = 'search-highlight') {
  if (!query || typeof text !== 'string') return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className={className}>{p}</mark>
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

  // 원본 뷰어 상태
  const [rawState, setRawState] = useState(null);

  // 패널 내 검색 (intra)
  const [intraQuery, setIntraQuery] = useState('');
  const [intraActive, setIntraActive] = useState('');  // 실제 하이라이트에 사용되는 쿼리
  const [intraCount, setIntraCount] = useState(null);  // null | number
  const intraTimer = useRef(null);
  const bodyRef = useRef(null);  // panel-body scroll 참조

  // 패널별 유사 문장 숨기기 (전역 설정 독립)
  const [localHide, setLocalHide] = useState(null); // null=전역따름 | true | false
  const effectiveHide = localHide !== null ? localHide : settings.hideSimlar;
  const hasSimilar = settings.similar && similarSpans?.length > 0;

  // intra 검색 debounce
  useEffect(() => {
    clearTimeout(intraTimer.current);
    if (!intraQuery.trim()) {
      setIntraActive('');
      setIntraCount(null);
      return;
    }
    intraTimer.current = setTimeout(async () => {
      const q = intraQuery.trim();
      setIntraActive(q);
      // 백엔드 BST 검색 호출 (알고리즘 시연용 — 카운트는 화면 텍스트 기준으로 보정)
      try {
        await searchPortfolios(q, 'intra', a.id); // BST 동작 검증용 (결과 무시)
      } catch { /* silent */ }
      // 실제 표시 카운트: 화면에 렌더링되는 텍스트에서 직접 계산
      const visibleText = [
        a.intro || '',
        ...(a.projects || []).map(p => p.desc || ''),
      ].join('\n');
      const matches = visibleText.match(new RegExp(escapeRegex(q), 'gi'));
      setIntraCount(matches ? matches.length : 0);
    }, 300);
    return () => clearTimeout(intraTimer.current);
  }, [intraQuery, a.id]);

  // intra 검색 후 첫 번째 하이라이트로 스크롤
  useEffect(() => {
    if (!intraActive || !bodyRef.current) return;
    const el = bodyRef.current.querySelector('.intra-highlight');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [intraActive]);

  async function handleRawOpen() {
    setRawState('loading');
    try {
      const result = await fetchRaw(a.id);
      setRawState(result ?? 'none');
    } catch {
      setRawState('none');
    }
  }

  // 텍스트 렌더링: 유사 문장 → 전역 검색어 → intra 검색어 순으로 적용
  // applySimilarHighlight가 JSX 배열을 반환해도 각 string 파트에 재귀 적용
  function applyQueryHighlights(node, sq, ia) {
    if (!sq && !ia) return node;
    if (!node && node !== 0) return node;
    if (typeof node === 'string') {
      let r = node;
      if (sq) r = applySearchHighlight(r, sq, 'search-highlight');
      if (ia && typeof r === 'string') r = applySearchHighlight(r, ia, 'intra-highlight');
      return r;
    }
    if (Array.isArray(node)) return node.map(n => applyQueryHighlights(n, sq, ia));
    // React element — children 내부만 재귀
    if (node?.props?.children !== undefined) {
      const newChildren = applyQueryHighlights(node.props.children, sq, ia);
      return cloneElement(node, {}, newChildren);
    }
    return node;
  }

  function renderText(text) {
    const withSimilar = applySimilarHighlight(text, similarSpans, settings.similar, effectiveHide);
    return applyQueryHighlights(withSimilar, searchQuery, intraActive);
  }

  const introLines = (a.intro || '').split('\n').map((line, i) => (
    <p key={i} className="md-p">{renderText(line)}</p>
  ));

  // panel-body에 두 개의 ref(외부 scroll sync용 + 내부 intra scroll용) 연결
  function setBodyRef(el) {
    bodyRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }

  return (
    <div className="portfolio-panel" style={{ '--accent': accent }}>
      {/* 절단 경고 */}
      {a._truncated && (
        <div className="panel-truncated-warn">
          ⚠ 원문이 길어 일부만 처리되었습니다. 원본 보기로 전체 내용을 확인하세요.
        </div>
      )}
      {/* 탭 */}
      <div className="panel-tab">
        <div className="panel-tab-name">
          {a.name}
          <span className={`match-badge ${matchClass(a.match_score)}`}>
            {a.match_score}%
          </span>
          {a._solar_used && (
            <span className="panel-ai-label" title="Solar LLM으로 파싱된 결과입니다. 원본 보기로 내용을 확인하세요.">
              AI
            </span>
          )}
        </div>
        <div className="panel-tab-actions">
          {/* 패널별 유사 문장 숨기기 버튼 */}
          {hasSimilar && (
            <button
              className={`panel-action-btn ${effectiveHide ? 'active' : ''}`}
              title={effectiveHide ? '유사 문장 표시' : '유사 문장 숨기기'}
              onClick={() => setLocalHide(h => h === null ? !settings.hideSimlar : !h)}
            >
              {effectiveHide ? '👁' : '🙈'}
            </button>
          )}
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* 패널 내 검색 바 */}
      <div className="intra-search-bar">
        <input
          className="intra-search-input"
          type="text"
          placeholder="이 포트폴리오 내 검색..."
          value={intraQuery}
          onChange={e => setIntraQuery(e.target.value)}
        />
        {intraActive && (
          <span className="intra-search-count">
            {intraCount === null ? '…' : intraCount === 0 ? '없음' : `${intraCount}건`}
          </span>
        )}
        {intraQuery && (
          <button
            className="intra-search-clear"
            onClick={() => { setIntraQuery(''); setIntraActive(''); setIntraCount(null); }}
          >✕</button>
        )}
      </div>

      {/* 본문 */}
      <div className="panel-body" ref={setBodyRef}>

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

      {/* 원본 뷰어 모달 */}
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

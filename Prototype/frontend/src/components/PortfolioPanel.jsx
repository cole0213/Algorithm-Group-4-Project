import { forwardRef, useState, useRef, useEffect, cloneElement } from 'react';
import { fetchRaw, searchPortfolios, reanalyzePortfolio } from '../api';

const ACCENT_COLORS = ['#7C3AED','#EA580C','#2DC653','#DC2626','#0284C7','#65A30D'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// URL을 클릭 가능한 링크로 변환
function linkify(text) {
  if (!text || typeof text !== 'string') return text;
  const urlRe = /(https?:\/\/[^\s]+|github\.com\/[^\s]+|linkedin\.com\/[^\s]+)/gi;
  const parts = text.split(urlRe);
  return parts.map((part, i) => {
    if (urlRe.test(part)) {
      urlRe.lastIndex = 0;
      const href = part.startsWith('http') ? part : `https://${part}`;
      return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="portfolio-link">{part}</a>;
    }
    urlRe.lastIndex = 0;
    return part;
  });
}

function matchClass(pct) {
  if (pct === 0)  return 'match-none';
  if (pct >= 70)  return 'match-high';
  if (pct >= 40)  return 'match-mid';
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

// 코드블럭(```) 포함 마크다운 파싱
function parseMarkdownWithCodeBlock(text) {
  if (!text || typeof text !== 'string') return text;
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  const parts = [];
  let last = 0, m;
  while ((m = codeBlockRe.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{parseInlineMarkdown(text.slice(last, m.index))}</span>);
    parts.push(
      <pre key={m.index} className="md-code-block">
        <code>{m[2]}</code>
      </pre>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={last}>{parseInlineMarkdown(text.slice(last))}</span>);
  return parts.length > 1 ? parts : parseInlineMarkdown(text);
}

// 마크다운 인라인 파싱: **bold**, *italic*, `code`
function parseInlineMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  const parts = [];
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith('**')) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[0].startsWith('*')) parts.push(<em key={m.index}>{m[3]}</em>);
    else parts.push(<code key={m.index} className="md-inline-code">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 1 ? parts : text;
}

// 원본 뷰어용 마크다운 렌더러
function renderMarkdown(text) {
  if (!text) return <p className="raw-empty">내용이 없습니다.</p>;

  const inlineRender = (str) => {
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    const parts = [];
    let last = 0, m;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index));
      if (m[0].startsWith('**')) parts.push(<strong key={m.index}>{m[2]}</strong>);
      else if (m[0].startsWith('*')) parts.push(<em key={m.index}>{m[3]}</em>);
      else parts.push(<code key={m.index} className="raw-md-code">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts.length > 0 ? parts : str;
  };

  const lines = text.split('\n');
  const result = [];
  let listBuf = [];
  let listOrdered = false;

  const flushList = () => {
    if (!listBuf.length) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    result.push(<Tag key={`list-${result.length}`} className="raw-md-list">{listBuf}</Tag>);
    listBuf = [];
  };

  lines.forEach((line, i) => {
    if (/^### /.test(line))      { flushList(); result.push(<h3 key={i} className="raw-md-h3">{inlineRender(line.slice(4))}</h3>); }
    else if (/^## /.test(line))  { flushList(); result.push(<h2 key={i} className="raw-md-h2">{inlineRender(line.slice(3))}</h2>); }
    else if (/^# /.test(line))   { flushList(); result.push(<h1 key={i} className="raw-md-h1">{inlineRender(line.slice(2))}</h1>); }
    else if (/^[-*] /.test(line)) {
      if (listBuf.length && listOrdered) flushList();
      listOrdered = false;
      listBuf.push(<li key={i}>{inlineRender(line.slice(2))}</li>);
    }
    else if (/^\d+\. /.test(line)) {
      if (listBuf.length && !listOrdered) flushList();
      listOrdered = true;
      listBuf.push(<li key={i}>{inlineRender(line.replace(/^\d+\. /, ''))}</li>);
    }
    else if (/^> /.test(line))   { flushList(); result.push(<blockquote key={i} className="raw-md-blockquote">{inlineRender(line.slice(2))}</blockquote>); }
    else if (/^---+$/.test(line.trim())) { flushList(); result.push(<hr key={i} className="raw-md-hr" />); }
    else if (line.trim() === '')  { flushList(); }
    else                          { flushList(); result.push(<p key={i} className="raw-md-p">{inlineRender(line)}</p>); }
  });
  flushList();
  return result;
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

const NOTES_KEY = 'portfolio-reviewer-notes';
function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; }
  catch { return {}; }
}

const PortfolioPanel = forwardRef(function PortfolioPanel(
  { applicant, accentIdx, onClose, similarSpans, settings, searchQuery, onReanalyze, isFiltered, blind, initialScrollTop, onScrollChange },
  ref
) {
  const a = applicant;
  const accent = ACCENT_COLORS[accentIdx % ACCENT_COLORS.length];
  const skillsMatch = a.skills_match || {};

  // 메모
  const [allNotes, setAllNotes] = useState(loadNotes);
  const noteValue = allNotes[a.id] ?? '';
  const noteTimer = useRef(null);
  function handleNoteChange(e) {
    const val = e.target.value;
    setAllNotes(prev => {
      const next = { ...prev, [a.id]: val };
      clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => {
        try { localStorage.setItem(NOTES_KEY, JSON.stringify(next)); } catch {}
      }, 400);
      return next;
    });
  }

  // 원본 뷰어 상태
  const [rawState, setRawState] = useState(null);
  const [rawViewMode, setRawViewMode] = useState('raw'); // 'raw' | 'md'

  // Solar AI 재분석 상태
  const [reanalyzeState, setReanalyzeState] = useState(null); // null | 'loading' | 'done' | 'error'

  // 패널 내 검색 (intra)
  const [intraQuery, setIntraQuery] = useState('');
  const [intraActive, setIntraActive] = useState('');  // 실제 하이라이트에 사용되는 쿼리
  const [intraCount, setIntraCount] = useState(null);  // null | number
  const [intraIndex, setIntraIndex] = useState(0);
  const intraTimer = useRef(null);
  const bodyRef = useRef(null);  // panel-body scroll 참조
  const scrollSaveTimer = useRef(null);

  // 마운트 시 초기 스크롤 위치 복원
  useEffect(() => {
    if (bodyRef.current && initialScrollTop) {
      bodyRef.current.scrollTop = initialScrollTop;
    }
  }, []); // 마운트 시 1회만

  // 스킬 태그 접기/펼치기
  const [showAllSkills, setShowAllSkills] = useState(false);
  const SKILL_LIMIT = 5;

  // 섹션 아코디언
  const [collapsed, setCollapsed] = useState({});
  function toggleSection(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }
  function SectionHeader({ sKey, label }) {
    const open = !collapsed[sKey];
    return (
      <div className="section-header" onClick={() => toggleSection(sKey)}>
        <span className="md-h2" style={{ margin: 0 }}>{label}</span>
        <span className="section-toggle">{open ? '▾' : '▸'}</span>
      </div>
    );
  }
  // AI 자동 설정으로 지정된 섹션만 표시 (미지정 시 전체 표시)
  const showSection = (key) =>
    !Array.isArray(settings.visibleSections) || settings.visibleSections.includes(key);

  // 전체화면 모드
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

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

  // intraActive가 바뀌면 인덱스 리셋
  useEffect(() => { setIntraIndex(0); }, [intraActive]);

  // intra 검색 후 N번째 하이라이트로 스크롤
  useEffect(() => {
    if (!intraActive || !bodyRef.current) return;
    const els = bodyRef.current.querySelectorAll('.intra-highlight');
    const el = els[intraIndex];
    if (el) {
      // 이전 포커스 제거
      els.forEach(e => e.classList.remove('intra-focused'));
      el.classList.add('intra-focused');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [intraActive, intraIndex]);

  async function handleRawOpen() {
    setRawState('loading');
    try {
      const result = await fetchRaw(a.id);
      setRawState(result ?? 'none');
    } catch {
      setRawState('none');
    }
  }

  async function handleReanalyze() {
    if (!window.confirm(`"${a.name}" 포트폴리오를 Solar AI로 재분석하시겠습니까?\n기존 파싱 결과가 덮어써집니다.`)) return;
    setReanalyzeState('loading');
    try {
      await onReanalyze?.(a.id);
      setReanalyzeState('done');
      setTimeout(() => setReanalyzeState(null), 2500);
    } catch (e) {
      setReanalyzeState('error');
      alert(`재분석 실패: ${e.message}`);
      setTimeout(() => setReanalyzeState(null), 2000);
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
    const withHighlights = applyQueryHighlights(withSimilar, searchQuery, intraActive);
    // 하이라이트 없이 순수 문자열인 경우에만 마크다운 파싱 적용
    if (typeof withHighlights === 'string') return parseMarkdownWithCodeBlock(withHighlights);
    return withHighlights;
  }

  // 자기소개: 코드블럭은 그대로 <pre>로, 나머지는 줄별 <p>로 렌더링
  const introLines = (() => {
    const raw = a.intro ?? '';
    const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
    const result = [];
    let last = 0, m, keyIdx = 0;
    while ((m = codeBlockRe.exec(raw)) !== null) {
      // 코드블럭 앞 텍스트 → 줄별 <p>
      if (m.index > last) {
        raw.slice(last, m.index).split('\n').forEach(line => {
          const parts = linkify(line);
          const content = Array.isArray(parts)
            ? parts.map((part, j) => typeof part === 'string' ? renderText(part) : part)
            : renderText(parts);
          result.push(<p key={keyIdx++} className="md-p">{content}</p>);
        });
      }
      result.push(
        <pre key={keyIdx++} className="md-code-block"><code>{m[2]}</code></pre>
      );
      last = m.index + m[0].length;
    }
    // 남은 텍스트 → 줄별 <p>
    raw.slice(last).split('\n').forEach(line => {
      const parts = linkify(line);
      const content = Array.isArray(parts)
        ? parts.map((part, j) => typeof part === 'string' ? renderText(part) : part)
        : renderText(parts);
      result.push(<p key={keyIdx++} className="md-p">{content}</p>);
    });
    return result;
  })();

  // 스크롤 위치 저장 (debounce 200 ms)
  function handleBodyScroll(e) {
    clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      onScrollChange?.(e.target.scrollTop);
    }, 200);
  }

  // panel-body에 두 개의 ref(외부 scroll sync용 + 내부 intra scroll용) 연결
  function setBodyRef(el) {
    bodyRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }

  return (
    <div className={`portfolio-panel ${fullscreen ? 'panel-fullscreen' : ''}`} style={{ '--accent': accent }}>
      {/* 절단 경고 */}
      {a._truncated && (
        <div className="panel-truncated-warn">
          ⚠ 원문이 길어 일부만 처리되었습니다. 원본 보기로 전체 내용을 확인하세요.
        </div>
      )}
      {/* 탭 */}
      <div className="panel-tab">
        <div className="panel-tab-name">
          {blind ? `지원자 #${accentIdx + 1}` : a.name}
          <span className={`match-badge ${matchClass(a.match_score)}`}>
            {a.match_score}%
          </span>
          {a._solar_used && (
            <span className="panel-ai-label" title="Solar LLM으로 파싱된 포트폴리오입니다. 원본 보기에서 전체 내용을 확인할 수 있습니다.">
              Solar
            </span>
          )}
        </div>
        <div className="panel-tab-actions">
          {/* 전체화면 버튼 */}
          <button
            className={`panel-action-btn ${fullscreen ? 'active' : ''}`}
            title={fullscreen ? '전체화면 해제' : '전체화면 보기'}
            onClick={() => setFullscreen(v => !v)}
          >
            {fullscreen ? '⊡' : '⊞'}
          </button>
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
        {intraActive && intraCount === 0 && (
          <span className="intra-search-count">없음</span>
        )}
        {intraActive && intraCount === null && (
          <span className="intra-search-count">…</span>
        )}
        {intraActive && intraCount > 0 && (
          <>
            <span className="intra-search-count">
              {intraIndex + 1}/{intraCount}
            </span>
            <button
              className="intra-nav-btn"
              title="이전 결과"
              onClick={() => setIntraIndex(i => (i - 1 + intraCount) % intraCount)}
              disabled={intraCount <= 1}
            >▲</button>
            <button
              className="intra-nav-btn"
              title="다음 결과"
              onClick={() => setIntraIndex(i => (i + 1) % intraCount)}
              disabled={intraCount <= 1}
            >▼</button>
          </>
        )}
        {intraQuery && (
          <button
            className="intra-search-clear"
            onClick={() => { setIntraQuery(''); setIntraActive(''); setIntraCount(null); }}
          >✕</button>
        )}
      </div>

      {/* 본문 */}
      <div className="panel-body" ref={setBodyRef} onScroll={handleBodyScroll}>

        {/* 상단 액션 버튼 그룹 */}
        <div className="panel-top-actions">
          {settings.originalLink && (
            <button
              className="original-btn"
              onClick={handleRawOpen}
              disabled={rawState === 'loading'}
            >
              {rawState === 'loading' ? '불러오는 중...' : '원본 보기 →'}
            </button>
          )}
          <button
            className={`reanalyze-btn ${reanalyzeState === 'done' ? 'done' : reanalyzeState === 'error' ? 'error' : ''}`}
            onClick={handleReanalyze}
            disabled={reanalyzeState === 'loading'}
          >
            {reanalyzeState === 'loading' ? '분석 중...'
              : reanalyzeState === 'done' ? '재분석 완료'
              : reanalyzeState === 'error' ? '실패'
              : 'Solar AI 재분석'}
          </button>
        </div>

        <div className="md-h1">{blind ? `지원자 #${accentIdx + 1}` : a.name} 포트폴리오</div>

        {/* 중요 링크 버튼 */}
        {showSection('links') && (() => {
          const links = [...(a.links || [])];
          // github 필드가 links에 없으면 추가
          if (a.github && !links.some(l => l.url === a.github || (a.github && l.url?.includes('github.com')))) {
            links.unshift({ label: 'GitHub', url: a.github.startsWith('http') ? a.github : `https://${a.github}` });
          }
          if (!links.length) return null;
          function linkIcon(url = '', label = '') {
            const u = url.toLowerCase();
            const l = label.toLowerCase();
            if (u.includes('github.com') || l === 'github') return '🐙';
            if (u.includes('notion.so') || l === 'notion') return '📝';
            if (u.includes('linkedin.com') || l === 'linkedin') return '💼';
            if (u.includes('velog.io') || u.includes('tistory') || u.includes('medium.com') || l === 'blog') return '✍️';
            if (u.includes('youtube.com') || u.includes('youtu.be')) return '▶️';
            if (u.includes('figma.com')) return '🎨';
            if (l === 'portfolio' || l.includes('포트폴리오')) return '🖼️';
            return '🔗';
          }
          return (
            <div className="panel-links-bar">
              {links.map((lnk, i) => (
                <a
                  key={i}
                  href={lnk.url.startsWith('http') ? lnk.url : `https://${lnk.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="panel-link-btn"
                  title={lnk.url}
                >
                  {linkIcon(lnk.url, lnk.label)} {lnk.label || '링크'}
                </a>
              ))}
            </div>
          );
        })()}

        {/* 기본 정보 */}
        {showSection('info') && (
          <>
            <SectionHeader sKey="info" label="기본 정보" />
            {!collapsed['info'] && (
              <ul className="md-ul section-body">
                <li className="md-li">
                  <span className="md-bold">경력</span>&ensp;{a.career_years}년
                </li>
                <li className="md-li">
                  <span className="md-bold">학력</span>&ensp;{a.education}
                </li>
                {a.email && (
                  <li className="md-li">
                    <span className="md-bold">이메일</span>&ensp;
                    <a href={`mailto:${a.email}`} className="portfolio-link">{a.email}</a>
                  </li>
                )}
                {a.github && (
                  <li className="md-li">
                    <span className="md-bold">GitHub</span>&ensp;
                    <a href={a.github.startsWith('http') ? a.github : `https://${a.github}`} target="_blank" rel="noopener noreferrer" className="portfolio-link">{a.github}</a>
                  </li>
                )}
                {a._added_at && (
                  <li className="md-li">
                    <span className="md-bold">추가됨</span>&ensp;
                    <span className="added-at-text">{a._added_at}</span>
                  </li>
                )}
              </ul>
            )}
          </>
        )}

        {/* 기술 스택 */}
        {showSection('skills') && (
          <>
            <SectionHeader sKey="skills" label="기술 스택" />
            {!collapsed['skills'] && (
              <div className="skill-badges section-body">
                {(showAllSkills ? (a.skills || []) : (a.skills || []).slice(0, SKILL_LIMIT)).map(s => (
                  <span
                    key={s}
                    className={`skill-badge ${settings.highlight && skillsMatch[s] ? 'matched' : ''}`}
                  >
                    {s}
                  </span>
                ))}
                {(a.skills || []).length > SKILL_LIMIT && (
                  <button className="skill-toggle-btn" onClick={() => setShowAllSkills(v => !v)}>
                    {showAllSkills ? '접기' : `+${(a.skills || []).length - SKILL_LIMIT}개 더보기`}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* 자기소개 */}
        {showSection('intro') && (
          <>
            <SectionHeader sKey="intro" label="자기소개" />
            {!collapsed['intro'] && (
              <div className="section-body">
                {introLines}
              </div>
            )}
          </>
        )}

        {/* 프로젝트 */}
        {showSection('projects') && (
          <>
            <SectionHeader sKey="projects" label="프로젝트" />
            {!collapsed['projects'] && (
              <div className="section-body">
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
              </div>
            )}
          </>
        )}

        {/* 수상 및 활동 */}
        {showSection('awards') && a.awards?.length > 0 && (
          <>
            <SectionHeader sKey="awards" label="수상 및 활동" />
            {!collapsed['awards'] && (
              <ul className="md-ul section-body">
                {a.awards.map((aw, i) => (
                  <li key={i} className="md-li">{aw}</li>
                ))}
              </ul>
            )}
          </>
        )}

      </div>

        {/* 메모 */}
        <div className="panel-note-section">
          <div className="panel-note-label">📝 메모</div>
          <textarea
            className="panel-note-textarea"
            placeholder="이 지원자에 대한 메모를 입력하세요..."
            value={noteValue}
            onChange={handleNoteChange}
            rows={3}
          />
        </div>

      {/* 검색 필터 경고 */}
      {isFiltered && (
        <div className="panel-filter-warn">
          현재 검색 결과에 없는 지원자입니다
        </div>
      )}

      {/* 원본 뷰어 모달 */}
      {rawState && rawState !== 'loading' && (
        <div className="raw-overlay" onClick={() => setRawState(null)}>
          <div className="raw-modal" onClick={e => e.stopPropagation()}>
            <div className="raw-modal-header">
              <span className="raw-modal-title">원본 포트폴리오 — {a.name}</span>
              {rawState !== 'none' && (
                <div className="raw-view-toggle">
                  <button
                    className={`raw-toggle-btn ${rawViewMode === 'raw' ? 'active' : ''}`}
                    onClick={() => setRawViewMode('raw')}
                  >원본</button>
                  <button
                    className={`raw-toggle-btn ${rawViewMode === 'md' ? 'active' : ''}`}
                    onClick={() => setRawViewMode('md')}
                  >마크다운</button>
                </div>
              )}
              <button className="drawer-close" onClick={() => setRawState(null)}>✕</button>
            </div>
            <div className="raw-modal-body">
              {rawState === 'none'
                ? <p className="raw-empty">원본 파일이 없습니다.</p>
                : rawViewMode === 'md'
                  ? <div className="raw-md-body">{renderMarkdown(rawState.raw)}</div>
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

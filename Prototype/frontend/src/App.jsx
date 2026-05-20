import { useState, useEffect, useCallback, useRef } from 'react';
import { analyzePortfolios, searchPortfolios, fetchSimilarMap, deletePortfolio, reanalyzePortfolio } from './api';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import PortfolioArea from './components/PortfolioArea';
import SettingsDrawer from './components/SettingsDrawer';
import UploadModal from './components/UploadModal';
import Toaster, { useToast } from './components/Toaster';
import SkillMatrix from './components/SkillMatrix';
import DiffModal from './components/DiffModal';

const DEFAULT_SPECS = 'React, Python, Docker';
const CACHE_KEY = 'portfolio-reviewer-cache';

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || []; }
  catch { return []; }
}

export default function App() {
  const { toasts, toast } = useToast();
  const [applicants, setApplicants]     = useState(loadCache);
  const [visibleIds, setVisibleIds]     = useState(null); // null = 전체
  const [selectedIds, setSelectedIds]   = useState([]);
  const [similarMap, setSimilarMap]     = useState({});
  const [similarScope, setSimilarScope] = useState('open'); // 항상 open 모드
  const [groupColors, setGroupColors]   = useState([
    '#DC2626','#EA580C','#0284C7','#65A30D','#7C3AED','#0D9488',
  ]);
  const [sortKey, setSortKey]           = useState('match');
  const [requiredSpecs, setRequiredSpecs] = useState(DEFAULT_SPECS);
  const [searchQuery, setSearchQuery]   = useState('');
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [analyzeBanner, setAnalyzeBanner] = useState(null); // null | { total, high }
  const [scrollPos, setScrollPos]       = useState({}); // { [portfolioId]: scrollTop }
  const [showMatrix, setShowMatrix]     = useState(false);
  const [showDiff, setShowDiff]         = useState(false);
  const [diffIds, setDiffIds]           = useState([null, null]);

  const [analyzing, setAnalyzing]       = useState(false);
  const [weights, setWeights]           = useState({ skill: 60, career: 25, project: 15 });

  const [settings, setSettings]         = useState({
    highlight:   true,
    similar:     true,
    hideSimlar:  false,
    syncScroll:  false,
    originalLink: true,
    aliasSearch: true,
    blind:       false,
    dark:        false,
  });

  // ── 다크 모드 body 클래스 연동 ──────────────────
  useEffect(() => {
    document.body.classList.toggle('dark', settings.dark);
  }, [settings.dark]);

  // ── 키보드 단축키 ────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (uploadOpen) { setUploadOpen(false); return; }
      if (drawerOpen) { setDrawerOpen(false); return; }
      // functional update로 stale closure 회피
      setSelectedIds(prev => prev.length ? prev.slice(0, -1) : prev);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [uploadOpen, drawerOpen]);

  // ── localStorage 캐시 동기화 ─────────────────────
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(applicants)); } catch {}
  }, [applicants]);

  // ── 유사 문장 실행 (항상 open 모드 — 2개 미만이면 빈 맵) ──────
  const runSimilar = useCallback(async (scope, ids, colors) => {
    // 같은 사람(단독) 비교는 의미 없음 — 2개 이상 패널이 열려야 실행
    if (ids.length < 2) {
      setSimilarMap({});
      return;
    }
    try {
      const map = await fetchSimilarMap(ids, colors);
      setSimilarMap(map);
    } catch (e) { console.error('similar 오류:', e); }
  }, []);

  // ── 초기 로딩 ──────────────────────────────────
  useEffect(() => {
    runAnalyze(DEFAULT_SPECS, 'match');
    // 유사도는 패널이 2개 이상 열릴 때 자동 실행됨
  }, []);

  // ── 분석 실행 ──────────────────────────────────
  const runAnalyze = useCallback(async (specs = requiredSpecs, key = sortKey, w = weights) => {
    const list = specs.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.length) return;
    setAnalyzing(true);
    try {
      const data = await analyzePortfolios(list, key, w);
      setApplicants(data);
      setVisibleIds(null);
      const highCount = data.filter(a => a.match_score >= 70).length;
      setAnalyzeBanner({ total: data.length, high: highCount });
    } catch (e) {
      console.error('analyze 오류:', e);
    } finally {
      setAnalyzing(false);
    }
  }, [requiredSpecs, sortKey, weights]);

  // 열린 패널 변경 시 유사 문장 재계산 (2개 미만이면 runSimilar 내부에서 초기화)
  useEffect(() => {
    if (settings.similar) {
      runSimilar('open', selectedIds, groupColors);
    }
  }, [selectedIds]);

  // ── 정렬 변경 ───────────────────────────────────
  const handleSortChange = useCallback((key) => {
    setSortKey(key);
    runAnalyze(requiredSpecs, key);
  }, [requiredSpecs, runAnalyze]);

  // ── 검색 (debounce) ────────────────────────────
  const searchTimer = useRef(null);
  const handleSearch = useCallback((q) => {
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchQuery(''); setVisibleIds(null); return; }
    setSearchQuery(q.trim());
    searchTimer.current = setTimeout(async () => {
      try {
        const ids = await searchPortfolios(q, 'cross');
        setVisibleIds(new Set(ids));
      } catch (e) {
        console.error('search 오류:', e);
      }
    }, 300);
  }, []);

  // ── 패널 토글 ───────────────────────────────────
  const toggleSelected = useCallback((id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  // ── 이름 변경 ────────────────────────────────────
  const handleRename = useCallback((id, name) => {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, name } : a));
  }, []);

  // ── 삭제 ─────────────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('이 포트폴리오를 삭제하시겠습니까?')) return;
    const target = applicants.find(a => a.id === id);
    const name = target?.name || id;
    try {
      await deletePortfolio(id);
      setApplicants(prev => prev.filter(a => a.id !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
      runSimilar(similarScope, selectedIds.filter(x => x !== id), groupColors);

      // Undo: 클라이언트 상태 복구 (백엔드 복구는 미지원 — 5초 내 취소 시 재추가)
      toast(`"${name}" 삭제 완료`, 'success', 5000, () => {
        setApplicants(prev => {
          // 이미 있으면 추가하지 않음
          if (prev.some(a => a.id === id)) return prev;
          return target ? [...prev, target] : prev;
        });
        toast(`"${name}" 삭제 취소됨`, 'info');
      });
    } catch (e) {
      console.error('삭제 오류:', e);
      toast('삭제 실패', 'error');
    }
  }, [applicants, similarScope, selectedIds, groupColors, runSimilar, toast]);

  // ── Solar AI 재분석 ──────────────────────────────
  const handleReanalyze = useCallback(async (id) => {
    try {
      const result = await reanalyzePortfolio(id);
      setApplicants(prev => prev.map(a => {
        if (a.id !== id) return a;
        // 매칭 점수는 기존 값 유지 (재분석 후 analyze 없이도 표시 유지)
        return { ...result.portfolio, match_score: a.match_score, skills_match: a.skills_match };
      }));
      toast(`"${result.portfolio.name}" Solar AI 재분석 완료`, 'success');
    } catch (e) {
      toast('재분석 실패: ' + e.message, 'error');
      throw e;
    }
  }, [toast]);

  // ── 스크롤 위치 저장 ────────────────────────────
  const handleScrollSave = useCallback((id, top) => {
    setScrollPos(prev => ({ ...prev, [id]: top }));
  }, []);

  // ── 설정 토글 ───────────────────────────────────
  const toggleSetting = useCallback((key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const visibleApplicants = visibleIds
    ? applicants.filter(a => visibleIds.has(a.id))
    : applicants;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar
        onSearch={handleSearch}
        requiredSpecs={requiredSpecs}
        onSpecsChange={setRequiredSpecs}
        onAnalyze={() => runAnalyze()}
        sortKey={sortKey}
        onSortChange={handleSortChange}
        onSettingsClick={() => setDrawerOpen(true)}
        onUploadClick={() => setUploadOpen(true)}
        onImported={(msg) => { runAnalyze(); toast(msg || '불러오기 완료', 'success'); }}
        onMatrixClick={() => setShowMatrix(true)}
      />
      {analyzeBanner && (
        <div className="analyze-summary-banner">
          <span>📊 분석 완료 — 총 {analyzeBanner.total}명 중 {analyzeBanner.high}명이 70% 이상 매칭</span>
          <button className="banner-close" onClick={() => setAnalyzeBanner(null)}>✕</button>
        </div>
      )}
      <div className="main-layout">
        <Sidebar
          applicants={visibleApplicants}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          onDelete={handleDelete}
          onRename={handleRename}
          onUploadClick={() => setUploadOpen(true)}
          blind={settings.blind}
          analyzing={analyzing}
        />
        <PortfolioArea
          applicants={applicants}
          selectedIds={selectedIds}
          onClose={toggleSelected}
          similarMap={similarMap}
          settings={settings}
          searchQuery={searchQuery}
          visibleIds={visibleIds}
          onSyncToggle={() => toggleSetting('syncScroll')}
          onReanalyze={handleReanalyze}
          onUploadClick={() => setUploadOpen(true)}
          scrollPos={scrollPos}
          onScrollSave={handleScrollSave}
          onDiffClick={(idA, idB) => { setDiffIds([idA, idB]); setShowDiff(true); }}
        />
      </div>
      {drawerOpen && (
        <SettingsDrawer
          settings={settings}
          onToggle={toggleSetting}
          similarScope={similarScope}
          onScopeChange={(s) => {
            setSimilarScope(s);
            runSimilar(s, selectedIds, groupColors);
          }}
          groupColors={groupColors}
          onColorChange={(idx, color) => {
            const next = [...groupColors];
            next[idx] = color;
            setGroupColors(next);
            runSimilar(similarScope, selectedIds, next);
          }}
          onRefreshSimilar={() => runSimilar(similarScope, selectedIds, groupColors)}
          weights={weights}
          onWeightsChange={(w) => { setWeights(w); runAnalyze(requiredSpecs, sortKey, w); }}
          onClose={() => setDrawerOpen(false)}
        />
      )}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onAdded={({ portfolio }) => {
            setApplicants(prev => [...prev, { ...portfolio, match_score: 0, skills_match: {} }]);
            setUploadOpen(false);
            runAnalyze();
            runSimilar(similarScope, selectedIds, groupColors);
            toast(`"${portfolio.name}" 추가 완료`, 'success');
          }}
        />
      )}
      {showMatrix && (
        <SkillMatrix
          applicants={applicants}
          onClose={() => setShowMatrix(false)}
        />
      )}
      {showDiff && diffIds[0] && diffIds[1] && (
        <DiffModal
          applicantA={applicants.find(a => a.id === diffIds[0])}
          applicantB={applicants.find(a => a.id === diffIds[1])}
          onClose={() => setShowDiff(false)}
        />
      )}
      <Toaster toasts={toasts} />
    </div>
  );
}

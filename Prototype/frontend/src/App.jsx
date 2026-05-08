import { useState, useEffect, useCallback, useRef } from 'react';
import { analyzePortfolios, searchPortfolios, fetchSimilarMap, deletePortfolio } from './api';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import PortfolioArea from './components/PortfolioArea';
import SettingsDrawer from './components/SettingsDrawer';
import UploadModal from './components/UploadModal';

const DEFAULT_SPECS = 'React, Python, Docker';

export default function App() {
  const [applicants, setApplicants]     = useState([]);
  const [visibleIds, setVisibleIds]     = useState(null); // null = 전체
  const [selectedIds, setSelectedIds]   = useState([]);
  const [similarMap, setSimilarMap]     = useState({});
  const [sortKey, setSortKey]           = useState('match');
  const [requiredSpecs, setRequiredSpecs] = useState(DEFAULT_SPECS);
  const [searchQuery, setSearchQuery]   = useState('');
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [settings, setSettings]         = useState({
    highlight:   true,
    similar:     true,
    hideSimlar:  false,
    syncScroll:  false,
    originalLink: true,
    aliasSearch: true,
  });

  // ── 초기 로딩 ──────────────────────────────────
  useEffect(() => {
    fetchSimilarMap().then(setSimilarMap).catch(console.error);
    runAnalyze(DEFAULT_SPECS, 'match');
  }, []);

  // ── 분석 실행 ──────────────────────────────────
  const runAnalyze = useCallback(async (specs = requiredSpecs, key = sortKey) => {
    const list = specs.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.length) return;
    try {
      const data = await analyzePortfolios(list, key);
      setApplicants(data);
      setVisibleIds(null);
    } catch (e) {
      console.error('analyze 오류:', e);
    }
  }, [requiredSpecs, sortKey]);

  // ── 정렬 변경 ───────────────────────────────────
  const handleSortChange = useCallback((key) => {
    setSortKey(key);
    runAnalyze(requiredSpecs, key);
  }, [requiredSpecs, runAnalyze]);

  // ── 검색 (debounce) ────────────────────────────
  const searchTimer = useRef(null);
  const handleSearch = useCallback((q) => {
    clearTimeout(searchTimer.current);
    setSearchQuery(q.trim());
    if (!q.trim()) { setSearchQuery(''); setVisibleIds(null); return; }
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

  // ── 삭제 ─────────────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('이 포트폴리오를 삭제하시겠습니까?')) return;
    try {
      await deletePortfolio(id);
      setApplicants(prev => prev.filter(a => a.id !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
    } catch (e) {
      console.error('삭제 오류:', e);
    }
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
        onImported={() => runAnalyze()}
      />
      <div className="main-layout">
        <Sidebar
          applicants={visibleApplicants}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          onDelete={handleDelete}
        />
        <PortfolioArea
          applicants={applicants}
          selectedIds={selectedIds}
          onClose={toggleSelected}
          similarMap={similarMap}
          settings={settings}
          searchQuery={searchQuery}
          onSyncToggle={() => toggleSetting('syncScroll')}
        />
      </div>
      {drawerOpen && (
        <SettingsDrawer
          settings={settings}
          onToggle={toggleSetting}
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
          }}
        />
      )}
    </div>
  );
}

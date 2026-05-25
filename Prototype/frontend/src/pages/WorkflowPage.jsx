import { useState, useEffect, useCallback, useRef } from 'react';
import { SIMILAR_PALETTES } from '../components/SettingsDrawer';
import { analyzePortfolios, searchPortfolios, fetchSimilarMap, deletePortfolio, reanalyzePortfolio, exportPortfolios, summarizePortfolio, summarizeAllPortfolios } from '../api';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';
import PortfolioArea from '../components/PortfolioArea';
import SettingsDrawer from '../components/SettingsDrawer';
import UploadModal from '../components/UploadModal';
import FolderUploadModal from '../components/FolderUploadModal';
import Toaster, { useToast } from '../components/Toaster';
import DiffModal from '../components/DiffModal';
import JobConfigModal from '../components/JobConfigModal';
import { DEFAULT_SPECS, DEFAULT_WEIGHTS, STORAGE_KEYS, BLIND_ADJECTIVES, BLIND_NOUNS } from '../constants';

function loadCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE)) || []; }
  catch { return []; }
}

export default function WorkflowPage({ onGoHome }) {
  const { toasts, toast } = useToast();
  const [applicants, setApplicants]     = useState(loadCache);
  const [visibleIds, setVisibleIds]     = useState(null);
  const [selectedIds, setSelectedIds]   = useState([]);
  const [similarMap, setSimilarMap]     = useState({});
  const [similarScope, setSimilarScope] = useState('open');
  const [selectedPalette, setSelectedPalette] = useState('dim');
  const [groupColors, setGroupColors]   = useState([
    '#9CA3AF','#9CA3AF','#9CA3AF','#9CA3AF','#9CA3AF','#9CA3AF',
  ]);
  const [sortKey, setSortKey]           = useState('match');
  const [requiredSpecs, setRequiredSpecs] = useState(DEFAULT_SPECS);
  const [searchQuery, setSearchQuery]   = useState('');
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [folderOpen, setFolderOpen]     = useState(false);
  const [analyzeBanner, setAnalyzeBanner] = useState(null);
  const bannerTimer = useRef(null);
  const [scrollPos, setScrollPos]       = useState({});
  const [showDiff, setShowDiff]         = useState(false);
  const [diffIds, setDiffIds]           = useState([]);

  const [analyzing, setAnalyzing]       = useState(false);
  // 기본 가중치 — 백엔드 portfolios.py의 DEFAULT_W_* 상수와 동일하게 유지
  const [weights, setWeights]           = useState(DEFAULT_WEIGHTS);

  const ALL_SECTIONS = ['info', 'skills', 'intro', 'timeline', 'projects', 'awards', 'links'];
  // 기본 7개 섹션은 항상 표시 — 토글 UI 제거됨. visibleSections는 export/import 호환용으로만 유지.
  const [visibleSections] = useState(ALL_SECTIONS);
  const [customSections, setCustomSections] = useState([]);
  const [extractedFilter, setExtractedFilter] = useState(null);
  const [blindAliases, setBlindAliases] = useState({});
  const [blindOrderedIds, setBlindOrderedIds] = useState([]);
  const [hasLegacy, setHasLegacy] = useState(false);
  const specsTimer = useRef(null);
  const [summarizeAllConfirm, setSummarizeAllConfirm] = useState(false);
  const [summarizeProgress, setSummarizeProgress] = useState(null);
  // null | { total, completed, current, currentName, errors: [{id,name,msg}], status: 'running'|'done'|'cancelled' }
  const [selectedSummarizeIds, setSelectedSummarizeIds] = useState(() => new Set());
  const cancelSummarizeRef = useRef(false);
  const [jobConfigOpen, setJobConfigOpen] = useState(false);

  const [settings, setSettings]         = useState({
    highlight:   true,
    similar:     true,
    hideSimlar:  true,
    syncScroll:  false,
    originalLink: true,
    aliasSearch: true,
    blind:       false,
    dark:        false,
  });

  useEffect(() => {
    document.body.classList.toggle('dark', settings.dark);
  }, [settings.dark]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (uploadOpen) { setUploadOpen(false); return; }
      if (drawerOpen) { setDrawerOpen(false); return; }
      setSelectedIds(prev => prev.length ? prev.slice(0, -1) : prev);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [uploadOpen, drawerOpen]);

  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    try { localStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(applicants)); } catch {}
  }, [applicants]);

  const runSimilar = useCallback(async (scope, ids, colors) => {
    if (ids.length < 2) {
      setSimilarMap({});
      return;
    }
    try {
      const map = await fetchSimilarMap(ids, colors);
      setSimilarMap(map);
    } catch (e) { console.error('similar 오류:', e); }
  }, []);

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
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setAnalyzeBanner(null), 5000);
    } catch (e) {
      console.error('analyze 오류:', e);
    } finally {
      setAnalyzing(false);
    }
  }, [requiredSpecs, sortKey, weights]);

  useEffect(() => {
    runAnalyze(DEFAULT_SPECS, 'match');
  }, []);

  // requiredSpecs 변경 시 debounce 자동 분석 + 기존 요약 있으면 팝업
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    clearTimeout(specsTimer.current);
    if (!requiredSpecs.trim()) return;
    setHasLegacy(true);
    specsTimer.current = setTimeout(() => {
      runAnalyze(requiredSpecs, sortKey, weights);
      // 기존 요약이 있는 포트폴리오가 있으면 재요약 팝업 (자동 전체 선택)
      const summaryIds = applicants.filter(a => a._summary).map(a => a.id);
      if (summaryIds.length) {
        setSelectedSummarizeIds(new Set(summaryIds));
        setSummarizeAllConfirm(true);
      }
    }, 800);
    return () => clearTimeout(specsTimer.current);
  }, [requiredSpecs]);

  useEffect(() => {
    if (settings.similar) {
      runSimilar('open', selectedIds, groupColors);
    }
  }, [selectedIds]);

  const handleSortChange = useCallback((key) => {
    setSortKey(key);
    runAnalyze(requiredSpecs, key);
  }, [requiredSpecs, runAnalyze]);

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

  const toggleSelected = useCallback((id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  const handleRename = useCallback((id, name) => {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, name } : a));
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('이 포트폴리오를 삭제하시겠습니까?')) return;
    const target = applicants.find(a => a.id === id);
    const name = target?.name || id;
    try {
      await deletePortfolio(id);
      setApplicants(prev => prev.filter(a => a.id !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
      runSimilar(similarScope, selectedIds.filter(x => x !== id), groupColors);
      toast(`"${name}" 삭제 완료`, 'success', 5000, () => {
        setApplicants(prev => {
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

  const handleReanalyze = useCallback(async (id) => {
    try {
      const result = await reanalyzePortfolio(id);
      setApplicants(prev => prev.map(a => {
        if (a.id !== id) return a;
        return { ...result.portfolio, match_score: a.match_score, skills_match: a.skills_match };
      }));
      toast(`"${result.portfolio.name}" Solar AI 재분석 완료`, 'success');
    } catch (e) {
      toast('재분석 실패: ' + e.message, 'error');
      throw e;
    }
  }, [toast]);

  const handleSummarize = useCallback(async (id) => {
    const list = requiredSpecs.split(',').map(s => s.trim()).filter(Boolean);
    const result = await summarizePortfolio(id, { requiredSpecs: list, weights });
    setApplicants(prev => prev.map(a =>
      a.id === id
        ? { ...a, _summary: result.summary, _summary_config_version: result.config_version }
        : a
    ));
    return result;
  }, [requiredSpecs, weights]);

  const runSummarizeQueue = useCallback(async (ids) => {
    if (!ids?.length) return;
    cancelSummarizeRef.current = false;
    const queue = ids.map(id => {
      const a = applicants.find(x => x.id === id);
      return { id, name: a?.name || id };
    });
    const errors = [];  // 로컬 누적 — 클로저 staleness 회피
    setSummarizeProgress({
      total: queue.length, completed: 0, current: null, currentName: '',
      errors: [], status: 'running',
    });

    for (let i = 0; i < queue.length; i++) {
      if (cancelSummarizeRef.current) {
        setSummarizeProgress(p => p ? { ...p, status: 'cancelled', current: null, completed: i, errors: [...errors] } : null);
        toast(`요약 중단 — ${i}/${queue.length} 완료`, 'info');
        return;
      }
      const { id, name } = queue[i];
      setSummarizeProgress(p => p ? { ...p, current: id, currentName: name, completed: i } : null);
      try {
        await handleSummarize(id);
      } catch (e) {
        errors.push({ id, name, msg: e.message });
        setSummarizeProgress(p => p ? { ...p, errors: [...errors] } : null);
      }
    }

    setSummarizeProgress(p => p ? { ...p, completed: p.total, current: null, status: 'done', errors: [...errors] } : null);
    // 매칭 점수·정렬 갱신
    await runAnalyze(requiredSpecs, sortKey, weights);
    const failed = errors.length;
    toast(`요약 완료 — ${queue.length - failed}/${queue.length}명`, failed > 0 ? 'info' : 'success');
  }, [applicants, handleSummarize, runAnalyze, requiredSpecs, sortKey, weights, toast]);

  const cancelSummarizeQueue = useCallback(() => {
    cancelSummarizeRef.current = true;
  }, []);

  const handleSummarizeAll = useCallback(async () => {
    const ids = applicants.filter(a => a._summary).map(a => a.id);
    if (!ids.length) return;
    await runSummarizeQueue(ids);
  }, [applicants, runSummarizeQueue]);

  const openSummarizeModal = useCallback(() => {
    // 진행 중이 아닐 때만 선택 목록 초기화 (요약 보유 포트폴리오 전체 선택)
    if (!summarizeProgress || summarizeProgress.status !== 'running') {
      const ids = new Set(applicants.filter(a => a._summary).map(a => a.id));
      setSelectedSummarizeIds(ids);
    }
    setSummarizeAllConfirm(true);
  }, [applicants, summarizeProgress]);

  const closeSummarizeModal = useCallback(() => {
    setSummarizeAllConfirm(false);
    // 진행 중이 아닐 때만 진행 정보 삭제 (백그라운드 모드로 빠지지 않게 보존)
    if (summarizeProgress && summarizeProgress.status !== 'running') {
      setSummarizeProgress(null);
    }
  }, [summarizeProgress]);

  const handleScrollSave = useCallback((id, top) => {
    setScrollPos(prev => ({ ...prev, [id]: top }));
  }, []);

  const toggleSetting = useCallback((key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── 블라인드 모드 토글 (랜덤 가명 생성) ────────────
  const handleToggleBlind = useCallback(() => {
    const newBlind = !settings.blind;
    if (newBlind) {
      const aliases = {};
      applicants.forEach(a => {
        const adj = BLIND_ADJECTIVES[Math.floor(Math.random() * BLIND_ADJECTIVES.length)];
        const noun = BLIND_NOUNS[Math.floor(Math.random() * BLIND_NOUNS.length)];
        const num = Math.floor(Math.random() * 99) + 1;
        aliases[a.id] = `${adj} ${noun} #${num}`;
      });
      setBlindAliases(aliases);
      const shuffled = [...applicants].sort(() => Math.random() - 0.5).map(a => a.id);
      setBlindOrderedIds(shuffled);
    } else {
      setBlindAliases({});
      setBlindOrderedIds([]);
    }
    setSettings(prev => ({ ...prev, blind: newBlind }));
  }, [settings.blind, applicants]);

  const handlePaletteChange = useCallback((paletteId) => {
    const palette = SIMILAR_PALETTES.find(p => p.id === paletteId);
    if (!palette) return;
    setSelectedPalette(paletteId);
    setGroupColors(palette.colors);
    if (paletteId === 'dim') {
      setSettings(prev => ({ ...prev, hideSimlar: true }));
    } else {
      setSettings(prev => ({ ...prev, hideSimlar: false }));
    }
    runSimilar(similarScope, selectedIds, palette.colors);
  }, [similarScope, selectedIds, runSimilar]);

  const exportSkillMatrixCsv = useCallback(() => {
    if (!applicants.length) {
      toast('내보낼 지원자가 없습니다', 'error');
      return;
    }
    const allSkills = [...new Set(applicants.flatMap(a => a.skills || []))]
      .sort((a, b) =>
        applicants.filter(ap => (ap.skills || []).includes(b)).length
        - applicants.filter(ap => (ap.skills || []).includes(a)).length
      );
    const ok = window.confirm(
      `스킬 매트릭스를 CSV로 다운로드합니다.\n\n` +
      `· 지원자: ${applicants.length}명\n` +
      `· 스킬: ${allSkills.length}개\n` +
      `· 파일명: skill-matrix_${new Date().toISOString().slice(0, 10)}.csv\n\n` +
      `진행할까요?`
    );
    if (!ok) return;
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['지원자', '경력(년)', '스킬수', ...allSkills].map(esc).join(',');
    const rows = applicants.map(a => {
      const skillSet = new Set(a.skills || []);
      const cells = [
        a.name || '',
        a.career_years ?? 0,
        (a.skills || []).length,
        ...allSkills.map(s => skillSet.has(s) ? '1' : ''),
      ];
      return cells.map(esc).join(',');
    });
    const csv = '\uFEFF' + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skill-matrix_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`스킬 매트릭스 CSV 내보냄 — ${applicants.length}명 × ${allSkills.length}개 스킬`, 'success');
  }, [applicants, toast]);

  const applyExtractedConfig = useCallback((cfg) => {
    const specs = cfg.specs_text || requiredSpecs;
    const w = cfg.weights || weights;
    setRequiredSpecs(specs);
    setWeights(w);
    // visible_sections는 무시 — 기본 7개 항상 표시. 대신 custom_sections로 추가 섹션 정의.
    if (Array.isArray(cfg.custom_sections)) {
      setCustomSections(cfg.custom_sections.filter(s => typeof s === 'string' && s.trim()));
    }
    const filter = {
      min_career_years: cfg.min_career_years ?? null,
      education_keywords: cfg.education_keywords || [],
      position: cfg.position || null,
    };
    const filterActive = filter.min_career_years !== null
      || filter.education_keywords.length > 0
      || !!filter.position;
    setExtractedFilter(filterActive ? filter : null);
    if (specs.trim()) runAnalyze(specs, sortKey, w);
  }, [weights, sortKey, runAnalyze, requiredSpecs]);

  const visibleApplicants = (() => {
    let list = visibleIds ? applicants.filter(a => visibleIds.has(a.id)) : applicants;
    if (extractedFilter) {
      const { min_career_years, education_keywords, position } = extractedFilter;
      list = list.filter(a => {
        if (min_career_years !== null && (a.career_years ?? 0) < min_career_years) return false;
        if (education_keywords?.length) {
          const edu = (a.education || '').toLowerCase();
          if (!education_keywords.some(k => edu.includes(k.toLowerCase()))) return false;
        }
        if (position && a._position && a._position !== 'general' && a._position !== position) return false;
        return true;
      });
    }
    if (settings.blind && blindOrderedIds.length) {
      const orderMap = new Map(blindOrderedIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
    }
    return list;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar
        onSearch={handleSearch}
        requiredSpecs={requiredSpecs}
        onSpecsChange={setRequiredSpecs}
        onAnalyze={async () => {
          await runAnalyze();
          const hasSummaries = applicants.some(a => a._summary);
          if (hasSummaries) await handleSummarizeAll();
        }}
        sortKey={sortKey}
        onSortChange={handleSortChange}
        onSettingsClick={() => setDrawerOpen(true)}
        onUploadClick={() => setUploadOpen(true)}
        onFolderClick={() => setFolderOpen(true)}
        onImported={(result) => {
          runAnalyze();
          toast(result?.message || result || '불러오기 완료', 'success');
          // 임포트된 settings 복원
          if (result?.settings) {
            const s = result.settings;
            if (s.weights) setWeights(s.weights);
            if (s.visibleSections) setVisibleSections(s.visibleSections);
            if (typeof s.highlight !== 'undefined' || typeof s.dark !== 'undefined') {
              setSettings(prev => ({ ...prev, ...s }));
            }
          }
        }}
        onMatrixClick={exportSkillMatrixCsv}
        onExportClick={() => exportPortfolios({ ...settings, weights, visibleSections })}
        onGoHome={onGoHome}
        hasLegacy={hasLegacy}
        onJobConfigClick={() => setJobConfigOpen(true)}
        onApplyConfig={(cfg) => {
          applyExtractedConfig(cfg);
          const parts = [];
          if (cfg.specs?.length) parts.push(`스펙 ${cfg.specs.length}개`);
          if (cfg.visible_sections?.length && cfg.visible_sections.length < 6) parts.push(`섹션 ${cfg.visible_sections.length}개`);
          if (cfg.min_career_years !== null && cfg.min_career_years !== undefined) parts.push(`경력 ${cfg.min_career_years}년↑`);
          if (cfg.education_keywords?.length) parts.push(`학력 ${cfg.education_keywords.join('·')}`);
          if (cfg.position) parts.push(`직군 ${cfg.position}`);
          const summary = parts.length ? parts.join(' · ') : '기본값 유지';
          toast(`AI 설정 적용: ${summary}`, 'success');
        }}
      />
      {extractedFilter && (
        <div className="filter-active-banner">
          <span>AI 필터 활성</span>
          {extractedFilter.min_career_years !== null && (
            <span className="filter-chip">경력 {extractedFilter.min_career_years}년↑</span>
          )}
          {extractedFilter.education_keywords?.length > 0 && (
            <span className="filter-chip">학력 {extractedFilter.education_keywords.join('·')}</span>
          )}
          {extractedFilter.position && (
            <span className="filter-chip">직군 {extractedFilter.position}</span>
          )}
          <span className="filter-count">
            {visibleApplicants.length} / {applicants.length}명 표시
          </span>
          <button className="banner-close" onClick={() => setExtractedFilter(null)} title="필터 해제">✕</button>
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
          blindAliases={blindAliases}
          analyzing={analyzing}
        />
        <PortfolioArea
          applicants={applicants}
          selectedIds={selectedIds}
          onClose={toggleSelected}
          similarMap={similarMap}
          settings={{ ...settings, visibleSections, customSections }}
          searchQuery={searchQuery}
          visibleIds={visibleIds}
          onSyncToggle={() => toggleSetting('syncScroll')}
          onReanalyze={handleReanalyze}
          onSummarize={handleSummarize}
          onUploadClick={() => setUploadOpen(true)}
          scrollPos={scrollPos}
          onScrollSave={handleScrollSave}
          onDiffClick={(ids) => { setDiffIds(ids); setShowDiff(true); }}
          blindAliases={blindAliases}
        />
      </div>
      {drawerOpen && (
        <SettingsDrawer
          settings={settings}
          onToggle={(key) => key === 'blind' ? handleToggleBlind() : toggleSetting(key)}
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
          selectedPalette={selectedPalette}
          onPaletteChange={handlePaletteChange}
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
      {folderOpen && (
        <FolderUploadModal
          onClose={() => setFolderOpen(false)}
          onAllAdded={(results) => {
            const portfolios = results.map(r => ({
              ...r.portfolio,
              match_score: 0,
              skills_match: {},
            }));
            setApplicants(prev => [...prev, ...portfolios]);
            runAnalyze();
            runSimilar(similarScope, selectedIds, groupColors);
            toast(`${portfolios.length}개 포트폴리오 추가 완료`, 'success');
          }}
        />
      )}
      {showDiff && diffIds.length >= 2 && (
        <DiffModal
          applicants={diffIds.map(id => applicants.find(a => a.id === id)).filter(Boolean)}
          onClose={() => setShowDiff(false)}
        />
      )}
      <JobConfigModal
        open={jobConfigOpen}
        onClose={() => setJobConfigOpen(false)}
        requiredSpecs={requiredSpecs}
        weights={weights}
        customSections={customSections}
        extractedFilter={extractedFilter}
        onApply={(cfg) => {
          applyExtractedConfig(cfg);
          const parts = [];
          if (cfg.specs_text) parts.push(`스펙 ${cfg.specs_text.split(',').filter(s => s.trim()).length}개`);
          if (cfg.custom_sections?.length) parts.push(`추가 섹션 ${cfg.custom_sections.length}개`);
          if (cfg.min_career_years !== null && cfg.min_career_years !== undefined) parts.push(`경력 ${cfg.min_career_years}년↑`);
          if (cfg.education_keywords?.length) parts.push(`학력 ${cfg.education_keywords.join('·')}`);
          if (cfg.position) parts.push(`직군 ${cfg.position}`);
          toast(`채용 설정 적용: ${parts.length ? parts.join(' · ') : '기본값'}`, 'success');
        }}
      />
      {/* 채용 설정 변경 시 재요약 다이얼로그 (3-state: 선택 / 진행중 / 완료) */}
      {summarizeAllConfirm && (
        <div className="import-dialog-overlay" onClick={closeSummarizeModal}>
          <div className="import-dialog summarize-dialog" onClick={e => e.stopPropagation()}>
            {!summarizeProgress ? (
              /* ── 상태 1: 대상 선택 ───────────────────────── */
              (() => {
                const targets = applicants.filter(a => a._summary);
                const allSelected = targets.length > 0 && targets.every(a => selectedSummarizeIds.has(a.id));
                return (
                  <>
                    <div className="import-dialog-title">채용 설정 변경 감지 · 요약 대상 선택</div>
                    <p className="import-dialog-desc">
                      채용 설정이 변경되어 기존 AI 요약본이 현재 설정을 반영하지 않을 수 있습니다.<br />
                      재요약할 포트폴리오를 선택하세요.
                    </p>
                    {targets.length === 0 ? (
                      <p className="import-dialog-desc">요약이 생성된 포트폴리오가 없습니다.</p>
                    ) : (
                      <>
                        <div className="summarize-list-actions">
                          <button
                            className="summarize-toggle-all-btn"
                            onClick={() => {
                              setSelectedSummarizeIds(allSelected ? new Set() : new Set(targets.map(a => a.id)));
                            }}
                          >
                            {allSelected ? '전체 해제' : '전체 선택'}
                          </button>
                        </div>
                        <div className="summarize-list">
                          {targets.map(a => {
                            const isLegacy = a._summary_config_version && a._config_version
                              && a._summary_config_version !== a._config_version;
                            const checked = selectedSummarizeIds.has(a.id);
                            return (
                              <label key={a.id} className="summarize-list-item">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedSummarizeIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(a.id)) next.delete(a.id);
                                      else next.add(a.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="summarize-list-name">{a.name}</span>
                                {isLegacy && <span className="summarize-list-badge">레거시</span>}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <div className="import-dialog-options">
                      <button
                        className="import-option-btn"
                        disabled={selectedSummarizeIds.size === 0}
                        onClick={() => runSummarizeQueue([...selectedSummarizeIds])}
                      >
                        <span className="import-option-label">선택 요약 시작 ({selectedSummarizeIds.size}명)</span>
                        <span className="import-option-desc">현재 채용 설정 기준으로 재요약</span>
                      </button>
                    </div>
                    <div className="import-dialog-footer">
                      <button className="import-cancel-btn" onClick={closeSummarizeModal}>나중에</button>
                    </div>
                  </>
                );
              })()
            ) : summarizeProgress.status === 'running' ? (
              /* ── 상태 2: 진행 중 ─────────────────────────── */
              <>
                <div className="import-dialog-title">요약 진행 중</div>
                <div className="summarize-progress-info">
                  <div className="summarize-progress-text">
                    {summarizeProgress.completed} / {summarizeProgress.total}
                    {summarizeProgress.errors.length > 0 && (
                      <span className="summarize-error-count"> · 실패 {summarizeProgress.errors.length}건</span>
                    )}
                  </div>
                  <div className="summarize-progress-bar">
                    <div
                      className="summarize-progress-fill"
                      style={{ width: `${(summarizeProgress.completed / summarizeProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="summarize-current">
                    {summarizeProgress.currentName
                      ? <>현재 처리 중: <strong>{summarizeProgress.currentName}</strong></>
                      : '대기 중...'}
                  </div>
                </div>
                <div className="import-dialog-footer summarize-progress-footer">
                  <button className="import-cancel-btn" onClick={cancelSummarizeQueue}>중단</button>
                  <button className="import-cancel-btn" onClick={closeSummarizeModal}>백그라운드로 실행</button>
                </div>
              </>
            ) : (
              /* ── 상태 3: 완료 / 중단됨 ───────────────────── */
              <>
                <div className="import-dialog-title">
                  {summarizeProgress.status === 'cancelled' ? '요약 중단됨' : '요약 완료'}
                </div>
                <p className="import-dialog-desc">
                  {summarizeProgress.completed - summarizeProgress.errors.length} / {summarizeProgress.total}명 성공
                  {summarizeProgress.errors.length > 0 && ` · ${summarizeProgress.errors.length}명 실패`}
                </p>
                {summarizeProgress.errors.length > 0 && (
                  <ul className="summarize-error-list">
                    {summarizeProgress.errors.map((err, i) => (
                      <li key={i}><strong>{err.name}</strong>: {err.msg}</li>
                    ))}
                  </ul>
                )}
                <div className="import-dialog-footer">
                  <button className="import-cancel-btn" onClick={closeSummarizeModal}>확인</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 백그라운드 진행 인디케이터 (모달 닫힘 + 진행 중일 때만 표시) */}
      {summarizeProgress?.status === 'running' && !summarizeAllConfirm && (
        <div
          className="summarize-bg-indicator"
          onClick={openSummarizeModal}
          title="클릭하여 진행 상황 보기"
        >
          <div className="summarize-bg-spinner" />
          <div className="summarize-bg-text">
            <span className="summarize-bg-title">요약 진행 중 · {summarizeProgress.completed}/{summarizeProgress.total}</span>
            {summarizeProgress.currentName && (
              <span className="summarize-bg-sub">{summarizeProgress.currentName}</span>
            )}
          </div>
        </div>
      )}
      <Toaster toasts={toasts} />
      {analyzeBanner && (
        <div className="analyze-summary-banner">
          <span>분석 완료 — 총 {analyzeBanner.total}명 중 {analyzeBanner.high}명이 70% 이상 매칭</span>
          <button className="banner-close" onClick={() => { clearTimeout(bannerTimer.current); setAnalyzeBanner(null); }}>✕</button>
        </div>
      )}
    </div>
  );
}

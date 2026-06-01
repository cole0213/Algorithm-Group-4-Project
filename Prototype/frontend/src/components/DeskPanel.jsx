import { useState, useRef, useEffect, Fragment } from 'react';
import { renamePortfolio, importPortfolios } from '../api';
import { STORAGE_KEYS } from '../constants';
import { matchClass } from '../utils';
import {
  IcSettings, IcColumns2, IcUpload, IcTrash2,
  IcBookmark, IcBookmarkCheck,
  IcCircle, IcCircleCheck, IcCirclePause, IcCircleX,
  IcSearch, IcX,
} from '../icons';

function loadMarks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.MARKS)) || {}; }
  catch { return {}; }
}
function loadBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) || []); }
  catch { return new Set(); }
}

export default function DeskPanel({
  onGoHome,
  requiredSpecs, onSpecsChange, onAnalyze, hasLegacy, onJobConfigClick,
  sortKey, onSortChange,
  onUploadClick, onFolderClick, onImported, onMatrixClick, onExportClick,
  onSettingsClick,
  applicants, selectedIds, onToggle, onDelete, onRename,
  blind, blindAliases, analyzing,
  onSearch,
  stageSearch = '', onStageSearchChange, onDiffClick,
}) {
  // — Sidebar state —
  const [editingId, setEditingId]   = useState(null);
  const [editValue, setEditValue]   = useState('');
  const inputRef                    = useRef(null);
  const [marks, setMarks]           = useState(loadMarks);
  const [openMarkId, setOpenMarkId] = useState(null);
  const [bookmarks, setBookmarks]   = useState(loadBookmarks);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minCareer, setMinCareer]   = useState(0);
  const [filterSkill, setFilterSkill] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');

  // — TopBar state —
  const searchTimer = useRef(null);
  const importRef   = useRef(null);
  const addMenuRef  = useRef(null);
  const [addMenuOpen, setAddMenuOpen]         = useState(false);
  const [historyOpen, setHistoryOpen]         = useState(false);
  const [importDialogFile, setImportDialogFile] = useState(null);
  const [searchHistory, setSearchHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('search-history')) || []; }
    catch { return []; }
  });

  // — DeskPanel state —
  const [activeTab, setActiveTab] = useState('all');
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    if (!addMenuOpen) return;
    function h(e) { if (!addMenuRef.current?.contains(e.target)) setAddMenuOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [addMenuOpen]);

  // — Sidebar logic —
  function toggleBookmark(e, id) {
    e.stopPropagation();
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify([...next])); } catch {}
      return next;
    });
  }
  function applyMark(e, id, value) {
    e.stopPropagation();
    setOpenMarkId(null);
    setMarks(prev => {
      const updated = { ...prev };
      if (value === null) delete updated[id];
      else updated[id] = value;
      try { localStorage.setItem(STORAGE_KEYS.MARKS, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }
  function toggleMarkDropdown(e, id) {
    e.stopPropagation();
    setOpenMarkId(prev => (prev === id ? null : id));
  }
  function startEdit(e, a) {
    e.stopPropagation();
    setEditingId(a.id);
    setEditValue(a.name);
    setTimeout(() => inputRef.current?.select(), 30);
  }
  async function commitEdit(id) {
    const trimmed = editValue.trim();
    if (trimmed) {
      try { await renamePortfolio(id, trimmed); onRename?.(id, trimmed); }
      catch (e) { alert(e.message); }
    }
    setEditingId(null);
  }
  function handleNameKeyDown(e, id) {
    if (e.key === 'Enter') commitEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  }

  // — TopBar logic —
  function saveHistory(q) {
    if (!q || q.trim().length < 2) return;
    setSearchHistory(prev => {
      const next = [q.trim(), ...prev.filter(h => h !== q.trim())].slice(0, 8);
      try { localStorage.setItem('search-history', JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function handleSearchInput(e) {
    const val = e.target.value;
    setNameFilter(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { onSearch(val); saveHistory(val); }, 300);
  }
  function handleImportFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setImportDialogFile(f);
    e.target.value = '';
  }
  async function executeImport(mode) {
    if (!importDialogFile) return;
    const file = importDialogFile;
    setImportDialogFile(null);
    try { const r = await importPortfolios(file, mode); onImported?.(r); }
    catch (err) { alert(err.message); }
  }

  // — Filtered list —
  // 주의: nameFilter는 백엔드 search(/api/search)로 visibleIds → applicants(prop)에 이미 반영됨.
  // 여기서 다시 client-side substring 필터를 적용하면 ED/별칭 흡수가 무효화되므로 사용하지 않음.
  const filteredList = (() => {
    let list = [
      ...applicants.filter(a => bookmarks.has(a.id)),
      ...applicants.filter(a => !bookmarks.has(a.id)),
    ];
    if (activeTab !== 'all') list = list.filter(a => marks[a.id] === activeTab);
    if (minCareer > 0) list = list.filter(a => (a.career_years ?? 0) >= minCareer);
    if (filterSkill.trim()) {
      const q = filterSkill.trim().toLowerCase();
      list = list.filter(a => (a.skills || []).some(s => s.toLowerCase().includes(q)));
    }
    if (filterDateFrom || filterDateTo) {
      list = list.filter(a => {
        const d = a._added_at?.slice(0, 10);
        if (!d) return false;
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo   && d > filterDateTo)   return false;
        return true;
      });
    }
    return list;
  })();

  const tabCounts = {
    pass: Object.values(marks).filter(v => v === 'pass').length,
    hold: Object.values(marks).filter(v => v === 'hold').length,
    fail: Object.values(marks).filter(v => v === 'fail').length,
  };

  return (
    <aside className="desk" onClick={() => setOpenMarkId(null)}>

      {/* ─ Brand ─ */}
      <div className="desk-brand">
        <div className="brand-row">
          <span className="brand-mark">Reviewer / v1.0</span>
          {onGoHome && (
            <button className="brand-home-btn" onClick={onGoHome} title="홈으로">← 홈</button>
          )}
        </div>
        <div className="brand-job">포트폴리오 뷰어</div>
        <div className="brand-job-meta">
          지원자 {applicants.length}명
          {selectedIds.length > 0 && <> · 열림 {selectedIds.length}개</>}
        </div>
      </div>

      {/* ─ Required Specs ─ */}
      <div className="desk-spec">
        <span className="desk-label">Required</span>
        <div className="desk-spec-row">
          <input
            className="desk-spec-input"
            type="text"
            value={requiredSpecs}
            onChange={e => onSpecsChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAnalyze()}
            placeholder="React, Python, Docker"
          />
          <button
            className={`desk-spec-analyze-btn${hasLegacy ? ' active' : ''}`}
            title="전체 재분석"
            onClick={onAnalyze}
          >재분석</button>
          <button
            className="desk-spec-ai-btn"
            title="채용 설정 AI 추출"
            onClick={onJobConfigClick}
          ><IcSettings size={13} /></button>
        </div>
      </div>

      {/* ─ Search ─ */}
      <div className="desk-search-wrap">
        <input
          className="desk-search-input"
          type="text"
          placeholder="이름 · 기술 · 키워드 검색"
          value={nameFilter}
          onChange={handleSearchInput}
          onFocus={() => setHistoryOpen(true)}
          onBlur={() => setTimeout(() => setHistoryOpen(false), 150)}
        />
        {historyOpen && searchHistory.length > 0 && (
          <div className="desk-search-history">
            {searchHistory.map((h, i) => (
              <div key={i} className="desk-search-history-item" onMouseDown={() => {
                setNameFilter(h); onSearch(h); saveHistory(h); setHistoryOpen(false);
              }}>
                <span>🕐</span> {h}
              </div>
            ))}
            <div className="desk-search-history-clear" onMouseDown={() => {
              setSearchHistory([]);
              try { localStorage.removeItem('search-history'); } catch {}
              setHistoryOpen(false);
            }}>히스토리 지우기</div>
          </div>
        )}
      </div>

      {/* ─ Doc Search ─ */}
      {selectedIds.length > 0 && (
        <div className="desk-doc-search-wrap">
          <IcSearch size={12} className="desk-doc-search-icon" />
          <input
            className="desk-doc-search-input"
            type="text"
            placeholder="열린 문서 내 검색..."
            value={stageSearch}
            onChange={e => onStageSearchChange?.(e.target.value)}
          />
          {stageSearch && (
            <button className="desk-doc-search-clear" onClick={() => onStageSearchChange?.('')} title="지우기">
              <IcX size={11} />
            </button>
          )}
        </div>
      )}

      {/* ─ Tabs ─ */}
      <div className="desk-tabs-bar">
        <div className="desk-tab-row">
          {[['all','전체'], ['pass','통과'], ['hold','보류'], ['fail','탈락']].map(([k, l]) => (
            <button
              key={k}
              className={`desk-tab${activeTab === k ? ' on' : ''}`}
              onClick={() => setActiveTab(k)}
            >
              {l}
              {k !== 'all' && tabCounts[k] > 0 && (
                <span className="desk-tab-cnt">{tabCounts[k]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="desk-tab-meta">
          <button
            className={`desk-filter-icon${filterOpen ? ' active' : ''}`}
            title="조건 필터"
            onClick={() => setFilterOpen(v => !v)}
          >⊟</button>
          <span className="desk-count">{filteredList.length}/{applicants.length}</span>
        </div>
      </div>

      {/* ─ Advanced Filter ─ */}
      {filterOpen && (
        <div className="desk-filter-panel sidebar-filter-panel">
          <div className="filter-row">
            <label className="filter-label">경력 최소</label>
            <input type="number" className="filter-input" min={0} max={20}
              value={minCareer} onChange={e => setMinCareer(Number(e.target.value))} placeholder="0" />
            <span className="filter-unit">년↑</span>
          </div>
          <div className="filter-row">
            <label className="filter-label">스킬</label>
            <input type="text" className="filter-input" value={filterSkill}
              onChange={e => setFilterSkill(e.target.value)} placeholder="React" />
          </div>
          <div className="filter-date-row">
            <label className="filter-label">등록일</label>
            <input type="date" className="filter-date-input" value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)} />
            <span className="filter-date-sep">~</span>
            <input type="date" className="filter-date-input" value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)} />
          </div>
          {(minCareer > 0 || filterSkill || filterDateFrom || filterDateTo) && (
            <button className="filter-reset-btn"
              onClick={() => { setMinCareer(0); setFilterSkill(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
              필터 초기화
            </button>
          )}
        </div>
      )}

      {/* ─ Candidate List ─ */}
      <div className="desk-list">
        {analyzing ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-line medium" />
                <div className="skeleton skeleton-line short" style={{ marginTop: 6 }} />
              </div>
            ))}
          </>
        ) : applicants.length === 0 ? (
          <div className="desk-empty">
            <div className="desk-empty-text">포트폴리오가 없습니다</div>
            <button className="desk-empty-btn" onClick={onUploadClick}>+ 포트폴리오 추가</button>
          </div>
        ) : (
          filteredList.map((a, idx) => {
            const mark       = marks[a.id] ?? null;
            const isBookmarked = bookmarks.has(a.id);
            const isSelected   = selectedIds.includes(a.id);
            const skillsMatch  = a.skills_match || {};
            const showDivider  = idx > 0 && !isBookmarked && bookmarks.has(filteredList[idx - 1]?.id);
            return (
              <Fragment key={a.id}>
                {showDivider && <div className="bookmark-divider" />}
                <div
                  className={`desk-row${isSelected ? ' active' : ''}${mark ? ` marked-${mark}` : ''}`}
                  onClick={() => onToggle(a.id)}
                >
                  <div className="row-num">{String(idx + 1).padStart(2, '0')}</div>
                  <div className="row-body">
                    {editingId === a.id ? (
                      <input
                        ref={inputRef}
                        className="sidebar-name-edit"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(a.id)}
                        onKeyDown={e => handleNameKeyDown(e, a.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="row-name"
                        onDoubleClick={e => !blind && startEdit(e, a)}
                        title={blind ? '' : `${a.name} · 더블클릭으로 편집`}
                      >
                        {blind ? (blindAliases?.[a.id] || `지원자 #${idx + 1}`) : a.name}
                      </div>
                    )}
                    <div className="row-meta">
                      {a.career_years ? `${a.career_years}년` : ''}
                      {a.career_years && a._added_at ? ' · ' : ''}
                      {a._added_at ? a._added_at.slice(0, 10) : ''}
                    </div>
                    <div className="row-tags">
                      {(a.skills || []).slice(0, 3).map(s => (
                        <span key={s} className={`rt${skillsMatch[s] ? ' m' : ''}`}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="row-side">
                    <span className={`row-score ${matchClass(a.match_score)}`}>
                      {a.match_score}
                    </span>
                    <div className="row-side-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className={`bookmark-btn${isBookmarked ? ' bookmarked' : ''}`}
                        title={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기'}
                        onClick={e => toggleBookmark(e, a.id)}
                      >{isBookmarked ? <IcBookmarkCheck size={13} /> : <IcBookmark size={13} />}</button>
                      <div style={{ position: 'relative' }}>
                        <button
                          className={`mark-btn${mark ? ` mark-${mark}` : ''}`}
                          title={mark ? `${mark} — 변경` : '심사 마킹'}
                          onClick={e => toggleMarkDropdown(e, a.id)}
                        >
                          {mark === 'pass' ? <IcCircleCheck size={13} /> : mark === 'hold' ? <IcCirclePause size={13} /> : mark === 'fail' ? <IcCircleX size={13} /> : <IcCircle size={13} />}
                        </button>
                        {openMarkId === a.id && (
                          <div className="mark-dropdown" onClick={e => e.stopPropagation()}>
                            {[
                              { value: 'pass', label: '통과', cls: 'mark-pass', icon: <IcCircleCheck size={12} /> },
                              { value: 'hold', label: '보류', cls: 'mark-hold', icon: <IcCirclePause size={12} /> },
                              { value: 'fail', label: '탈락', cls: 'mark-fail', icon: <IcCircleX size={12} /> },
                              { value: null,   label: '없음', cls: '',          icon: <IcCircle size={12} /> },
                            ].map(opt => (
                              <button
                                key={String(opt.value)}
                                className={`mark-dropdown-item${mark === opt.value ? ' selected' : ''} ${opt.cls}`}
                                onMouseDown={e => applyMark(e, a.id, opt.value)}
                              >{opt.icon} {opt.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="sidebar-delete-btn"
                        title="삭제"
                        onClick={e => { e.stopPropagation(); onDelete(a.id); }}
                      ><IcTrash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      {/* ─ Bottom Actions ─ */}
      <div className="desk-actions">
        <select className="da-select" value={sortKey} onChange={e => onSortChange(e.target.value)}>
          <option value="match">매칭률 높은 순</option>
          <option value="career">경력 많은 순</option>
          <option value="name">이름 순</option>
        </select>
        {selectedIds.length >= 2 && selectedIds.length <= 4 && onDiffClick && (
          <button className="da-icon" title={`${selectedIds.length}명 비교 분석`} onClick={() => onDiffClick(selectedIds)}>⇄</button>
        )}
        <button className="da-icon" title="설정" onClick={onSettingsClick}><IcSettings size={14} /></button>
        <button className="da-icon" title="스킬 매트릭스 CSV" onClick={onMatrixClick}><IcColumns2 size={14} /></button>
        <button className="da-icon" title="내보내기 (JSON)" onClick={onExportClick}>↓</button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        <button className="da-icon" title="불러오기 (JSON)" onClick={() => importRef.current?.click()}>↑</button>
        <div className="add-menu-wrap" ref={addMenuRef}>
          <button className="da-primary" onClick={() => setAddMenuOpen(v => !v)}>＋ 추가 ▾</button>
          {addMenuOpen && (
            <div className="add-menu-dropdown add-menu-up">
              <button className="add-menu-item" onClick={() => { setAddMenuOpen(false); onUploadClick(); }}>
                <span className="add-menu-icon">📄</span>
                <span className="add-menu-text">
                  <span className="add-menu-label">단일 파일 추가</span>
                  <span className="add-menu-sub">PDF · MD · TXT</span>
                </span>
              </button>
              <button className="add-menu-item" onClick={() => { setAddMenuOpen(false); onFolderClick?.(); }}>
                <span className="add-menu-icon">📁</span>
                <span className="add-menu-text">
                  <span className="add-menu-label">폴더 전체 추가</span>
                  <span className="add-menu-sub">폴더 내 모든 파일</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─ Import dialog ─ */}
      {importDialogFile && (
        <div className="import-dialog-overlay" onClick={() => setImportDialogFile(null)}>
          <div className="import-dialog" onClick={e => e.stopPropagation()}>
            <div className="import-dialog-title"><IcUpload size={14} /> 포트폴리오 불러오기</div>
            <div className="import-dialog-filename">{importDialogFile.name}</div>
            <p className="import-dialog-desc">불러오기 방식을 선택하세요.</p>
            <div className="import-dialog-options">
              <button className="import-option-btn" onClick={() => executeImport('overwrite')}>
                <span className="import-option-icon">🔄</span>
                <span className="import-option-label">덮어쓰기</span>
                <span className="import-option-desc">중복 ID 교체, 나머지 유지</span>
              </button>
              <button className="import-option-btn danger" onClick={() => executeImport('reset')}>
                <span className="import-option-icon"><IcTrash2 size={14} /></span>
                <span className="import-option-label">전체 초기화</span>
                <span className="import-option-desc">기존 삭제 후 교체</span>
              </button>
            </div>
            <div className="import-dialog-footer">
              <button className="import-cancel-btn" onClick={() => setImportDialogFile(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

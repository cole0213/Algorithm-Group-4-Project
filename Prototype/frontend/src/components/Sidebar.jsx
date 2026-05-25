import { useState, useRef, Fragment } from 'react';
import { renamePortfolio } from '../api';
import { STORAGE_KEYS } from '../constants';
import { matchClass } from '../utils';

const MARK_LABEL = { pass: '✓', hold: '?', fail: '✗' };
const MARK_TITLE = { pass: '통과', hold: '보류', fail: '탈락' };

function loadMarks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.MARKS)) || {}; }
  catch { return {}; }
}

function loadBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) || []); }
  catch { return new Set(); }
}

export default function Sidebar({ applicants, selectedIds, onToggle, onDelete, onRename, onUploadClick, blind, blindAliases, analyzing = false }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue]  = useState('');
  const inputRef = useRef(null);
  const [marks, setMarks] = useState(loadMarks);
  const [openMarkId, setOpenMarkId] = useState(null); // 마킹 드롭다운 열린 항목 ID
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minCareer, setMinCareer] = useState(0);
  const [filterSkill, setFilterSkill] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  function toggleBookmark(e, id) {
    e.stopPropagation();
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  function applyFilter(list) {
    return list.filter(a => {
      if (nameFilter.trim()) {
        const q = nameFilter.trim().toLowerCase();
        if (!a.name.toLowerCase().includes(q)) return false;
      }
      if (minCareer > 0 && (a.career_years ?? 0) < minCareer) return false;
      if (filterSkill.trim()) {
        const q = filterSkill.trim().toLowerCase();
        const hasSkill = (a.skills || []).some(s => s.toLowerCase().includes(q));
        if (!hasSkill) return false;
      }
      if (filterDateFrom || filterDateTo) {
        const addedAt = a._added_at ? a._added_at.slice(0, 10) : null;
        if (!addedAt) return false;
        if (filterDateFrom && addedAt < filterDateFrom) return false;
        if (filterDateTo && addedAt > filterDateTo) return false;
      }
      return true;
    });
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
      try {
        await renamePortfolio(id, trimmed);
        onRename?.(id, trimmed);
      } catch (e) { alert(e.message); }
    }
    setEditingId(null);
  }

  function handleKeyDown(e, id) {
    if (e.key === 'Enter') commitEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  }

  return (
    <div className="sidebar" onClick={() => setOpenMarkId(null)}>
      <div className="sidebar-header">
        {(minCareer > 0 || filterSkill.trim() || nameFilter.trim() || filterDateFrom || filterDateTo)
          ? `지원자 목록 · ${applyFilter([...applicants.filter(a => bookmarks.has(a.id)), ...applicants.filter(a => !bookmarks.has(a.id))]).length}명 / ${applicants.length}명`
          : `지원자 목록 · ${applicants.length}명`}
        <button
          className={`sidebar-filter-btn ${filterOpen ? 'active' : ''}`}
          title="조건 필터"
          onClick={() => setFilterOpen(v => !v)}
        >
          ⚙
        </button>
      </div>
      <div className="sidebar-name-filter-wrap">
        <input
          className="sidebar-name-filter"
          type="text"
          placeholder="이름 빠른 검색..."
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
        />
        {nameFilter && (
          <button
            className="sidebar-name-filter-clear"
            onClick={() => setNameFilter('')}
            title="초기화"
          >✕</button>
        )}
      </div>
      {filterOpen && (
        <div className="sidebar-filter-panel">
          <div className="filter-row">
            <label className="filter-label">경력 최소</label>
            <input
              type="number"
              className="filter-input"
              min={0}
              max={20}
              value={minCareer}
              onChange={e => setMinCareer(Number(e.target.value))}
              placeholder="0"
            />
            <span className="filter-unit">년 이상</span>
          </div>
          <div className="filter-row">
            <label className="filter-label">스킬 포함</label>
            <input
              type="text"
              className="filter-input"
              value={filterSkill}
              onChange={e => setFilterSkill(e.target.value)}
              placeholder="예: React"
            />
          </div>
          <div className="filter-date-row">
            <label className="filter-label">등록일</label>
            <input
              type="date"
              className="filter-date-input"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
            />
            <span className="filter-date-sep">~</span>
            <input
              type="date"
              className="filter-date-input"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
            />
          </div>
          {(minCareer > 0 || filterSkill || filterDateFrom || filterDateTo) && (
            <button
              className="filter-reset-btn"
              onClick={() => { setMinCareer(0); setFilterSkill(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            >
              필터 초기화
            </button>
          )}
        </div>
      )}
      <div className="sidebar-list">
        {analyzing ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-line medium" />
                <div className="skeleton skeleton-line short" style={{ marginTop: 6 }} />
              </div>
            ))}
          </>
        ) : (
        <>
        {applicants.length === 0 && (
          <div className="sidebar-empty">
            <div className="sidebar-empty-text">포트폴리오가 없습니다</div>
            <button className="sidebar-empty-btn" onClick={onUploadClick}>+ 포트폴리오 추가</button>
          </div>
        )}
        {(() => {
          const sorted = [
            ...applicants.filter(a => bookmarks.has(a.id)),
            ...applicants.filter(a => !bookmarks.has(a.id)),
          ];
          const filtered = applyFilter(sorted);
          return filtered.map((a, idx) => {
            const mark = marks[a.id] ?? null;
            const showDivider = idx > 0 && !bookmarks.has(a.id) && bookmarks.has(filtered[idx - 1]?.id);
            return (
              <Fragment key={a.id}>
                {showDivider && <div className="bookmark-divider" />}
                <div
                  className={`applicant-item ${selectedIds.includes(a.id) ? 'selected' : ''} ${mark ? `marked-${mark}` : ''}`}
                  onClick={() => onToggle(a.id)}
                >
                  <div className="applicant-item-top">
                    {editingId === a.id ? (
                      <input
                        ref={inputRef}
                        className="sidebar-name-edit"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(a.id)}
                        onKeyDown={e => handleKeyDown(e, a.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : blind ? (
                      <span className="applicant-name">
                        {blindAliases?.[a.id] || `지원자 #${idx + 1}`}
                      </span>
                    ) : (
                      <span
                        className="applicant-name"
                        title={`${a.name} · 더블클릭으로 이름 편집`}
                        onDoubleClick={e => startEdit(e, a)}
                      >
                        <span className="applicant-rank">#{idx + 1}</span> {a.name}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        className={`bookmark-btn ${bookmarks.has(a.id) ? 'bookmarked' : ''}`}
                        title={bookmarks.has(a.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                        onClick={e => toggleBookmark(e, a.id)}
                      >
                        {bookmarks.has(a.id) ? '★' : '☆'}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          className={`mark-btn ${mark ? `mark-${mark}` : ''}`}
                          title={mark ? `${MARK_TITLE[mark]} — 클릭해서 변경` : '심사 마킹 선택'}
                          onClick={e => toggleMarkDropdown(e, a.id)}
                        >
                          {mark ? MARK_LABEL[mark] : '·'}
                        </button>
                        {openMarkId === a.id && (
                          <div
                            className="mark-dropdown"
                            onClick={e => e.stopPropagation()}
                          >
                            {[
                              { value: 'pass', label: '✓ 통과', cls: 'mark-pass' },
                              { value: 'hold', label: '? 보류', cls: 'mark-hold' },
                              { value: 'fail', label: '✗ 탈락', cls: 'mark-fail' },
                              { value: null,   label: '— 마킹 없음', cls: '' },
                            ].map(opt => (
                              <button
                                key={String(opt.value)}
                                className={`mark-dropdown-item ${mark === opt.value ? 'selected' : ''} ${opt.cls}`}
                                onMouseDown={e => applyMark(e, a.id, opt.value)}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`match-badge ${matchClass(a.match_score)}`}>
                        {a.match_score}%
                      </span>
                      <button
                        className="sidebar-delete-btn"
                        title="삭제"
                        onClick={e => { e.stopPropagation(); onDelete(a.id); }}
                      >✕</button>
                    </div>
                  </div>
                  <div className="applicant-skills">
                    {(a.skills || []).slice(0, 4).join(' · ')}
                  </div>
                </div>
              </Fragment>
            );
          });
        })()}
        </>
        )}
      </div>
    </div>
  );
}

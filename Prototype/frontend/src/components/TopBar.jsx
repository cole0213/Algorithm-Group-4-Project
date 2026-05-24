import { useRef, useState, useEffect } from 'react';
import { exportPortfolios, importPortfolios, extractConfig } from '../api';

export default function TopBar({
  onSearch, requiredSpecs, onSpecsChange, onAnalyze,
  sortKey, onSortChange, onSettingsClick, onUploadClick, onFolderClick, onImported, onMatrixClick,
  onApplyConfig,
}) {
  const searchTimer = useRef(null);
  const importRef = useRef(null);
  const searchRef = useRef(null);
  const addMenuRef = useRef(null);

  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    if (!addMenuOpen) return;
    function handler(e) {
      if (!addMenuRef.current?.contains(e.target)) setAddMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addMenuOpen]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [jobDescOpen, setJobDescOpen] = useState(false);
  const [jobDescText, setJobDescText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [importDialogFile, setImportDialogFile] = useState(null);
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('search-history')) || []; }
    catch { return []; }
  });

  function saveHistory(q) {
    if (!q || q.trim().length < 2) return;
    setSearchHistory(prev => {
      const next = [q.trim(), ...prev.filter(h => h !== q.trim())].slice(0, 8);
      try { localStorage.setItem('search-history', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function handleImport(e) {
    const f = e.target.files[0];
    if (!f) return;
    setImportDialogFile(f);
    e.target.value = '';
  }

  async function executeImport(mode) {
    if (!importDialogFile) return;
    const file = importDialogFile;
    setImportDialogFile(null);
    try {
      const result = await importPortfolios(file, mode);
      onImported?.(result.message);
    } catch (err) {
      alert(err.message);
    }
  }

  function handleSearchInput(e) {
    const val = e.target.value;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      onSearch(val);
      saveHistory(val);
    }, 300);
  }

  async function handleExtract() {
    if (!jobDescText.trim()) return;
    setExtracting(true);
    try {
      const cfg = await extractConfig(jobDescText);
      if (onApplyConfig) {
        onApplyConfig(cfg);
      } else {
        onSpecsChange(cfg.specs_text);
      }
      setJobDescOpen(false);
      setJobDescText('');
    } catch (e) {
      alert('추출 실패: ' + e.message);
    } finally {
      setExtracting(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') onAnalyze();
  }

  return (
    <div className="topbar">
      <span className="topbar-title">Portfolio Reviewer</span>
      <div className="topbar-divider" />

      {/* 지원자 검색 */}
      <div className="topbar-field topbar-field-search">
        <span className="topbar-field-label">지원자 검색</span>
        <div className="topbar-input-wrap">
          <input
            ref={searchRef}
            className="topbar-input search"
            type="text"
            placeholder="이름 · 기술 · 키워드"
            onChange={handleSearchInput}
            onFocus={() => setHistoryOpen(true)}
            onBlur={() => setTimeout(() => setHistoryOpen(false), 150)}
          />
          <button
            className="topbar-input-icon-btn"
            title="검색 히스토리"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              searchRef.current?.focus();
              setHistoryOpen(v => !v);
            }}
          >🔍</button>
        </div>
        {historyOpen && searchHistory.length > 0 && (
          <div className="search-history-dropdown">
            {searchHistory.map((h, i) => (
              <div
                key={i}
                className="search-history-item"
                onMouseDown={() => {
                  onSearch(h);
                  saveHistory(h);
                  setHistoryOpen(false);
                }}
              >
                <span className="search-history-icon">🕐</span>
                {h}
              </div>
            ))}
            <div
              className="search-history-clear"
              onMouseDown={() => {
                setSearchHistory([]);
                try { localStorage.removeItem('search-history'); } catch {}
                setHistoryOpen(false);
              }}
            >
              히스토리 지우기
            </div>
          </div>
        )}
      </div>

      <div className="topbar-divider" />

      {/* 필요 스펙 입력 */}
      <div className="topbar-field topbar-field-specs">
        <span className="topbar-field-label">필요 스펙</span>
        <div className="topbar-input-wrap">
          <input
            className="topbar-input specs"
            type="text"
            placeholder="React, Python, Docker"
            value={requiredSpecs}
            onChange={e => onSpecsChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="topbar-input-icon-btn"
            title="AI 설정 자동 생성 — 채용 요구사항 + 보고싶은 항목 자연어 입력"
            tabIndex={-1}
            onClick={() => setJobDescOpen(v => !v)}
          >📋</button>
        </div>
        {jobDescOpen && (
          <div className="job-desc-popup">
            <div className="job-desc-header">
              <span>AI 설정 자동 생성</span>
              <button onClick={() => setJobDescOpen(false)}>✕</button>
            </div>
            <div className="job-desc-hint">
              채용 요구사항 + 포트폴리오에서 보고 싶은 항목을 자연어로 입력하세요.
              <br />Solar LLM이 <b>필요 스펙·표시 섹션·가중치</b>를 자동 세팅합니다.
            </div>
            <textarea
              className="job-desc-textarea"
              placeholder={"예) 백엔드 채용. Python·FastAPI 필수, AWS·Kubernetes 우대.\n경력·기술·프로젝트만 보고 싶고 자기소개나 수상은 빼줘. 프로젝트 비중 크게."}
              value={jobDescText}
              onChange={e => setJobDescText(e.target.value)}
              rows={7}
            />
            <button
              className="job-desc-extract-btn"
              onClick={handleExtract}
              disabled={extracting || !jobDescText.trim()}
            >
              {extracting ? '추출 중...' : '✨ AI 설정 자동 적용'}
            </button>
          </div>
        )}
      </div>
      <button className="topbar-btn primary" onClick={onAnalyze}>
        분석
      </button>

      {/* 정렬 */}
      <select
        className="topbar-select"
        value={sortKey}
        onChange={e => onSortChange(e.target.value)}
      >
        <option value="match">매칭률 높은 순</option>
        <option value="career">경력 많은 순</option>
        <option value="name">이름 순</option>
      </select>

      {/* 포트폴리오 추가 */}
      <div className="add-menu-wrap" ref={addMenuRef}>
        <button className="topbar-btn" onClick={() => setAddMenuOpen(v => !v)}>+ 추가 ▾</button>
        {addMenuOpen && (
          <div className="add-menu-dropdown">
            <button className="add-menu-item" onClick={() => { setAddMenuOpen(false); onUploadClick(); }}>
              <span className="add-menu-icon">📄</span>
              <span className="add-menu-text">
                <span className="add-menu-label">단일 파일 추가</span>
                <span className="add-menu-sub">PDF · MD · TXT 파일 1개</span>
              </span>
            </button>
            <button className="add-menu-item" onClick={() => { setAddMenuOpen(false); onFolderClick?.(); }}>
              <span className="add-menu-icon">📁</span>
              <span className="add-menu-text">
                <span className="add-menu-label">폴더 전체 불러오기</span>
                <span className="add-menu-sub">폴더 내 모든 파일 일괄 처리</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 스킬 매트릭스 CSV 내보내기 */}
      <button
        className="topbar-icon-btn"
        title="스킬 매트릭스 CSV 내보내기 — 지원자 × 스킬 격자를 CSV 파일로 다운로드"
        onClick={onMatrixClick}
      >
        ⊞
      </button>

      {/* 내보내기 */}
      <button className="topbar-icon-btn" title="내보내기 (JSON)" onClick={exportPortfolios}>⬇</button>

      {/* 불러오기 */}
      <input
        ref={importRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
      <button className="topbar-icon-btn" title="불러오기 (JSON)" onClick={() => importRef.current?.click()}>⬆</button>

      {/* 설정 */}
      <button className="topbar-btn" style={{ marginLeft: 'auto' }} onClick={onSettingsClick}>⚙ 설정</button>

      {/* 불러오기 확인 다이얼로그 */}
      {importDialogFile && (
        <div className="import-dialog-overlay" onClick={() => setImportDialogFile(null)}>
          <div className="import-dialog" onClick={e => e.stopPropagation()}>
            <div className="import-dialog-title">⬆ 포트폴리오 불러오기</div>
            <div className="import-dialog-filename">{importDialogFile.name}</div>
            <p className="import-dialog-desc">불러오기 방식을 선택하세요.</p>
            <div className="import-dialog-options">
              <button className="import-option-btn" onClick={() => executeImport('overwrite')}>
                <span className="import-option-icon">🔄</span>
                <span className="import-option-label">덮어쓰기</span>
                <span className="import-option-desc">중복 ID는 파일 내용으로 교체, 나머지는 유지</span>
              </button>
              <button className="import-option-btn danger" onClick={() => executeImport('reset')}>
                <span className="import-option-icon">🗑</span>
                <span className="import-option-label">전체 초기화</span>
                <span className="import-option-desc">기존 포트폴리오를 모두 삭제하고 파일로 교체</span>
              </button>
            </div>
            <div className="import-dialog-footer">
              <button className="import-cancel-btn" onClick={() => setImportDialogFile(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

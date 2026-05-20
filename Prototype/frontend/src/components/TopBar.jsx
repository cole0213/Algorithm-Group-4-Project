import { useRef, useState } from 'react';
import { exportPortfolios, importPortfolios, extractSpecs } from '../api';

export default function TopBar({
  onSearch, requiredSpecs, onSpecsChange, onAnalyze,
  sortKey, onSortChange, onSettingsClick, onUploadClick, onImported, onMatrixClick,
}) {
  const searchTimer = useRef(null);
  const importRef = useRef(null);
  const searchRef = useRef(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [jobDescOpen, setJobDescOpen] = useState(false);
  const [jobDescText, setJobDescText] = useState('');
  const [extracting, setExtracting] = useState(false);
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

  async function handleImport(e) {
    const f = e.target.files[0];
    if (!f) return;
    const overwrite = window.confirm(
      '불러오기 방식을 선택하세요.\n\n확인 → 덮어쓰기 (중복 ID는 기존 항목을 교체)\n취소 → 병합 (중복 ID는 새 ID로 추가)'
    );
    try {
      const result = await importPortfolios(f, overwrite);
      onImported?.(result.message);
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = '';
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
      const { specs_text } = await extractSpecs(jobDescText);
      onSpecsChange(specs_text);
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
        <input
          className="topbar-input search"
          type="text"
          placeholder="🔍  이름 · 기술 · 키워드"
          onChange={handleSearchInput}
          onFocus={() => setHistoryOpen(true)}
          onBlur={() => setTimeout(() => setHistoryOpen(false), 150)}
        />
        {historyOpen && searchHistory.length > 0 && (
          <div className="search-history-dropdown" ref={searchRef}>
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
      <div className="topbar-field" style={{ position: 'relative' }}>
        <span className="topbar-field-label">필요 스펙</span>
        <input
          className="topbar-input specs"
          type="text"
          placeholder="React, Python, Docker"
          value={requiredSpecs}
          onChange={e => onSpecsChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="topbar-icon-btn"
          title="채용 공고에서 스펙 자동 추출"
          onClick={() => setJobDescOpen(v => !v)}
        >📋</button>
        {jobDescOpen && (
          <div className="job-desc-popup">
            <div className="job-desc-header">
              <span>채용 공고 텍스트 붙여넣기</span>
              <button onClick={() => setJobDescOpen(false)}>✕</button>
            </div>
            <textarea
              className="job-desc-textarea"
              placeholder="채용 공고 내용을 붙여넣으세요..."
              value={jobDescText}
              onChange={e => setJobDescText(e.target.value)}
              rows={6}
            />
            <button
              className="job-desc-extract-btn"
              onClick={handleExtract}
              disabled={extracting || !jobDescText.trim()}
            >
              {extracting ? '추출 중...' : '🔍 스펙 자동 추출'}
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
      <button className="topbar-btn" onClick={onUploadClick}>+ 추가</button>

      {/* 스킬 매트릭스 */}
      <button
        className="topbar-icon-btn"
        title="스킬 매트릭스 — 지원자 × 스킬 격자 보기"
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
      <button className="topbar-btn" onClick={onSettingsClick}>⚙ 설정</button>
    </div>
  );
}

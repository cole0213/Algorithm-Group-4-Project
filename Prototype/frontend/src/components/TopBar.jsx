import { useRef } from 'react';
import { exportPortfolios, importPortfolios } from '../api';

export default function TopBar({
  onSearch, requiredSpecs, onSpecsChange, onAnalyze,
  sortKey, onSortChange, onSettingsClick, onUploadClick, onImported,
}) {
  const searchTimer = useRef(null);
  const importRef = useRef(null);

  async function handleImport(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const result = await importPortfolios(f);
      alert(result.message);
      onImported?.();
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = '';
    }
  }

  function handleSearchInput(e) {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onSearch(e.target.value), 300);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') onAnalyze();
  }

  return (
    <div className="topbar">
      <span className="topbar-title">Portfolio Reviewer</span>
      <div className="topbar-divider" />

      {/* 키워드 검색 */}
      <input
        className="topbar-input search"
        type="text"
        placeholder="🔍  검색 (Python · py · 파이썬)"
        onChange={handleSearchInput}
      />

      <div className="topbar-divider" />

      {/* 필요 스펙 입력 */}
      <input
        className="topbar-input specs"
        type="text"
        placeholder="필요 스펙: React, Python, Docker"
        value={requiredSpecs}
        onChange={e => onSpecsChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
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

      {/* 내보내기 */}
      <button className="topbar-btn" onClick={exportPortfolios}>↓ 내보내기</button>

      {/* 불러오기 */}
      <input
        ref={importRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
      <button className="topbar-btn" onClick={() => importRef.current?.click()}>↑ 불러오기</button>

      {/* 설정 */}
      <button className="topbar-btn" onClick={onSettingsClick}>⚙ 설정</button>
    </div>
  );
}

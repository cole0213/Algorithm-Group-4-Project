import { useState, useRef, useEffect } from 'react';
import PortfolioPanel from './PortfolioPanel';

const ACCEPTED_EXTS = ['.md', '.pdf'];
const isValidDrop = f => ACCEPTED_EXTS.some(ext => f.name.toLowerCase().endsWith(ext));

export default function PortfolioArea({
  applicants, selectedIds, onClose,
  similarMap, settings, searchQuery, stageSearch, visibleIds, onReanalyze, onSummarize, onUploadClick,
  scrollPos, onScrollSave, blindAliases, onDropFile,
}) {
  const panelRefs = useRef([]);
  const [slotState, setSlotState] = useState('idle'); // idle | over | dropped | error
  const [slotLabel, setSlotLabel] = useState('＋ Add Document');
  const leaveTimerRef = useRef(null);
  const isSyncing = useRef(false);
  const syncEnabled = useRef(settings.syncScroll);

  // syncScroll 설정 최신값을 ref에 반영
  useEffect(() => { syncEnabled.current = settings.syncScroll; }, [settings.syncScroll]);

  // 패널 수가 바뀌면 stale ref 제거
  useEffect(() => {
    panelRefs.current = panelRefs.current.slice(0, selectedIds.length);
  }, [selectedIds.length]);

  // 스크롤 이벤트 등록
  useEffect(() => {
    const cleanups = panelRefs.current.map((el, srcIdx) => {
      if (!el) return null;
      const fn = () => {
        if (!syncEnabled.current || isSyncing.current) return;
        isSyncing.current = true;
        const maxSrc = el.scrollHeight - el.clientHeight;
        const ratio = maxSrc > 0 ? el.scrollTop / maxSrc : 0;
        panelRefs.current.forEach((other, i) => {
          if (i === srcIdx || !other) return;
          const max = other.scrollHeight - other.clientHeight;
          other.scrollTop = ratio * max;
        });
        isSyncing.current = false;
      };
      el.addEventListener('scroll', fn);
      return () => el.removeEventListener('scroll', fn);
    });
    return () => cleanups.forEach(c => c?.());
  }, [selectedIds]);

  const selectedApplicants = selectedIds
    .map(id => applicants.find(a => a.id === id))
    .filter(Boolean);

  function handleSlotDragEnter(e) {
    e.preventDefault();
    clearTimeout(leaveTimerRef.current);
    setSlotState('over');
  }
  function handleSlotDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    clearTimeout(leaveTimerRef.current);
    setSlotState('over');
  }
  function handleSlotDragLeave() {
    leaveTimerRef.current = setTimeout(() => setSlotState('idle'), 80);
  }
  function handleSlotDrop(e) {
    e.preventDefault();
    clearTimeout(leaveTimerRef.current);
    const files = Array.from(e.dataTransfer.files).filter(isValidDrop);
    if (files.length === 0) {
      setSlotState('error');
      setSlotLabel('.md / .pdf only');
      setTimeout(() => { setSlotState('idle'); setSlotLabel('＋ Add Document'); }, 1600);
      return;
    }
    const f = files[0];
    const displayName = f.name.length > 14 ? f.name.slice(0, 12) + '…' : f.name;
    setSlotState('dropped');
    setSlotLabel('✓ ' + displayName);
    setTimeout(() => { setSlotState('idle'); setSlotLabel('＋ Add Document'); }, 2200);
    onDropFile?.(f);
  }

  return (
    <div className="portfolio-area">
      {/* 패널 영역 */}
      <div className={`portfolio-panels${settings.panelAnimation ? ' panels-anim' : ''}`}>
        {selectedApplicants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            {applicants.length === 0 ? (
              <>
                <div className="empty-text">포트폴리오가 없습니다</div>
                <button className="empty-upload-btn" onClick={onUploadClick}>+ 포트폴리오 추가</button>
              </>
            ) : (
              <div className="empty-text">좌측 목록에서 지원자를 클릭하면 여기에 포트폴리오가 표시됩니다 (최대 4개)</div>
            )}
          </div>
        ) : (
          <>
            {selectedApplicants.map((a, idx) => (
              <PortfolioPanel
                key={a.id}
                ref={el => { panelRefs.current[idx] = el; }}
                applicant={a}
                accentIdx={idx}
                onClose={() => onClose(a.id)}
                similarSpans={similarMap[a.id] || []}
                settings={settings}
                searchQuery={stageSearch || searchQuery}
                onReanalyze={onReanalyze}
                onSummarize={onSummarize}
                isFiltered={visibleIds !== null && !visibleIds.has(a.id)}
                blind={settings.blind}
                blindAliases={blindAliases}
                initialScrollTop={scrollPos?.[a.id] ?? 0}
                onScrollChange={(top) => onScrollSave?.(a.id, top)}
              />
            ))}
            {selectedIds.length < 4 && (
              <div
                className={`panel-add-slot ${slotState}`}
                title=".md 또는 .pdf 파일을 드래그 & 드롭하거나 클릭하세요"
                onClick={onUploadClick}
                onDragEnter={handleSlotDragEnter}
                onDragOver={handleSlotDragOver}
                onDragLeave={handleSlotDragLeave}
                onDrop={handleSlotDrop}
              >
                {slotLabel}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useRef, useEffect, useCallback } from 'react';
import PortfolioPanel from './PortfolioPanel';

export default function PortfolioArea({
  applicants, selectedIds, onClose,
  similarMap, settings, searchQuery, onSyncToggle,
}) {
  const panelRefs = useRef([]);
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

  return (
    <div className="portfolio-area">
      {/* 툴바 */}
      <div className="portfolio-toolbar">
        <div className="sync-toggle" onClick={onSyncToggle}>
          <span>동기화 스크롤</span>
          <div className={`toggle-pill ${settings.syncScroll ? 'on' : ''}`} />
        </div>
      </div>

      {/* 패널 영역 */}
      <div className="portfolio-panels">
        {selectedApplicants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">좌측 목록에서 지원자를 클릭하세요</div>
          </div>
        ) : (
          selectedApplicants.map((a, idx) => (
            <PortfolioPanel
              key={a.id}
              ref={el => { panelRefs.current[idx] = el; }}
              applicant={a}
              accentIdx={idx}
              onClose={() => onClose(a.id)}
              similarSpans={similarMap[a.id] || []}
              settings={settings}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  );
}

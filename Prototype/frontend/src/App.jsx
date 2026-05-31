import { useState, useEffect, useCallback } from 'react';
import HomePage from './pages/HomePage';
import WorkflowPage from './pages/WorkflowPage';

/* 단순 해시 기반 라우팅 ─ #workspace 일 때만 WorkflowPage 표시
   (그 외 모든 해시는 HomePage 내부 앵커 스크롤로 처리) */
function isWorkspaceRoute() {
  return typeof window !== 'undefined' && window.location.hash === '#workspace';
}

export default function App() {
  const [workspace, setWorkspace] = useState(isWorkspaceRoute);

  useEffect(() => {
    const onHash = () => setWorkspace(isWorkspaceRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const enterWorkspace = useCallback(() => {
    window.location.hash = '#workspace';
    setWorkspace(true);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, []);

  if (workspace) return <WorkflowPage />;
  return <HomePage onEnter={enterWorkspace} />;
}

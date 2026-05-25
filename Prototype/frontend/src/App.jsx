import { useState } from 'react';
import HomePage from './pages/HomePage';
import WorkflowPage from './pages/WorkflowPage';

export default function App() {
  const [page, setPage] = useState('home'); // 'home' | 'workflow'

  if (page === 'workflow') {
    return <WorkflowPage onGoHome={() => setPage('home')} />;
  }
  return <HomePage onEnter={() => setPage('workflow')} />;
}

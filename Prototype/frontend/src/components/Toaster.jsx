import { useState, useCallback, useRef } from 'react';

// ── 훅 ───────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'success', duration = 3000, onUndo = null) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, onUndo }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return { toasts, toast };
}

// ── 컴포넌트 ─────────────────────────────────────────────────────
export default function Toaster({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toaster">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
          {t.onUndo && (
            <button className="toast-undo-btn" onClick={t.onUndo}>취소</button>
          )}
        </div>
      ))}
    </div>
  );
}

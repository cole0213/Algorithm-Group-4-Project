import { useState, useRef } from 'react';
import { uploadPortfolio } from '../api';

const STEPS = [
  { id: 'reading', label: '파일 읽는 중...', icon: '📄' },
  { id: 'parsing', label: 'LLM 파싱 중...',  icon: '🤖' },
  { id: 'saving',  label: '저장 중...',       icon: '💾' },
  { id: 'done',    label: '완료!',            icon: '✅' },
];

export default function UploadModal({ onClose, onAdded }) {
  const [file, setFile]         = useState(null);
  const [text, setText]         = useState('');
  const [name, setName]         = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [uploadStep, setUploadStep] = useState(null); // null | 'reading' | 'parsing' | 'saving' | 'done'
  const [error, setError]       = useState('');
  const [solarLog, setSolarLog] = useState(null);
  const fileInputRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'md', 'txt'].includes(ext)) {
      setError('.pdf, .md, .txt 파일만 지원합니다.');
      return;
    }
    setError('');
    setFile(f);
    setText('');
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function onPaste(e) {
    const pasted = e.clipboardData.getData('text');
    if (pasted) { setText(pasted); setFile(null); }
  }

  async function handleSubmit() {
    if (!file && !text.trim()) {
      setError('파일 또는 텍스트를 입력해주세요.');
      return;
    }
    setLoading(true);
    setUploadStep('reading');
    setError('');
    try {
      setUploadStep('parsing');
      const result = await uploadPortfolio({ file, text, name, position: 'general' });
      setSolarLog(result.solar);
      if (result.duplicate_file) {
        setLoading(false);
        setUploadStep(null);
        if (!window.confirm('동일한 내용의 포트폴리오가 이미 존재합니다. 그래도 추가하시겠습니까?')) {
          return;
        }
        setLoading(true);
        setUploadStep('parsing');
      }
      if (result.duplicate_name) {
        setLoading(false);
        setUploadStep(null);
        if (!window.confirm(`'${result.portfolio.name}' 이름의 지원자가 이미 존재합니다. 동명이인으로 추가하시겠습니까?`)) {
          return;
        }
      }
      setUploadStep('saving');
      if (result.solar?.used) {
        setTimeout(() => {
          setUploadStep('done');
          setTimeout(() => { setLoading(false); onAdded(result); onClose(); }, 800);
        }, 1200);
      } else {
        setUploadStep('done');
        setTimeout(() => { setLoading(false); onAdded(result); onClose(); }, 800);
      }
    } catch (e) {
      setLoading(false);
      setUploadStep(null);
      setError(e.message || '업로드 중 오류가 발생했습니다.');
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="upload-modal"
        onClick={e => e.stopPropagation()}
        onPaste={onPaste}
      >
        {/* 헤더 */}
        <div className="modal-header">
          <span className="modal-title">포트폴리오 추가</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* 드래그앤드롭 */}
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.txt"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <div className="drop-icon">📄</div>
                <div className="drop-filename">{file.name}</div>
                <div className="drop-sub">다른 파일을 선택하려면 클릭</div>
              </>
            ) : (
              <>
                <div className="drop-icon">⬆</div>
                <div className="drop-label">파일을 드래그하거나 클릭하여 선택</div>
                <div className="drop-sub">.pdf · .md · .txt 지원</div>
              </>
            )}
          </div>

          {/* 구분선 */}
          <div className="modal-divider"><span>또는 텍스트 직접 입력</span></div>

          {/* 텍스트 */}
          <textarea
            className="paste-area"
            placeholder="포트폴리오 텍스트를 여기에 붙여넣으세요 (Ctrl+V)..."
            value={text}
            onChange={e => { setText(e.target.value); setFile(null); }}
            rows={6}
          />

          {/* 이름 */}
          <input
            className="topbar-input"
            style={{ width: '100%', marginTop: '2px' }}
            type="text"
            placeholder="지원자 이름 (선택사항)"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          {error && <div className="upload-error">{error}</div>}

          {/* 업로드 단계 표시 */}
          {uploadStep && (
            <div className="upload-steps">
              {STEPS.map((step, i) => {
                const currentIdx = STEPS.findIndex(s => s.id === uploadStep);
                const stepIdx = i;
                const isDone = stepIdx < currentIdx || uploadStep === 'done';
                const isActive = step.id === uploadStep;
                return (
                  <div
                    key={step.id}
                    className={`upload-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                  >
                    <span className="upload-step-icon">{isDone ? '✓' : step.icon}</span>
                    <span className="upload-step-label">{step.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Solar 디버그 */}
          {solarLog && (
            <div className={`solar-debug ${solarLog.used ? 'success' : 'fallback'}`}>
              {solarLog.used ? (
                <>
                  <span className="solar-debug-icon">✅</span>
                  <span>Solar LLM 파싱 완료 — {solarLog.elapsed}s</span>
                  <span className="solar-debug-tokens">
                    prompt {solarLog.tokens?.prompt_tokens ?? '?'} / completion {solarLog.tokens?.completion_tokens ?? '?'} 토큰
                  </span>
                  {solarLog.truncated && (
                    <span style={{ color: '#FFA500', fontSize: 11 }}>⚠ 원문 일부만 처리됨</span>
                  )}
                </>
              ) : (
                <>
                  <span className="solar-debug-icon">⚠️</span>
                  <span>기본 파서 사용 (Solar 미사용)</span>
                </>
              )}
            </div>
          )}

          {/* AI 파싱 고지 */}
          <p className="ai-notice">
            AI 파싱 결과는 원본 포트폴리오와 대조 확인이 필요합니다.
          </p>
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button className="topbar-btn" onClick={onClose} disabled={loading}>취소</button>
          <button
            className="topbar-btn primary"
            onClick={handleSubmit}
            disabled={loading || (!file && !text.trim())}
          >
            {loading ? (STEPS.find(s => s.id === uploadStep)?.label ?? '분석 중...') : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { uploadPortfolio } from '../api';

export default function UploadModal({ onClose, onAdded }) {
  const [file, setFile]         = useState(null);
  const [text, setText]         = useState('');
  const [name, setName]         = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [solarLog, setSolarLog] = useState(null);
  const fileInputRef = useRef(null);

  // ── 파일 선택 ─────────────────────────────────────────────────
  function handleFile(f) {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'md', 'txt'].includes(ext)) {
      setError('.pdf, .md, .txt 파일만 지원합니다.');
      return;
    }
    setError('');
    setFile(f);
    setText(''); // 파일 선택 시 텍스트 초기화
  }

  // ── 드래그앤드롭 ──────────────────────────────────────────────
  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  // ── 붙여넣기 ──────────────────────────────────────────────────
  function onPaste(e) {
    const pasted = e.clipboardData.getData('text');
    if (pasted) {
      setText(pasted);
      setFile(null);
    }
  }

  // ── 제출 ─────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!file && !text.trim()) {
      setError('파일 또는 텍스트를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await uploadPortfolio({ file, text, name });
      setSolarLog(result.solar);
      if (result.solar?.used) {
        // Solar 성공 시 잠시 디버그 창 보여준 후 닫기
        setTimeout(() => { onAdded(result); onClose(); }, 2000);
      } else {
        onAdded(result);
        onClose();
      }
    } catch (e) {
      setError(e.message || '업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
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
          {/* 드래그앤드롭 영역 */}
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
                <div className="drop-icon">⬆️</div>
                <div className="drop-label">파일을 드래그하거나 클릭하여 선택</div>
                <div className="drop-sub">.pdf · .md · .txt 지원</div>
              </>
            )}
          </div>

          {/* 구분선 */}
          <div className="modal-divider">
            <span>또는 텍스트 직접 입력</span>
          </div>

          {/* 텍스트 붙여넣기 */}
          <textarea
            className="paste-area"
            placeholder="포트폴리오 텍스트를 여기에 붙여넣으세요 (Ctrl+V)..."
            value={text}
            onChange={e => { setText(e.target.value); setFile(null); }}
            rows={6}
          />

          {/* 이름 입력 */}
          <input
            className="topbar-input"
            style={{ width: '100%', marginTop: '10px' }}
            type="text"
            placeholder="지원자 이름 (선택사항)"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          {error && <div className="upload-error">{error}</div>}

          {/* Solar 디버그 패널 */}
          {solarLog && (
            <div className={`solar-debug ${solarLog.used ? 'success' : 'fallback'}`}>
              {solarLog.used ? (
                <>
                  <span className="solar-debug-icon">✅</span>
                  <span>Solar LLM 파싱 완료 — {solarLog.elapsed}s</span>
                  <span className="solar-debug-tokens">
                    prompt {solarLog.tokens?.prompt_tokens ?? '?'} / completion {solarLog.tokens?.completion_tokens ?? '?'} 토큰
                  </span>
                </>
              ) : (
                <>
                  <span className="solar-debug-icon">⚠️</span>
                  <span>기본 파서 사용 (Solar 미사용)</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button className="topbar-btn" onClick={onClose} disabled={loading}>
            취소
          </button>
          <button
            className="topbar-btn primary"
            onClick={handleSubmit}
            disabled={loading || (!file && !text.trim())}
          >
            {loading ? '분석 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

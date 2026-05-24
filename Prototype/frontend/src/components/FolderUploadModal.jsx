import { useState, useRef } from 'react';
import { uploadPortfolio } from '../api';

const SUPPORTED_EXTS = ['pdf', 'md', 'txt'];

function fileExt(name) {
  return name.split('.').pop().toLowerCase();
}

export default function FolderUploadModal({ onClose, onAllAdded }) {
  const folderRef = useRef(null);
  const [files, setFiles]     = useState([]); // { file, status, resultName, error }
  const [running, setRunning] = useState(false);
  const [done, setDone]       = useState(false);

  function handleSelect(e) {
    const all = Array.from(e.target.files);
    const valid = all.filter(f => SUPPORTED_EXTS.includes(fileExt(f.name)));
    setFiles(valid.map(f => ({
      file: f, status: 'pending', resultName: null, error: null, dupInfo: null,
    })));
    setDone(false);
    e.target.value = '';
  }

  async function handleUploadAll() {
    const pending = files.filter(f => f.status === 'pending');
    if (!pending.length) return;
    setRunning(true);

    const added = [];
    const snapshot = [...files];

    for (let i = 0; i < snapshot.length; i++) {
      if (snapshot[i].status !== 'pending') continue;

      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'uploading' } : f
      ));

      try {
        const result = await uploadPortfolio({
          file: snapshot[i].file,
          text: '',
          name: '',
          position: 'general',
        });

        // 내용 중복 감지 — 폴더 업로드는 자동 건너뜀
        if (result.content_duplicate) {
          const { name: dupName, similarity } = result.content_duplicate;
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f, status: 'duplicate',
              dupInfo: `"${dupName}"과 ${similarity}% 일치`,
            } : f
          ));
          continue;
        }

        const pName = result.portfolio?.name || snapshot[i].file.name;
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'done', resultName: pName } : f
        ));
        added.push(result);
      } catch (err) {
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error', error: err.message } : f
        ));
      }
    }

    setRunning(false);
    setDone(true);
    if (added.length > 0) onAllAdded(added);
  }

  const doneCount  = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const dupCount   = files.filter(f => f.status === 'duplicate').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const total = files.length;

  const processed = doneCount + errorCount + dupCount;
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="upload-modal folder-upload-modal" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="modal-header">
          <span className="modal-title">📁 폴더 전체 불러오기</span>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* 폴더 선택 영역 */}
          <div
            className={`drop-zone ${files.length ? 'has-file' : ''} ${running ? 'disabled' : ''}`}
            onClick={() => !running && folderRef.current?.click()}
          >
            <input
              ref={folderRef}
              type="file"
              style={{ display: 'none' }}
              webkitdirectory=""
              multiple
              onChange={handleSelect}
            />
            {files.length > 0 ? (
              <>
                <div className="drop-icon">📁</div>
                <div className="drop-filename">{total}개 파일 선택됨</div>
                <div className="drop-sub">{!running && '다른 폴더를 선택하려면 클릭'}</div>
              </>
            ) : (
              <>
                <div className="drop-icon">📁</div>
                <div className="drop-label">폴더를 클릭하여 선택</div>
                <div className="drop-sub">.pdf · .md · .txt 파일이 자동으로 필터링됩니다</div>
              </>
            )}
          </div>

          {/* 진행 바 */}
          {running && (
            <div className="folder-progress-wrap">
              <div className="folder-progress-bar" style={{ '--pct': `${progress}%` }} />
              <span className="folder-progress-text">
                {processed} / {total} 처리 중...
              </span>
            </div>
          )}

          {/* 파일 목록 */}
          {files.length > 0 && (
            <div className="folder-file-list">
              {files.map((f, i) => (
                <div key={i} className={`folder-file-item status-${f.status}`}>
                  <span className="folder-file-icon">
                    {f.status === 'pending'   ? '📄'
                   : f.status === 'uploading' ? '⏳'
                   : f.status === 'done'      ? '✅'
                   : f.status === 'duplicate' ? '⚠️'
                   :                            '❌'}
                  </span>
                  <span className="folder-file-name">{f.file.name}</span>
                  {f.status === 'done' && f.resultName && (
                    <span className="folder-file-result">→ {f.resultName}</span>
                  )}
                  {f.status === 'duplicate' && (
                    <span className="folder-file-dup">중복 건너뜀 ({f.dupInfo})</span>
                  )}
                  {f.status === 'error' && (
                    <span className="folder-file-error">{f.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 완료 요약 */}
          {done && (
            <div className={`folder-summary ${errorCount > 0 ? 'has-error' : 'all-ok'}`}>
              {doneCount > 0  && <span className="folder-summary-ok">✅ {doneCount}개 추가 완료</span>}
              {dupCount > 0   && <span className="folder-summary-dup">⚠️ {dupCount}개 중복 건너뜀</span>}
              {errorCount > 0 && <span className="folder-summary-err">❌ {errorCount}개 실패</span>}
            </div>
          )}

          <p className="ai-notice">AI 파싱 결과는 원본 포트폴리오와 대조 확인이 필요합니다.</p>
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          <button className="topbar-btn" onClick={onClose} disabled={running}>
            {done ? '닫기' : '취소'}
          </button>
          {!done && (
            <button
              className="topbar-btn primary"
              onClick={handleUploadAll}
              disabled={running || pendingCount === 0}
            >
              {running
                ? `업로드 중... (${doneCount + errorCount}/${total})`
                : `${pendingCount}개 모두 추가`}
            </button>
          )}
          {done && (
            <button className="topbar-btn primary" onClick={onClose}>완료</button>
          )}
        </div>
      </div>
    </div>
  );
}

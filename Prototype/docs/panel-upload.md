# 패널 업로드 — Add Document 슬롯

> mockup v4 기준. 실제 구현 시 `WorkflowPage.jsx`의 `UploadModal` 흐름과 연결한다.

---

## 개요

포트폴리오 뷰어 우측 끝에 고정된 **Add Document** 슬롯을 통해 `.md` 또는 `.pdf` 파일을 직접 드래그 & 드롭으로 업로드할 수 있다. 기존 사이드바 업로드 버튼의 단축 경로로, 열려있는 패널 옆에 바로 새 포트폴리오를 추가할 때 편리하게 사용한다.

---

## 슬롯 레이아웃

| 항목 | 값 |
| ---- | -- |
| 너비 | `44px` (고정) |
| 높이 | 스테이지 영역 전체 높이에 맞게 stretch |
| 텍스트 방향 | `writing-mode: vertical-rl; transform: rotate(180deg)` |
| 기본 스타일 | 대시 테두리 (`1.5px dashed`), 투명 배경, 연한 회색 텍스트 |
| 패널 간격 | 카드 사이 `gap: 8px` (이전 20px → 축소) |

---

## 드래그 & 드롭 동작

### 허용 파일 형식

| 형식 | 확장자 |
| ---- | ------ |
| Markdown | `.md` |
| PDF | `.pdf` |

`.txt`, `.docx` 등 기타 형식은 거부하고 오류 상태로 피드백한다.

### 상태 전환

```
기본 ──dragenter──▶ drag-over ──drop──▶ dropped (2.2s) ──▶ 기본
                                  └──(잘못된 형식)──▶ drop-err (1.6s) ──▶ 기본
```

| 상태 | 테두리 | 배경 | 텍스트 | 레이블 |
| ---- | ------ | ---- | ------ | ------ |
| 기본 | `1.5px dashed #d4cebe` | 투명 | `#b8b2a4` | `＋ Add Document` |
| drag-over | `1.5px solid #4361EE` | `rgba(67,97,238,.07)` | `#4361EE` | `＋ Add Document` |
| dropped | `1.5px solid #2DC653` | `rgba(45,198,83,.08)` | `#2DC653` | `✓ {파일명}` |
| drop-err | `1.5px dashed #E63946` | 투명 | `#E63946` | `.md / .pdf only` |

### 파일명 표시

- 14자 이하: 그대로 표시 (`report.md`)
- 15자 이상: 12자 잘라서 `…` 추가 (`김철수_포트폴리…`)

---

## 실제 구현 연결 포인트

```
[드롭 이벤트]
  ↓ File 객체 추출
  ↓ isValid() 검사 (.md / .pdf)
  ↓ 성공 → UploadModal 또는 직접 /api/portfolios 호출
  ↓ 실패 → drop-err 상태 + 메시지
```

- **MD 파일**: `FileReader.readAsText()` → 텍스트 추출 → `/api/portfolios` `text` 필드로 전송
- **PDF 파일**: `FormData` + `multipart/form-data` → `/api/portfolios` `file` 필드로 전송
- 업로드 후 Solar LLM 파싱 완료까지 슬롯에 진행 표시 (스피너 또는 percent 텍스트)

---

## JS 이벤트 핸들러 요약

```js
dropZone.addEventListener('dragenter', e => { e.preventDefault(); show('drag-over'); });
dropZone.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
dropZone.addEventListener('dragleave', e => { debounce(() => hide('drag-over'), 80); });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(isValid);
  if (!files.length) { show('drop-err'); return; }
  show('dropped', files[0].name);
  uploadFile(files[0]);   // ← 실제 API 연결 지점
});
```

---

## 미구현 / 추후 과제

- [ ] 다중 파일 동시 드롭 지원 (현재 첫 번째 파일만 처리)
- [ ] 드롭 후 업로드 진행률 표시 (슬롯 내 퍼센트 또는 로딩 바)
- [ ] 슬롯 클릭 시 파일 선택 다이얼로그 열기 (`<input type="file" accept=".md,.pdf">`)
- [ ] 모바일 터치 지원 (현재 데스크톱 드래그만 처리)

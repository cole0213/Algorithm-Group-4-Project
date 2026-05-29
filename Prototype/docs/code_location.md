# 코드 위치 참조

기능·알고리즘별로 해당 코드가 어디에 있는지 빠르게 찾기 위한 참조 문서다.

---

## 알고리즘 구현체

| 알고리즘 | 파일 | 핵심 클래스/함수 |
|----------|------|-----------------|
| #1 Solar LLM 파싱 | `backend/services/solar.py` | `parse_portfolio()`, `extract_config()` |
| #1 HTTP 클라이언트 | `backend/services/_solar_http.py` | `solar_chat()` |
| #2 해시 테이블 | `backend/services/algorithms/hash_table.py` | `class SpecMatcher` |
| #3 Edit Distance | `backend/services/algorithms/edit_distance.py` | `edit_distance()`, `is_similar()` |
| #4 LCS | `backend/services/algorithms/lcs.py` | `lcs_length()`, `match_score()` |
| #5 정렬 | `backend/services/algorithms/sort.py` | `sort_applicants()` |
| #6 BST (전체 검색) | `backend/services/algorithms/bst.py` | `class ApplicantIndex` |
| #6 BST (내부 검색) | `backend/services/algorithms/bst.py` | `class TextIndex` |
| #7a 별칭 사전 | `backend/services/algorithms/alias_map.py` | `normalize()`, `get_aliases()` |
| #7b 별칭 검색 | `backend/services/algorithms/alias_search.py` | `expand_query()`, `portfolio_matches_query()`, `highlight_positions()` |
| #8 Rabin-Karp | `backend/services/algorithms/rabin_karp.py` | `detect_similar()`, `_rolling_hashes()` |
| #8 공통 유틸 | `backend/services/algorithms/_common.py` | `merge_ranges()` |

---

## API 엔드포인트

| 엔드포인트 | 파일 | 기능 |
|-----------|------|------|
| `POST /portfolios/add` | `backend/routers/portfolios.py` | 포트폴리오 업로드·파싱 |
| `POST /portfolios/{id}/reanalyze` | `backend/routers/portfolios.py` | Solar 재파싱 |
| `DELETE /portfolios/{id}` | `backend/routers/portfolios.py` | 포트폴리오 삭제 |
| `POST /analyze` | `backend/routers/portfolios.py` | 스펙 매칭 + 매칭 점수 산출 |
| `GET /search` | `backend/routers/portfolios.py` | 별칭 확장 + BST 검색 |
| `GET /similar` | `backend/routers/portfolios.py` | Rabin-Karp 유사 문장 검출 |
| `POST /diff` | `backend/routers/utils.py` | 두 포트폴리오 비교 |
| `GET /portfolios/export` | `backend/routers/portfolios.py` | 세션 JSON 내보내기 |
| `POST /portfolios/import` | `backend/routers/portfolios.py` | 세션 JSON 가져오기 |
| `POST /extract-config` | `backend/routers/utils.py` | Solar로 채용 설정 자동 추출 |
| `POST /extract-specs` | `backend/routers/utils.py` | 채용 공고 텍스트에서 스펙 키워드 추출 |
| `POST /portfolios/summarize-all` | `backend/routers/portfolios.py` | 채용 설정 기준으로 전체 포트폴리오 AI 요약 |
| `POST /portfolios/{id}/summarize` | `backend/routers/portfolios.py` | 채용 설정 기준으로 단일 포트폴리오 AI 요약 |

---

## 프론트엔드 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| 앱 진입점 | `frontend/src/main.jsx` | React 렌더링 루트 |
| 라우팅 | `frontend/src/App.jsx` | HomePage ↔ WorkflowPage |
| 메인 화면 | `frontend/src/pages/WorkflowPage.jsx` | 전체 상태 관리, 레이아웃 |
| 랜딩 페이지 | `frontend/src/pages/HomePage.jsx` | 프로젝트 소개 |
| 상단 바 | `frontend/src/components/TopBar.jsx` | 검색, 정렬, 내보내기, 채용설정 버튼 |
| 지원자 리스트 | `frontend/src/components/Sidebar.jsx` | 선택, 필터, 상태·북마크 |
| 패널 컨테이너 | `frontend/src/components/PortfolioArea.jsx` | 최대 4개 패널 flex 레이아웃 |
| 포트폴리오 패널 | `frontend/src/components/PortfolioPanel.jsx` | 섹션 표시, 하이라이트, 메모 |
| 설정 드로어 | `frontend/src/components/SettingsDrawer.jsx` | 토글, 가중치 슬라이더, 색상 |
| 채용 설정 모달 | `frontend/src/components/JobConfigModal.jsx` | AI 추출, 스펙, 가중치, 필터 |
| 타임라인 | `frontend/src/components/Timeline.jsx` | 수평 기간 시각화 |
| Diff 모달 | `frontend/src/components/DiffModal.jsx` | 두 포트폴리오 좌우 비교 |
| 스킬 매트릭스 | `frontend/src/components/SkillMatrix.jsx` | 지원자 × 스킬 그리드 |
| 단일 업로드 | `frontend/src/components/UploadModal.jsx` | 파일/URL/텍스트 업로드 |
| 폴더 업로드 | `frontend/src/components/FolderUploadModal.jsx` | 일괄 업로드 |
| 토스트 알림 | `frontend/src/components/Toaster.jsx` | 알림 메시지 |

---

## 프론트엔드 유틸

| 파일 | 내용 |
|------|------|
| `frontend/src/api.js` | 백엔드 API 호출 함수 전체 |
| `frontend/src/constants.js` | 섹션 목록, 기본 가중치 등 전역 상수 |
| `frontend/src/utils.js` | 날짜 파싱, 텍스트 처리 헬퍼 |
| `frontend/src/index.css` | 전역 CSS (색상 변수, 레이아웃, 타이포) |

---

## 백엔드 유틸

| 파일 | 내용 |
|------|------|
| `backend/routers/utils.py` | `_ensure_portfolio_defaults()`, 기본 가중치 상수, KNOWN_SECTIONS |
| `backend/services/parser.py` | `parse_pdf()` (pdfplumber), `parse_text()` 폴백 파싱, `clean_name()` |
| `backend/services/_solar_http.py` | `call_solar_chat()` — httpx 비동기 Solar API 호출 래퍼 |
| `backend/services/algorithms/_common.py` | `merge_ranges()` — Rabin-Karp·alias_search 공유 구간 병합 유틸 |

---

## 환경 설정

| 항목 | 위치 |
|------|------|
| Solar API 키 | `backend/.env` → `SOLAR_API_KEY` (또는 `UPSTAGE_API_KEY`) |
| Solar 모델 이름 | `backend/.env` → `SOLAR_MODEL=solar-pro` |
| Vite API 프록시 | `frontend/vite.config.js` → `/api` → `http://localhost:8000` |
| pip 의존성 | `backend/requirements.txt` |
| npm 의존성 | `frontend/package.json` |

> `SOLAR_API_KEY`와 `UPSTAGE_API_KEY` 중 하나만 설정해도 모든 기능이 동작합니다.

---

## 기능별 코드 흐름 빠른 참조

### 포트폴리오 업로드 흐름
```
UploadModal.jsx
  → api.js: addPortfolio()
  → POST /portfolios/add (portfolios.py)
  → parser.py: parse_pdf()
  → solar.py: parse_portfolio()
  → session.json 저장
```

### 스펙 매칭·점수 흐름
```
JobConfigModal.jsx: [Apply]
  → api.js: analyzePortfolios()
  → POST /portfolios/analyze (portfolios.py)
  → hash_table.py: SpecMatcher.match_skills()
  → lcs.py: match_score()
  → sort.py: sort_applicants()
  → Sidebar.jsx: 매칭률 배지 표시
  → PortfolioPanel.jsx: 스킬 하이라이트
```

### 키워드 검색 흐름
```
TopBar.jsx: 검색 입력 (300ms 디바운스)
  → api.js: searchPortfolios()
  → POST /portfolios/search (portfolios.py)
  → alias_search.py: expand_query()
  → bst.py: ApplicantIndex.search()  (전체 검색)
         또는 TextIndex.search()     (내부 검색)
  → Sidebar.jsx: 결과 지원자 하이라이트
```

### 유사 문장 검출 흐름
```
PortfolioArea.jsx: 패널 2개 이상 열림
  → api.js: detectSimilar()
  → POST /portfolios/similar (portfolios.py)
  → rabin_karp.py: detect_similar()
      → _rolling_hashes() (Rabin-Karp)
      → lcs.py: lcs_length() (검증)
      → _common.py: merge_ranges()
      → _section_spans() (섹션 경계 분할)
  → PortfolioPanel.jsx: 색상 그룹 하이라이트
```

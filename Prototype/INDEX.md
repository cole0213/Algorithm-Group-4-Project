# INDEX.md — Portfolio Reviewer 프로젝트 파일 색인

> 최종 업데이트: 2026-05-20

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [실행 방법](#2-실행-방법)
3. [문서 파일](#3-문서-파일)
4. [백엔드](#4-백엔드)
5. [프론트엔드](#5-프론트엔드)
6. [샘플 데이터](#6-샘플-데이터)
7. [알고리즘 구현 위치](#7-알고리즘-구현-위치)
8. [API 엔드포인트 요약](#8-api-엔드포인트-요약)

---

## 1. 프로젝트 개요

면접 서류심사 편의를 위한 개발자 포트폴리오 정형화·비교 웹 사이트.
PDF/URL/텍스트로 제출된 포트폴리오를 Solar LLM으로 파싱해 정형화된 서식으로 나열하고,
필요 스펙 하이라이트·유사 문장 검출·키워드 검색 등을 제공한다.

| 항목 | 내용 |
|------|------|
| Frontend | React 18 + Vite (포트 5173) |
| Backend | Python 3 + FastAPI (포트 8000) |
| LLM | Upstage Solar API (`solar-pro`) |
| PDF 파싱 | pdfplumber |
| 데이터 저장 | `backend/session.json` (서버), `localStorage` (브라우저 캐시) |

---

## 2. 실행 방법

```bash
# 루트 디렉토리에서
start.bat        # 백엔드 + 프론트엔드 동시 실행

# 개별 실행
cd backend && uvicorn main:app --reload --port 8000
cd frontend && npm run dev
```

환경 변수: `backend/.env` 에 `UPSTAGE_API_KEY=` 설정 필요 (`backend/.env.example` 참고).

---

## 3. 문서 파일

| 파일 | 설명 |
|------|------|
| `CLAUDE.md` | Claude Code 작업 규칙, 기술 스택, 알고리즘 목록 |
| `기획서.md` | 주제, 입출력, 전체 흐름, UI 구성, 기능 목록, localStorage 캐시 명세 |
| `style.md` | 색상 팔레트, 타이포그래피, 레이아웃, 컴포넌트 인터랙션 기준 |
| `개발환경.md` | 기술 스택, 디렉토리 구조, 설치·실행 명령어, 환경 변수 |
| `SolarLLMAPI사용메뉴얼.md` | Upstage Solar API 호출 방식, 프롬프트 설계 참고 |
| `solar-설계.md` | Solar LLM 프롬프트 설계 상세 |
| `런칭-가이드.md` | 서버 실행·배포 절차 |
| `추가 기능 내용.md` | 추가 구현 아이디어 목록 (UX, 내부 구조, 경쟁 비교) |
| `개선사항_요청.md` | 구현 요청 사항 목록 |
| `INDEX.md` | 이 파일 — 전체 파일 색인 |

---

## 4. 백엔드

### 진입점

| 파일 | 설명 |
|------|------|
| `backend/main.py` | FastAPI 앱 생성, CORS 설정, 라우터 등록 |
| `backend/requirements.txt` | Python 의존성 목록 |
| `backend/.env.example` | 환경 변수 샘플 |

### 라우터

| 파일 | 설명 |
|------|------|
| `backend/routers/portfolios.py` | 포트폴리오 CRUD, 검색, 유사도, 내보내기/불러오기, 원본 조회 전체 API |

### 서비스 / 알고리즘

| 파일 | 알고리즘 | 설명 |
|------|----------|------|
| `backend/services/algorithms/hash_table.py` | 해시 테이블 | 필요 스펙 O(1) 매칭·하이라이트 |
| `backend/services/algorithms/edit_distance.py` | Edit Distance (DP) | 기술명 표기 차이 흡수, LCS 매칭 점수 |
| `backend/services/algorithms/sort.py` | 정렬 | 매칭률·경력·이름 기준 순위 정렬 |
| `backend/services/algorithms/bst.py` | BST | 키워드 검색 (전체/intra 두 모드), name·career_years 인덱싱 |
| `backend/services/algorithms/alias_search.py` | 별칭 해시맵 + Edit Distance | 유사 언어명 동시 검색, 이름·경력 필드 포함 |
| `backend/services/algorithms/alias_map.py` | 별칭 해시맵 데이터 | 언어·프레임워크 별칭 정의 (JS→JavaScript 등) |

---

## 5. 프론트엔드

### 진입점

| 파일 | 설명 |
|------|------|
| `frontend/src/main.jsx` | React 앱 마운트 |
| `frontend/src/App.jsx` | 전역 상태 관리, localStorage 캐시(`portfolio-reviewer-cache`), 유사 문장 자동 실행 |
| `frontend/src/api.js` | 백엔드 API 호출 함수 전체 |
| `frontend/src/index.css` | 전역 CSS (디자인 토큰, 레이아웃, 컴포넌트 스타일) |

### 컴포넌트

| 파일 | 설명 |
|------|------|
| `frontend/src/components/TopBar.jsx` | 상단 바 — 지원자 검색, 필요 스펙 입력, 정렬, 추가/내보내기/불러오기/설정 |
| `frontend/src/components/Sidebar.jsx` | 좌측 지원자 리스트 — 더블클릭 인라인 이름 편집, 매칭률 뱃지 |
| `frontend/src/components/PortfolioArea.jsx` | 우측 패널 영역 — 최대 4개 수평 나열, 동기화 스크롤 ON/OFF |
| `frontend/src/components/PortfolioPanel.jsx` | 포트폴리오 상세 패널 — 원본 보기(상단), 마크다운 뷰 토글, 유사 문장 하이라이트, intra 검색, 링크·볼드 렌더링 |
| `frontend/src/components/UploadModal.jsx` | 포트폴리오 추가 모달 — PDF/URL/텍스트, 중복 파일·이름 감지 |
| `frontend/src/components/SettingsDrawer.jsx` | 설정 드로어 — 하이라이트·유사·원본·동기화 스크롤 등 토글 |

---

## 6. 샘플 데이터

### 비정형화 포트폴리오 (업로드 테스트용 원본)

| 파일 | 유형 |
|------|------|
| `비정형화_포트폴리오/김민준_포트폴리오.md` | 일반 마크다운 |
| `비정형화_포트폴리오/이서연_포트폴리오.md` | 일반 마크다운 |
| `비정형화_포트폴리오/박도현_포트폴리오.md` | 일반 마크다운 |
| `비정형화_포트폴리오/최하은_포트폴리오.md` | 일반 마크다운 |
| `비정형화_포트폴리오/정우성_포트폴리오.md` | 일반 마크다운 |
| `비정형화_포트폴리오/강태양_포트폴리오.md` | 일반 마크다운 |
| `비정형화_포트폴리오/오지훈_포트폴리오.md` | 일반 마크다운 |
| `비정형화_포트폴리오/한소희_포트폴리오_notion.md` | Notion 내보내기 스타일 |
| `비정형화_포트폴리오/임재현_포트폴리오_pdf.md` | PDF 변환 텍스트 |
| `비정형화_포트폴리오/윤석호_포트폴리오.md` | 일반 마크다운 |

### UI 프로토타입 포트폴리오 (초기 기획 단계 샘플)

`ui-prototype/portfolios/` — 김지수, 이민준, 박서연, 최준혁, 정하은, 오승민

---

## 7. 알고리즘 구현 위치

| # | 알고리즘 | 파일 | 호출 위치 |
|---|----------|------|-----------|
| 1 | Solar LLM 파싱 | `routers/portfolios.py` | `POST /api/portfolios` |
| 2 | 해시 테이블 (스펙 매칭) | `algorithms/hash_table.py` | `POST /api/portfolios/analyze` |
| 3 | Edit Distance | `algorithms/edit_distance.py` | `hash_table.py`, `alias_search.py` |
| 4 | LCS (매칭 점수) | `algorithms/edit_distance.py` | `hash_table.py` |
| 5 | 정렬 | `algorithms/sort.py` | `GET /api/portfolios` |
| 6 | BST (키워드 검색) | `algorithms/bst.py` | `GET /api/portfolios/search` |
| 7 | 별칭 해시맵 + Edit Distance | `algorithms/alias_search.py`, `alias_map.py` | `GET /api/portfolios/search` |
| 8 | Rabin-Karp + LCS (유사 문장) | `routers/portfolios.py` | `POST /api/portfolios/similar` |

---

## 8. API 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/portfolios` | 전체 포트폴리오 목록 조회 (정렬 포함) |
| `POST` | `/api/portfolios` | 포트폴리오 추가 (PDF/URL/텍스트 → Solar LLM 파싱) |
| `DELETE` | `/api/portfolios/{id}` | 포트폴리오 삭제 |
| `PATCH` | `/api/portfolios/{id}/name` | 포트폴리오 이름 변경 |
| `GET` | `/api/portfolios/{id}/raw` | 원본 텍스트 조회 |
| `POST` | `/api/portfolios/analyze` | 필요 스펙 매칭 분석 (해시 테이블 + LCS) |
| `GET` | `/api/portfolios/search` | 키워드 검색 (BST + 별칭 해시맵, `mode=global\|intra`) |
| `POST` | `/api/portfolios/similar` | 포트폴리오 간 유사 문장 검출 (Rabin-Karp + LCS) |
| `GET` | `/api/portfolios/export` | 전체 데이터 JSON 내보내기 |
| `POST` | `/api/portfolios/import` | JSON 불러오기 (덮어쓰기 / 병합 모드) |

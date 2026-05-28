# 디렉토리 구조

```
Prototype/
├── docs/                              # 프로젝트 문서 (신규)
│   ├── overview.md                    # 프로젝트 개요
│   ├── features.md                    # 기능 명세
│   ├── directory.md                   # 이 파일 — 디렉토리 구조
│   ├── algorithms.md                  # 알고리즘 설명
│   └── code_location.md               # 코드 위치 참조
│
├── backend/                           # Python + FastAPI 서버
│   ├── main.py                        # FastAPI 앱 진입점, CORS 설정
│   ├── requirements.txt               # pip 의존성 목록
│   ├── .env.example                   # 환경 변수 템플릿
│   ├── session.json                   # 런타임 세션 데이터 (gitignore)
│   │
│   ├── routers/                       # API 라우터
│   │   ├── __init__.py
│   │   ├── portfolios.py              # 포트폴리오 CRUD·분석·검색·유사문장 엔드포인트
│   │   └── utils.py                   # 채용 설정 추출, 공통 헬퍼 함수
│   │
│   └── services/                      # 비즈니스 로직·외부 연동
│       ├── __init__.py
│       ├── solar.py                   # Upstage Solar API 호출 및 파싱 로직
│       ├── _solar_http.py             # Solar HTTP 클라이언트 (httpx 래퍼)
│       ├── parser.py                  # PDF 파싱 (pdfplumber), 폴백 텍스트 파싱
│       └── algorithms/                # 핵심 알고리즘 구현 (파일별 분리)
│           ├── __init__.py
│           ├── _common.py             # 공통 유틸 (merge_ranges)
│           ├── hash_table.py          # 알고리즘 #2 — 해시 테이블 스펙 매칭
│           ├── edit_distance.py       # 알고리즘 #3 — Edit Distance (DP)
│           ├── lcs.py                 # 알고리즘 #4 — LCS (DP) 매칭 점수
│           ├── sort.py                # 알고리즘 #5 — 다중 기준 정렬
│           ├── bst.py                 # 알고리즘 #6 — BST 키워드 검색
│           ├── alias_map.py           # 알고리즘 #7a — 기술명 별칭 사전 (150+ 항목)
│           ├── alias_search.py        # 알고리즘 #7b — 별칭 확장 + 퍼지 매칭
│           └── rabin_karp.py          # 알고리즘 #8 — Rabin-Karp + LCS 유사문장 검출
│
├── frontend/                          # React + Vite 클라이언트
│   ├── package.json                   # npm 의존성
│   ├── vite.config.js                 # Vite 설정 (API proxy /api → :8000)
│   ├── index.html                     # HTML 진입점
│   └── src/
│       ├── main.jsx                   # React 진입점
│       ├── App.jsx                    # 라우팅 (HomePage / WorkflowPage)
│       ├── index.css                  # 전역 스타일 (색상 팔레트, 레이아웃)
│       ├── api.js                     # 백엔드 API 호출 함수 모음
│       ├── constants.js               # 앱 전역 상수
│       ├── utils.js                   # 공통 유틸 함수
│       │
│       ├── pages/
│       │   ├── HomePage.jsx           # 랜딩 페이지
│       │   └── WorkflowPage.jsx       # 메인 분석 인터페이스
│       │
│       └── components/
│           ├── TopBar.jsx             # 상단 바 (검색·정렬·내보내기·채용설정)
│           ├── Sidebar.jsx            # 좌측 지원자 리스트 (필터·상태·북마크)
│           ├── PortfolioArea.jsx      # 패널 컨테이너 (최대 4개)
│           ├── PortfolioPanel.jsx     # 단일 포트폴리오 패널 (섹션·하이라이트·메모)
│           ├── SettingsDrawer.jsx     # 우측 설정 드로어
│           ├── UploadModal.jsx        # 단일 파일 업로드 다이얼로그
│           ├── FolderUploadModal.jsx  # 폴더 일괄 업로드 다이얼로그
│           ├── JobConfigModal.jsx     # 채용 설정 통합 모달 (스펙·가중치·필터)
│           ├── Timeline.jsx           # 수평 타임라인 시각화
│           ├── DiffModal.jsx          # 두 포트폴리오 좌우 비교 모달
│           ├── SkillMatrix.jsx        # 지원자 × 스킬 매트릭스 그리드
│           └── Toaster.jsx            # 토스트 알림
│
├── 비정형화_포트폴리오/               # 테스트용 샘플 포트폴리오 PDF
├── ui-prototype/                      # UI 목업 파일
├── logo/                              # 프로젝트 로고 에셋
│
├── CLAUDE.md                          # Claude Code 작업 규칙 (프로젝트 지침)
├── 기획초안.md                        # 기획 초안 (UI 구성, 알고리즘 설명, 기능 목록)
├── 개발환경.md                        # 개발 환경 설정 가이드
├── style.md                           # 디자인 시스템 (색상·타이포·레이아웃 기준)
└── start.bat                          # Windows 실행 스크립트
```

---

## 주요 경로 요약

| 목적 | 경로 |
|------|------|
| API 엔드포인트 | `backend/routers/portfolios.py` |
| 알고리즘 구현 | `backend/services/algorithms/` |
| Solar LLM 연동 | `backend/services/solar.py` |
| PDF 파싱 | `backend/services/parser.py` |
| 메인 UI 화면 | `frontend/src/pages/WorkflowPage.jsx` |
| 포트폴리오 패널 | `frontend/src/components/PortfolioPanel.jsx` |
| API 클라이언트 | `frontend/src/api.js` |
| 전역 스타일 | `frontend/src/index.css` |
| 환경 변수 | `backend/.env` (`.env.example` 참고) |

# 프로젝트 개요

## 목적

면접 서류심사 담당자(채용 담당자, HR)의 편의를 위한 **개발자 포트폴리오 정형화·비교 웹 서비스**.

지원자가 제출한 포트폴리오(PDF 파일 또는 URL)를 Solar LLM으로 자동 파싱해 통일된 서식으로 변환하고, 필요 스펙 하이라이트·유사 문장 검출·키워드 검색 등을 통해 지원자 간 비교를 돕는다.

---

## 주요 해결 문제

| 기존 문제 | 본 서비스의 해결 방법 |
|-----------|----------------------|
| 포트폴리오 형식이 제각각이라 비교가 어렵다 | Solar LLM으로 공통 스키마로 파싱·정형화 |
| 기술명 표기가 사람마다 다르다 (py, 파이선, python) | Alias 해시맵 + Edit Distance로 동일 기술로 통합 |
| 특정 스펙을 갖춘 지원자를 빠르게 찾기 어렵다 | 해시 테이블 기반 O(1) 스펙 매칭 + BST 키워드 검색 |
| 포트폴리오 내용을 베끼거나 중복한 지원자를 구별하기 어렵다 | Rabin-Karp + LCS 유사 문장 검출 |
| 지원자 간 스킬·경력 점수를 수치화하기 어렵다 | LCS 기반 매칭 점수 + 커스텀 가중치 정렬 |

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| **Frontend** | React 18 + Vite 5 |
| **Markdown 렌더링** | react-markdown + remark-gfm + remark-breaks |
| **Backend** | Python 3.10+ + FastAPI + Uvicorn |
| **LLM** | Upstage Solar API (`solar-pro`, 32k 컨텍스트 제한) |
| **PDF 파싱** | pdfplumber |
| **HTTP 클라이언트** | httpx (비동기 Solar 호출), requests (PDF URL 다운로드) |
| **환경 변수** | python-dotenv |
| **데이터 저장** | session.json (백엔드 임시 세션), localStorage (프론트엔드 캐시) |
| **스타일링** | 순수 CSS (Pretendard 폰트, JetBrains Mono) |

---

## 실행 환경

- **OS**: Windows / macOS / Linux
- **Node.js**: 18+
- **Python**: 3.10+
- **포트**: Frontend 5173, Backend 8000
- **API 키**: `.env` 파일의 `SOLAR_API_KEY` 필수

---

## 시스템 구성도

```
브라우저 (React + Vite, :5173)
        │  /api/* → proxy
        ▼
FastAPI 서버 (:8000)
   ├── routers/portfolios.py   ← 포트폴리오 CRUD·분석·검색
   ├── routers/utils.py        ← 채용 설정 추출 헬퍼
   └── services/
        ├── solar.py           ← Upstage Solar API 호출·파싱·프롬프트
        ├── _solar_http.py     ← httpx 비동기 HTTP 래퍼
        ├── parser.py          ← PDF/텍스트 파싱 (pdfplumber)
        └── algorithms/        ← 핵심 알고리즘 8종 (파일별 분리)
```

---

## 팀 정보

- **팀명**: Algorithm Group 4
- **프로젝트명**: 개발자 포트폴리오 정형화·비교 시스템
- **최종 업데이트**: 2026-05-28

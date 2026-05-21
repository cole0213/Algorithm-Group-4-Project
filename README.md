# Portfolio Reviewer — 알고리즘 4조 프로젝트

면접 서류심사 편의를 위한 **개발자 포트폴리오 정형화·비교 웹 서비스**

PDF, URL, 텍스트 등 다양한 형식으로 제출된 포트폴리오를 Solar LLM으로 자동 파싱해 정형화하고,
스펙 매칭 분석·유사 문장 검출·키워드 검색 등을 제공합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18 + Vite (포트 5173) |
| Backend | Python 3 + FastAPI (포트 8000) |
| LLM | Upstage Solar API (`solar-pro`) |
| PDF 파싱 | pdfplumber |
| 데이터 저장 | session.json (서버) + localStorage (브라우저) |

---

## 알고리즘

| # | 알고리즘 | 역할 |
|---|----------|------|
| 1 | Solar LLM | 포트폴리오 파싱·정형화 |
| 2 | 해시 테이블 | 필요 스펙 O(1) 매칭·하이라이트 |
| 3 | Edit Distance (DP) | 기술명 오타·약어 허용 매칭 |
| 4 | LCS (DP) | 스펙 매칭 점수 산출 |
| 5 | 정렬 | 매칭률·경력·이름 기준 순위 정렬 |
| 6 | BST | 키워드 검색 (전체 / 패널 내부 모드) |
| 7 | 별칭 해시맵 + Edit Distance | 동의어·오타 통합 검색 (JS→JavaScript 등) |
| 8 | Rabin-Karp + LCS | 포트폴리오 간 유사 문장 검출 |

---

## 실행 방법

### 빠른 실행

```bash
start.bat
```

### 개별 실행

```bash
# 백엔드
cd Prototype/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 프론트엔드 (별도 터미널)
cd Prototype/frontend
npm install
npm run dev
```

### 환경 변수

`Prototype/backend/.env` 파일 생성:

```
SOLAR_API_KEY=your_api_key_here
```

`.env.example` 참고

---

## 주요 기능

- **포트폴리오 파싱** — PDF / MD / TXT / 텍스트 붙여넣기, Solar LLM 자동 정형화
- **스펙 매칭** — 필요 스펙 입력 시 해시 테이블 + LCS로 매칭률 계산 및 정렬
- **키워드 검색** — BST + 별칭 해시맵으로 동의어·오타 포함 통합 검색
- **유사 문장 검출** — Rabin-Karp + LCS로 포트폴리오 간 유사 구간 하이라이트
- **블라인드 심사** — 이름 가리기, 통과/보류/탈락 마킹, 메모 기능
- **공고 자동 파싱** — 채용 공고 붙여넣기 → Solar LLM이 필요 스펙 자동 추출
- **내보내기/불러오기** — 세션 데이터 JSON으로 저장 및 복원

---

## 문서

| 파일 | 설명 |
|------|------|
| `Prototype/기능_명세서.md` | 구현된 전체 기능 상세 명세 |
| `Prototype/기획서.md` | API 명세, 데이터 스키마, UI 구조 |
| `Prototype/INDEX.md` | 전체 파일 색인 |
| `Prototype/solar-설계.md` | Solar LLM 프롬프트 설계 |
| `Prototype/개발환경.md` | 디렉토리 구조, 설치 명령어 |
| `Prototype/런칭-가이드.md` | 서버 실행 및 배포 절차 |

---

## 팀원

알고리즘 수업 4조

# 개발 워크플로우

이 문서는 커밋 히스토리와 수정사항 기록을 토대로 프로젝트가 어떻게 진행되었는지 정리한다.

---

## 개발 사이클

```
수정필요사항.md 작성 (요구사항·버그 목록)
        ↓
구현 (코드 변경)
        ↓
수정사항.md 작성 (반영 결과 표 + 기술 변경 상세)
        ↓
git commit → push
```

요구사항은 `5월N일_수정필요사항.md`로 기록하고, 구현 완료 후 `5월N일_수정사항.md`에 항목별 완료 여부(✅ / ⚠️ / ⏭️)와 주요 변경 파일을 명시한다.

---

## 스프린트별 진행 내역

### Phase 0 — 초기 프로토타입 (5월 8일)

| 커밋 | 내용 |
|------|------|
| `add: prototypes` | React + FastAPI 기본 골격, `start.bat` 실행 스크립트 |
| `add: LLM 정형화` | Upstage Solar API 연동, PDF → JSON 파싱 파이프라인 구축 |

**완성된 기반 구조**
- `backend/`: FastAPI 앱 (`main.py`), 라우터(`routers/`), Solar 서비스(`services/solar.py`, `parser.py`)
- `frontend/`: React + Vite, 포트폴리오 패널 기본 레이아웃
- 알고리즘 8종 초기 구현 (`algorithms/` 하위 파일별 분리)

---

### Phase 1 — Prototype v2 (5월 20일)

| 커밋 | 내용 |
|------|------|
| `prototype-v2` | 기능 전반 재설계·재구현 |
| `docs: 기능 명세서, README, 발표자료 추가` | 기능 명세서, README, gitignore 정비 |
| `docs: 검증_리스트.md` | 기능 검증 체크리스트 작성 |

**주요 변경**
- 알고리즘 8종 통합 완료 (해시 테이블, Edit Distance, LCS, 정렬, BST, 별칭 검색, Rabin-Karp)
- 사이드바 지원자 목록 + 패널 최대 4개 수평 나열 구조 확립
- 유사 문장 하이라이트, 스킬 매칭 점수, 필터 기본 동작 구현

---

### Phase 2 — UI 개선 및 기능 강화 (5월 24일)

**요청 출처**: `5월24일_수정필요사항.md` (17개 항목)

| 커밋 | 내용 |
|------|------|
| `feat: 프론트엔드 UI 개선 및 포트폴리오 처리 기능 강화` | 수정필요사항 17개 항목 반영 |
| `merge: 원격 변경사항 병합` | AI 설정 추출·필터·폴더 업로드 브랜치 통합 |

**구현 항목 요약** (`5월25일_수정사항.md` §[5월 25일 작업 내역] 참고)

| 분류 | 항목 |
|------|------|
| 버그 수정 | AI 설정 자동 추출 오류, 2명 집중 비교 JSON 파싱 오류 |
| UI 개선 | 다크모드 색상 전면 보완, "분석 완료" → 5초 자동 소멸 토스트 |
| 기능 추가 | 폴더 일괄 업로드(`FolderUploadModal`), 가중치 텍스트 직접 입력, 홈페이지/워크플로우 페이지 분리 |
| 알고리즘 개선 | 유사 문장 팔레트 테마 방식 전환(흐리게/단일/컬러풀), 블라인드 심사 랜덤 가명 |
| 구조 정리 | 설정값 내보내기·불러오기 JSON 포함, 채용 설정 버전 속성 저장, 레거시 요약 배지 |
| 제외 | 구글 드라이브 연동 (OAuth 구성 필요로 제외) |

---

### Phase 3 — 가독성·설정·정확도 개선 (5월 25일)

**요청 출처**: `5월25일_수정필요사항.md` (3개 항목) + 자체 발견 버그 수정

| 커밋 | 내용 |
|------|------|
| `feat: 포트폴리오 뷰어 가독성·채용 설정·기술 스택 정확도 개선` | 수정필요사항 반영 + 코드 구조 정리 |
| `feat:` | 추가 세부 수정 |

**구현 항목 요약** (`5월25일_수정사항.md` §[5월 25일 후반 작업] 참고)

| 분류 | 항목 |
|------|------|
| 뷰어 가독성 (1-A) | 모든 섹션 공통 `SectionHeader` + `.section-body` 패턴 통일, 줄간격 정비 |
| 뷰어 가독성 (1-B) | 자체 정규식 파서 제거 → `react-markdown` + `remark-gfm` + `remark-breaks` 도입 |
| 뷰어 가독성 (1-C) | 가로 타임라인 섹션 신규 (`Timeline.jsx`) — 다양한 기간 표기 파싱, 겹침 트랙 분리 |
| 채용 설정 (2) | `JobConfigModal` 신규 — AI 추출·필요스펙·가중치·필터·추가 섹션 통합 관리 |
| 기술 스택 (3) | Solar 프롬프트에 추출 우선순위 명시, `_filter_skills` 후처리(블랙리스트 60+, 별칭 중복 제거, 25개 상한) |

**자체 발견 버그 수정** (`5월25일_수정사항.md` §1~5 참고)

| # | 버그 | 수정 위치 |
|---|------|-----------|
| 1 | Windows cp949 em 대시 `UnicodeEncodeError` → 업로드 500 오류 | `solar.py`, `portfolios.py` |
| 2 | Solar API URL·모델명·가중치·JSON 정규식 하드코딩 중복 | `solar.py`, `utils.py`, `portfolios.py` |
| 3 | `httpx` 미설치로 비교(diff) 엔드포인트 JSON 오류 | `requirements.txt` |
| 4 | 유사 문장 그룹 6 이상에서 색상 `undefined` | `api.js` |
| 5 | 유사 문장 윈도우 병합 누락·섹션 경계 초과·intro 파이프라인 누락 | `rabin_karp.py`, `PortfolioPanel.jsx` |

**코드 구조 정리** (`5월25일_수정사항.md` §2 참고)

- BST 공통 `_BSTBase` 추출 (ApplicantIndex / TextIndex)
- 공유 헬퍼: `algorithms/_common.py` (`merge_ranges`), `services/_solar_http.py`
- 프론트엔드 `constants.js` + `utils.js` — 전역 상수·유틸 중앙화

---

### Phase 4 — 기술 문서화 (5월 28일)

| 커밋 | 내용 |
|------|------|
| `docs: 기술 문서화` | `docs/` 폴더 신설 — overview, features, algorithms, directory, code_location |

**추가 문서**

- `docs/setup.md` — 설치·실행 명령어 (`개발환경.md`에서 이전)
- `docs/workflow.md` — 이 문서
- `INDEX.md` 재정비 — `docs/` 기준으로 전면 재작성
- 중복 파일 삭제: `기획서.md`, `기능_명세서.md`, `개발환경.md`

---

### Phase 5 — 코드 품질 및 문서 정리 (5월 28일)

| 작업 | 내용 |
|------|------|
| 미사용 import 제거 | `parser_svc`, `ApplicantIndex`, `os`(parser.py), `get_aliases` 4개 제거 후 모듈 전체 import 검증 |
| 문서 통합 | `기획서.md`, `기능_명세서.md`, `개발환경.md`, `feature_spec.md` 삭제 → `docs/` 로 완전 이전 |
| 문서 신설 | `docs/setup.md`, `docs/workflow.md`, `docs/backlog.md`, `docs/deploy.md`, `docs/history/` |
| 문서 삭제 | `SolarLLMAPI사용메뉴얼.md`(잘못된 URL), `solar-설계.md`(구현 완료), `개선사항_요청.md`(초기 회의록) |
| 문서 보완 | `CLAUDE.md` 문서 구조 갱신, `docs/directory.md`에 누락 파일 추가, `docs/code_location.md`에 `_solar_http.py`·`_common.py` 추가 |

---

### Phase 6 — 알고리즘·API·문서 보완 (5월 30일)

| 커밋 | 내용 |
|------|------|
| `docs: 코드 품질 개선 및 문서 구조 정비` → `4999786` | rabin_karp 그룹 번호 개선, solar.py 재시도 백오프, 포트폴리오 요약 API 추가, 문서 보완 |

**주요 변경**

| 파일 | 변경 내용 |
|------|-----------|
| `rabin_karp.py` | 한 쌍에서 독립적인 유사 구간이 여러 개일 때 각각 다른 그룹 번호 할당 (`n_groups = max(len(merged_a), len(merged_b))`) |
| `solar.py` | `_call_solar_api()` 재시도 백오프 추가 (429 rate limit 지수 백오프, 5xx 1회 재시도), `SolarAPIError` 예외 클래스 추가 |
| `portfolios.py` | `POST /portfolios/summarize-all`, `POST /portfolios/{id}/summarize` 엔드포인트 신규 추가 — 채용 설정 기준 포트폴리오 AI 요약 |
| `utils.py` | `extract-specs` 엔드포인트 소폭 개선 |
| `docs/algorithms.md` | Rabin-Karp 흐름 설명 보완 (독립 구간별 그룹 번호 부여 명시) |
| `docs/code_location.md` | `SOLAR_API_KEY` / `UPSTAGE_API_KEY` 대체 사용 가능 주석 추가 |
| `README.md` | `SOLAR_MODEL` 환경 변수 설명 및 `UPSTAGE_API_KEY` 대체 사용 안내 추가 |

---

## 미완료 / 보류 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 구글 드라이브 연동 | ⏭️ 제외 | OAuth 구성 필요 |
| 채용 설정 기준 재요약 API | ⚠️ 부분 완료 | `solar.py::summarize_text()` 구현됨, 백엔드 엔드포인트·프론트엔드 UI 미구현 |
| 이모지 → 실제 아이콘 이미지 교체 | ⚠️ 대기 | `assets/icon-list.txt`에 이미지 목록 명시, 이미지 파일 직접 추가 필요 |

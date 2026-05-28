# 알고리즘 명세

각 알고리즘의 역할·구현 방식·시간복잡도와 **실제 코드 위치(파일 경로:줄)**를 함께 정리한다.

---

## 목록 요약

| # | 알고리즘 | 구현 파일 | 시간복잡도 | 공간복잡도 |
|---|----------|-----------|-----------|-----------|
| 1 | Solar LLM | `services/solar.py`, `services/parser.py` | API 의존 | — |
| 2 | 해시 테이블 | `algorithms/hash_table.py` | O(1) 평균 | O(n) |
| 3 | Edit Distance | `algorithms/edit_distance.py` | O(m×n) | O(m×n) |
| 4 | LCS | `algorithms/lcs.py` | O(m×n) | O(n) |
| 5 | 정렬 | `algorithms/sort.py` | O(n log n) | O(n) |
| 6 | BST | `algorithms/bst.py` | O(log n) 평균 | O(n) |
| 7 | 별칭 해시맵 + Edit Distance | `algorithms/alias_map.py`, `alias_search.py` | O(k×m) | O(k) |
| 8 | Rabin-Karp + LCS | `algorithms/rabin_karp.py` | O(n+m) 평균 | O(n) |

경로 공통 prefix: `backend/services/`

---

## 알고리즘 #1 — Solar LLM 포트폴리오 파싱

**역할**: PDF·텍스트 원문을 Upstage Solar API(`solar-pro`)에 전달해 공통 JSON 스키마로 변환한다.

**흐름**:
1. `services/parser.py` — pdfplumber로 PDF에서 텍스트 추출
2. `services/solar.py` — 추출 텍스트를 Solar 프롬프트로 포장해 API 호출
3. API 응답(JSON)을 포트폴리오 객체로 파싱해 반환

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| PDF 텍스트 추출 (`extract_pdf_text`) | `backend/services/parser.py` | — |
| Solar API 호출 및 파싱 (`parse_text`) | `backend/services/solar.py` | — |
| 업로드 엔드포인트에서 파싱 호출 | `backend/routers/portfolios.py` | L262 |
| 재분석 엔드포인트에서 파싱 호출 | `backend/routers/portfolios.py` | L355 |

**제약**: Solar 컨텍스트 한계 32k 토큰 → 초과 시 분할 처리, `_truncated` 플래그 설정

---

## 알고리즘 #2 — 해시 테이블 스펙 매칭

**역할**: 채용 담당자가 입력한 필요 스펙을 해시셋에 저장하고 지원자 스킬과 O(1)로 매칭한다.

**핵심 구현**: Python `set` (내부적으로 해시 테이블)에 정규화된 스펙을 저장 후 조회

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| `class SpecMatcher` 선언 | `backend/services/algorithms/hash_table.py` | L10 |
| 해시셋 `_required: set[str]` 초기화 | `backend/services/algorithms/hash_table.py` | L19 |
| 스펙 정규화 후 해시셋 삽입 루프 | `backend/services/algorithms/hash_table.py` | L23–L26 |
| `is_required()` — O(1) 조회 | `backend/services/algorithms/hash_table.py` | L30–L32 |
| `match_skills()` — `{ 기술명: bool }` 반환 | `backend/services/algorithms/hash_table.py` | L34–L39 |
| `matched_count()` — 일치 개수 반환 | `backend/services/algorithms/hash_table.py` | L41–L43 |
| 라우터에서 import | `backend/routers/portfolios.py` | L99 |
| `SpecMatcher` 인스턴스 생성 | `backend/routers/portfolios.py` | L577 |
| `match_skills()` 호출 (하이라이트용) | `backend/routers/portfolios.py` | L592 |

**점화식**: Python `set.__contains__` → 해시 계산 후 버킷 탐색 → 평균 O(1)

---

## 알고리즘 #3 — Edit Distance (Wagner-Fischer DP)

**역할**: `파이선`, `파이썬`, `Python` 등 표기가 다른 기술명을 같은 기술로 인식한다.

**점화식**:
```
dp[i][j] = dp[i-1][j-1]                       (a[i-1] == b[j-1], 동일 문자)
dp[i][j] = 1 + min(dp[i-1][j],   # 삭제
                   dp[i][j-1],   # 삽입
                   dp[i-1][j-1]) # 대체       (a[i-1] != b[j-1])
```

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| `edit_distance(a, b)` 함수 선언 | `backend/services/algorithms/edit_distance.py` | L9 |
| DP 테이블 `dp` 초기화 | `backend/services/algorithms/edit_distance.py` | L24 |
| 베이스케이스 (빈 문자열 ↔ 길이 k) | `backend/services/algorithms/edit_distance.py` | L27–L30 |
| 점화식 이중 루프 | `backend/services/algorithms/edit_distance.py` | L32–L41 |
| `is_similar(a, b, threshold=2)` | `backend/services/algorithms/edit_distance.py` | L46–L48 |
| alias_search에서 import | `backend/services/algorithms/alias_search.py` | L8 |
| 오타 허용 비교 호출 | `backend/services/algorithms/alias_search.py` | L34 |

**시간**: O(|a|×|b|) / **공간**: O(|a|×|b|) (가독성 우선, 롤링 배열로 O(|b|) 최적화 가능)

---

## 알고리즘 #4 — LCS (Longest Common Subsequence)

**역할**: 필요 스펙 목록과 지원자 스킬 목록의 최장 공통 부분 수열 길이로 매칭 점수를 산출한다.

**점화식** (롤링 배열):
```
curr[j] = prev[j-1] + 1              (a[i-1] == b[j-1])
curr[j] = max(prev[j], curr[j-1])    (a[i-1] != b[j-1])
```

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| `lcs_length(seq_a, seq_b)` 함수 선언 | `backend/services/algorithms/lcs.py` | L10 |
| 정규화 + 정렬 전처리 | `backend/services/algorithms/lcs.py` | L26–L27 |
| 롤링 배열 `prev`, `curr` 초기화 | `backend/services/algorithms/lcs.py` | L31–L32 |
| 점화식 이중 루프 | `backend/services/algorithms/lcs.py` | L34–L40 |
| `match_score(required, applicant)` — 0~100% 반환 | `backend/services/algorithms/lcs.py` | L45–L58 |
| `matched_skills()` — 일치 스킬 목록 반환 | `backend/services/algorithms/lcs.py` | L61–L68 |
| 라우터에서 import | `backend/routers/portfolios.py` | L100 |
| `match_score()` 호출 (스킬 점수 산출) | `backend/routers/portfolios.py` | L591 |
| `matched_skills()` 호출 | `backend/routers/portfolios.py` | L593 |
| rabin_karp에서 LCS 검증용 import | `backend/services/algorithms/rabin_karp.py` | L10 |
| Rabin-Karp 충돌 구간 LCS 검증 호출 | `backend/services/algorithms/rabin_karp.py` | L208 |

**시간**: O(m×n) / **공간**: O(n) (롤링 배열)

---

## 알고리즘 #5 — 정렬 (Timsort)

**역할**: 매칭률·경력·이름 기준으로 지원자 목록을 정렬한다.

**구현**: Python 내장 `sorted()` — Tim Sort 기반 (최악 O(n log n) 보장)

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| `sort_applicants(applicants, key)` 함수 선언 | `backend/services/algorithms/sort.py` | L10 |
| `"match"` 기준 — match_score 내림차순 | `backend/services/algorithms/sort.py` | L24–L25 |
| `"career"` 기준 — career_years 내림차순 | `backend/services/algorithms/sort.py` | L26–L27 |
| `"name"` 기준 — 이름 오름차순 | `backend/services/algorithms/sort.py` | L28–L29 |
| 라우터에서 import | `backend/routers/portfolios.py` | L101 |
| `sort_applicants()` 호출 | `backend/routers/portfolios.py` | L625 |

**시간**: O(n log n) 평균·최악 / **공간**: O(n)

---

## 알고리즘 #6 — BST 키워드 검색

**역할**: 키워드로 포트폴리오를 검색한다. 전체(cross) 검색과 패널 내(intra) 검색 두 모드를 BST로 구현한다.

**두 가지 인덱스**:

| 클래스 | 모드 | 기능 |
|--------|------|------|
| `ApplicantIndex` | cross | 전체 지원자 대상 키워드 → 포트폴리오 ID 목록 |
| `TextIndex` | intra | 단일 포트폴리오 내 키워드 토큰 위치 목록 |

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| BST 노드 `_Node` dataclass | `backend/services/algorithms/bst.py` | L44 |
| 공통 베이스 `_BSTBase` 선언 | `backend/services/algorithms/bst.py` | L54 |
| `_find()` — 재귀 BST 탐색 | `backend/services/algorithms/bst.py` | L60–L65 |
| `ApplicantIndex` 클래스 선언 | `backend/services/algorithms/bst.py` | L70 |
| `insert()` — 키워드 삽입 (O(log n)) | `backend/services/algorithms/bst.py` | L77–L91 |
| `search()` — 지원자 ID 목록 반환 | `backend/services/algorithms/bst.py` | L94–L98 |
| `build()` — 스킬·이름·경력 인덱싱 | `backend/services/algorithms/bst.py` | L101–L122 |
| `TextIndex` 클래스 선언 | `backend/services/algorithms/bst.py` | L127 |
| `_build()` — 단어 토큰 위치 인덱싱 | `backend/services/algorithms/bst.py` | L137–L142 |
| `TextIndex.search()` — 위치 목록 반환 | `backend/services/algorithms/bst.py` | L155–L159 |
| `search_context()` — ±5단어 스니펫 반환 | `backend/services/algorithms/bst.py` | L161–L171 |
| BST 캐시 무효화 `invalidate_cache()` | `backend/services/algorithms/bst.py` | L19–L23 |
| `get_or_build_bst()` — 캐시 히트 또는 재빌드 | `backend/services/algorithms/bst.py` | L26–L38 |
| 라우터에서 import | `backend/routers/portfolios.py` | L102 |
| cross 검색: `get_or_build_bst()` 호출 | `backend/routers/portfolios.py` | L652 |
| cross 검색: `idx.search(q)` 호출 | `backend/routers/portfolios.py` | L653 |
| intra 검색: `TextIndex(full_text)` 생성 | `backend/routers/portfolios.py` | L667 |
| intra 검색: `search_context(q)` 호출 | `backend/routers/portfolios.py` | L668 |

**시간**: 삽입·검색 O(log n) 평균, O(n) 최악 (비균형 트리)

---

## 알고리즘 #7 — 별칭 해시맵 + Edit Distance 통합 검색

**역할**: `py`, `파이선`, `파이썬`을 입력해도 `Python` 관련 결과를 모두 반환한다.

### #7a — 별칭 해시맵 (alias_map.py)

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| `ALIAS_MAP` 정의 — 정규 키 → 별칭 목록 dict | `backend/services/algorithms/alias_map.py` | L11 |
| 언어 섹션 (python, javascript, …) | `backend/services/algorithms/alias_map.py` | L13–L62 |
| 프레임워크 섹션 (react, vue, django, …) | `backend/services/algorithms/alias_map.py` | L64–L107 |
| DB 섹션 (mysql, postgresql, …) | `backend/services/algorithms/alias_map.py` | L109–L131 |
| 클라우드/인프라 섹션 (aws, docker, k8s, …) | `backend/services/algorithms/alias_map.py` | L133–L151 |
| `REVERSE_MAP` — 별칭 → 정규 키 역방향 인덱스 | `backend/services/algorithms/alias_map.py` | L191–L195 |
| `normalize(term)` — 소문자 정규 키 변환 | `backend/services/algorithms/alias_map.py` | L198–L200 |
| `get_aliases(term)` — 전체 별칭 목록 반환 | `backend/services/algorithms/alias_map.py` | L203–L206 |

### #7b — 별칭 확장 + 퍼지 매칭 (alias_search.py)

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| 오타 허용 임계값 `_TYPO_THRESHOLD = 2` | `backend/services/algorithms/alias_search.py` | L12 |
| `expand_query(query)` — 동의어 + 오타 목록 생성 | `backend/services/algorithms/alias_search.py` | L15–L37 |
| alias_map O(1) 조회 | `backend/services/algorithms/alias_search.py` | L28 |
| 전체 별칭과 edit_distance 비교 (오타 흡수) | `backend/services/algorithms/alias_search.py` | L32–L35 |
| `portfolio_matches_query(portfolio, query)` | `backend/services/algorithms/alias_search.py` | L40–L71 |
| `highlight_positions(text, query)` — (시작, 끝) 목록 | `backend/services/algorithms/alias_search.py` | L74–L93 |
| 라우터에서 import | `backend/routers/portfolios.py` | L103 |
| cross 검색: `portfolio_matches_query()` 호출 | `backend/routers/portfolios.py` | L649 |
| intra 검색: `highlight_positions()` 호출 | `backend/routers/portfolios.py` | L666 |

**시간**: O(k×m) (k = 총 별칭 수, m = 검색어 길이)

---

## 알고리즘 #8 — Rabin-Karp + LCS 유사 문장 검출

**역할**: 두 포트폴리오 사이에서 유사하게 작성된 문장 구간을 찾아 색상 그룹으로 표시한다.

**흐름**:
```
텍스트 토크나이즈 (_tokenize)
        ↓
슬라이딩 윈도우 롤링 해시 (_rolling_hashes)  ← Rabin-Karp
        ↓
두 포트폴리오 해시 충돌 구간 수집
        ↓
충돌 구간 LCS 유사도 검증 (lcs_length ≥ 70%)  ← LCS (#4 재활용)
        ↓
인접 구간 병합 (_merge_ranges → merge_ranges)
        ↓
섹션 경계로 분할 (_section_spans)  ← 오검출 방지
        ↓
병합된 구간별 색상 그룹 번호 부여 → SimilarSpan 목록
(한 쌍에서 독립적인 유사 구간이 여러 개면 각각 다른 그룹 번호 할당)
```

**롤링 해시 공식**:
```
hash = (w₁×31⁴ + w₂×31³ + w₃×31² + w₄×31 + w₅) mod (2³¹−1)
슬라이딩: cur = (cur − wh[i−1] × 31^(window−1) + wh[i+window−1]) mod P
```

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| 상수: `_BASE=31`, `_MOD=2³¹−1`, `_WORD_WINDOW=5` | `backend/services/algorithms/rabin_karp.py` | L17–L20 |
| 그룹 색상 `_GROUP_COLORS` (6색) | `backend/services/algorithms/rabin_karp.py` | L23–L30 |
| `SimilarSpan` dataclass | `backend/services/algorithms/rabin_karp.py` | L36–L43 |
| `_tokenize(text)` — 단어·문자위치 목록 | `backend/services/algorithms/rabin_karp.py` | L48–L56 |
| `_hash_word(w)` — 단어 단위 해시 | `backend/services/algorithms/rabin_karp.py` | L59–L63 |
| `_rolling_hashes(words, window)` — 슬라이딩 해시 | `backend/services/algorithms/rabin_karp.py` | L66–L91 |
| 초기 윈도우 해시 계산 | `backend/services/algorithms/rabin_karp.py` | L82–L84 |
| 롤링 업데이트 (슬라이딩) | `backend/services/algorithms/rabin_karp.py` | L86–L90 |
| `_build_sections(portfolio)` — 섹션 분리·경계 계산 | `backend/services/algorithms/rabin_karp.py` | L105–L125 |
| `_section_spans(merged, sections, …)` — 섹션 경계 분할 | `backend/services/algorithms/rabin_karp.py` | L128–L156 |
| `detect_similar(portfolios)` — 메인 검출 함수 | `backend/services/algorithms/rabin_karp.py` | L159–L220 |
| 해시 충돌 → LCS 검증 (70% 이상만 통과) | `backend/services/algorithms/rabin_karp.py` | L208–L210 |
| `detect_similar_response()` — API 응답 직렬화 | `backend/services/algorithms/rabin_karp.py` | L223–L234 |
| 라우터에서 import | `backend/routers/portfolios.py` | L104 |
| `detect_similar_response()` 호출 | `backend/routers/portfolios.py` | L689 |

**시간**: O(n+m) 평균 (해싱), O(n×m) 최악 (LCS 검증)

---

## 공통 유틸 — merge_ranges

**역할**: Rabin-Karp·alias_search 모두에서 겹치거나 인접한 구간을 병합할 때 사용한다.

**코드 위치**:

| 역할 | 파일 | 줄 |
|------|------|----|
| `merge_ranges(intervals)` 함수 | `backend/services/algorithms/_common.py` | L7–L25 |
| 정렬 후 선형 스캔 병합 | `backend/services/algorithms/_common.py` | L18–L24 |
| rabin_karp에서 import | `backend/services/algorithms/rabin_karp.py` | L11 |
| alias_search에서 import | `backend/services/algorithms/alias_search.py` | L9 |
| `_merge_ranges()` 래퍼 (rabin_karp 내부) | `backend/services/algorithms/rabin_karp.py` | L96–L98 |
| highlight_positions에서 구간 병합 호출 | `backend/services/algorithms/alias_search.py` | L93 |

---

## 알고리즘 간 호출 관계

```
routers/portfolios.py
  │
  ├─ POST /analyze (L567)
  │     ├─ SpecMatcher (hash_table.py:L10)     → is_required O(1)
  │     ├─ match_score (lcs.py:L45)            → LCS 매칭 점수
  │     └─ sort_applicants (sort.py:L10)       → Timsort 정렬
  │
  ├─ GET /search (L633)
  │     ├─ portfolio_matches_query             → expand_query (alias_search.py:L15)
  │     │     └─ edit_distance (edit_distance.py:L9)   오타 흡수
  │     ├─ get_or_build_bst → ApplicantIndex.search    cross BST (bst.py:L94)
  │     └─ TextIndex + search_context                  intra BST (bst.py:L161)
  │
  └─ GET /similar (L681)
        └─ detect_similar_response (rabin_karp.py:L223)
              ├─ _rolling_hashes (rabin_karp.py:L66)  Rabin-Karp
              └─ lcs_length (lcs.py:L10)              LCS 검증
```

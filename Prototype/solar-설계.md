# Solar LLM 통합 설계서

> 최종 수정: GAN 환각 검토 반영 (d,g hard — 지원서·포트폴리오 도메인)

## 개요

모든 포트폴리오 파일 형식(PDF / MD / TXT / 텍스트 직접 입력)을 Solar LLM으로 통일 처리하여
정형화 품질을 높이고, 직군별 추출 최적화를 제공한다.

**핵심 원칙**: 이 시스템은 채용 서류를 다룬다. LLM이 없는 내용을 만들어내는 것은
지원자 역량의 허위 기재로 이어진다. **원문에 없는 내용은 절대 생성하지 않는다.**

---

## 1. ✅ 완료 — API 엔드포인트 수정

~~현재 코드의 엔드포인트가 잘못되어 Solar LLM이 실제로 호출되지 않고 있다.~~

| 구분 | 값 |
|------|----|
| ~~수정 전 (오류)~~ | ~~`https://api.upstage.ai/v1/solar/chat/completions`~~ |
| 수정 후 (적용됨) | `https://api.upstage.ai/v1/chat/completions` |

파일: `backend/services/solar.py` — 수정 완료

---

## 2. MD 파일 처리 변경

### 현재

`.md` 파일은 Solar LLM을 우회하여 자체 MD 파서로 처리한다.
MD 포맷도 사용자마다 구조가 제각각이어서 자체 파서로는 정형화 품질을 보장할 수 없다.

### 변경

모든 파일 형식이 동일한 경로로 진입한다.

```
업로드 (PDF / MD / TXT / 텍스트)
  → raw_text 추출
  → 8000자 초과 시 _truncated = True 플래그 설정
  → Solar LLM 파싱 (position 파라미터 포함)
  → 실패 시: basic_parser 폴백
  → 결과 검증 및 누락 필드 보완
  → _truncated 플래그 포트폴리오에 저장
  → 캐시 저장 + session.json 자동저장
```

파일: `backend/routers/portfolios.py` — MD 분기 제거

---

## 3. 응답 형식 — JSON 스키마

Solar LLM의 출력 스키마는 고정한다.
포지션별 처리를 위해 스키마를 변경하지 않고 프롬프트 지침만 달리한다.

```json
{
  "name":         "string",
  "email":        "string",
  "github":       "string",
  "career_years": 0,
  "education":    "string",
  "skills":       ["string"],
  "intro":        "string",
  "projects": [
    {
      "name":   "string",
      "period": "string",
      "role":   "string",
      "stack":  "string",
      "desc":   "string"
    }
  ],
  "awards": ["string"]
}
```

### 필드별 기본값 규칙

| 필드 | 타입 | 없을 때 기본값 |
|------|------|--------------|
| name | string | "" |
| email | string | "" |
| github | string | "" |
| career_years | integer | 0 |
| education | string | "" |
| skills | string[] | [] |
| intro | string | "" |
| projects | object[] | [] |
| projects[].name | string | "" |
| projects[].period | string | "" |
| projects[].role | string | "" |
| projects[].stack | string | "" |
| projects[].desc | string | "" |
| awards | string[] | [] |

---

## 4. 프롬프트 설계

### 4-1. 출력 형식 제한

| 제한 | 이유 |
|------|------|
| JSON만 출력 — 설명 문장 절대 금지 | 파싱 오류 방지 |
| 마크다운 코드블럭 사용 금지 | 정규식 추출 방식으로 통일 |
| null 사용 금지 — 반드시 빈값·빈배열·0 | 하위 코드 `.get()` 안전성 |
| 스키마에 없는 필드 추가 금지 | 하위 코드 오염 방지 |

### 4-2. 필드별 추출 제한

| 필드 | 제한 |
|------|------|
| career_years | 원문에 명시된 숫자만 사용. 날짜로부터 계산·추론 금지. 명시 없으면 0 |
| skills | 원래 표기 보존 (React O, react X). 버전 제거 (React 18 → React). 중복 제거. 원문에 보유 기술로 명확히 언급된 경우에만 포함 |
| intro | 원문 텍스트를 그대로 복사. 단어 하나도 바꾸지 않음 |
| projects[].desc | 원문 텍스트를 그대로 복사. 단어 하나도 바꾸지 않음 |
| projects[].stack | 쉼표 구분 단일 문자열 (배열 사용 금지) |

### 4-3. 환각 방지 핵심 제한

채용 서류 특성상 다음 제한을 프롬프트에 명시한다.

**원칙: 부정 지시보다 긍정 지시가 더 효과적**
"~하지 마십시오" 대신 "~인 경우에만 포함하십시오" 형식을 우선 사용한다.

| 항목 | 프롬프트 문구 방식 |
|------|-----------------|
| 수치 | 부정 + 긍정 병용: "원문에 수치가 있으면 그대로 복사하십시오. 없으면 빈값." |
| career_years | 긍정: "원문에 숫자가 있으면 그 숫자만 사용하십시오. 없으면 0." |
| skills | 긍정: "원문에 보유 기술로 명확히 언급된 경우에만 포함하십시오." |
| intro·desc | 긍정: "원문 텍스트를 그대로 복사하십시오. 단어 하나도 바꾸지 마십시오." |
| 내용 보완 | 긍정: "원문에서 찾을 수 없는 내용은 반드시 빈값으로 두십시오." |

### 4-4. 한국어 문서 처리 제한

- 기술명은 영어 원표기 유지 (파이썬 → Python, 리액트 → React)
- 인명·학교명·회사명은 원문 그대로 보존
- 번역·의역 금지

### 4-5. 프롬프트 구조

```
[역할]
당신은 개발자 포트폴리오 파싱 전문가입니다.
이 문서는 채용 판단에 사용됩니다.

[출력 규칙]
- 유효한 JSON만 출력합니다. 설명 문장, 마크다운 코드블럭 사용 금지.
- null 사용 금지. 값이 없으면 "" 또는 [] 또는 0을 사용합니다.
- 스키마에 없는 필드를 추가하지 않습니다.

[원문 준수 규칙 — 필수]
- 원문에서 찾을 수 있는 내용만 포함하십시오. 찾을 수 없으면 반드시 빈값으로 두십시오.
- intro와 desc는 원문 텍스트를 그대로 복사하십시오. 단어 하나도 바꾸지 마십시오.
- career_years: 원문에 숫자가 있으면 그 숫자만 사용하십시오. 없으면 0.
- skills: 원문에 보유 기술로 명확히 언급된 경우에만 포함하십시오.

[부정적 예시 — 이렇게 하지 마십시오]
예시 1) 원문: "React를 배우고 싶다"
  잘못된 출력: skills: ["React"]
  올바른 출력: skills: []

예시 2) 원문: "응답 속도를 개선했습니다"
  잘못된 출력: desc: "응답 속도를 30% 개선했습니다"
  올바른 출력: desc: "응답 속도를 개선했습니다"

예시 3) 원문: "2018년 입사, 현재 재직 중"
  잘못된 출력: career_years: 6
  올바른 출력: career_years: 0  (원문에 연수가 명시되지 않음)

[스키마]
(위 JSON 스키마 삽입)

[필드 규칙]
- career_years: 원문 명시 정수만. 없으면 0. 날짜 계산 금지.
- skills: 원래 표기 보존 (파이썬 → Python), 버전 제거, 중복 제거.
          보유·사용 기술로 명확히 언급된 것만 포함.
- intro, desc: 원문 그대로 복사. 요약·의역·보완 금지.
- projects[].stack: 쉼표 구분 문자열 (배열 금지)

[포지션별 추가 지침]
(아래 4-6항 참고)
```

### 4-6. 포지션별 추가 지침

스키마 변경 없음. 수치 유도 지침 완전 제거. 추출 우선순위만 안내한다.

#### 일반 (기본)
추가 지침 없음.

#### 프론트엔드
```
- skills: CSS 프레임워크, 번들러, 상태관리 라이브러리를 원문에서 빠짐없이 추출하십시오.
- desc:   원문 텍스트를 그대로 복사하십시오. UI·프론트엔드 관련 내용이 있으면 누락 없이 포함하십시오.
```

#### 백엔드
```
- skills: DB, ORM, 서버 프레임워크, 인프라 도구를 원문에서 빠짐없이 추출하십시오.
- desc:   원문 텍스트를 그대로 복사하십시오. 서버·인프라 관련 내용이 있으면 누락 없이 포함하십시오.
```

#### 데이터/AI
```
- skills: ML·DL 프레임워크, 데이터 파이프라인 도구를 원문에서 빠짐없이 추출하십시오.
- awards: 논문·학회 발표·대회 실적이 원문에 있으면 포함하십시오. 없으면 빈 배열.
```

---

## 5. 응답 후처리 — 파싱 및 검증

### 5-1. JSON 추출

`removeprefix` 방식 제거. 정규식으로 JSON 블럭을 안전하게 추출한다.

```python
import re

match = re.search(r'\{[\s\S]*\}', content)
if not match:
    raise ValueError("JSON 블럭 없음")
result = json.loads(match.group())
```

### 5-2. 타입 강제 변환

```python
# career_years: 문자열이면 숫자 추출
cy = result.get("career_years", 0)
if isinstance(cy, str):
    m = re.search(r'\d+', cy)
    result["career_years"] = int(m.group()) if m else 0

# 배열 필드: None이면 빈 배열로
for key in ("skills", "projects", "awards"):
    if not isinstance(result.get(key), list):
        result[key] = []

# 문자열 필드: None이면 빈 문자열로
for key in ("name", "email", "github", "education", "intro"):
    if not isinstance(result.get(key), str):
        result[key] = ""
```

### 5-3. 스키마 외 필드 제거

```python
ALLOWED_KEYS = {
    "name", "email", "github", "career_years",
    "education", "skills", "intro", "projects", "awards"
}
result = {k: v for k, v in result.items() if k in ALLOWED_KEYS}
```

### 5-4. 절단 플래그 (신규)

```python
truncated = len(raw_text) > _MAX_CHARS
result["_truncated"] = truncated
```

UI에서 `_truncated == True`이면 패널 상단에 경고 표시:
> ⚠ 원문이 길어 일부만 처리되었습니다. 원본 보기로 전체 내용을 확인하세요.

---

## 6. UI — AI 파싱 결과 고지 (신규)

채용 서류에서 LLM 환각으로 인한 오판을 방지하기 위해 다음 고지를 표시한다.

### 6-1. UploadModal — Solar 디버그 패널 하단

Solar 사용 여부와 무관하게 항상 표시:

```
AI 파싱 결과는 원본 포트폴리오와 대조 확인이 필요합니다.
```

### 6-2. PortfolioPanel — Solar로 파싱된 포트폴리오

`_solar_used == True`인 패널에 표시 (작은 레이블):

```
AI 파싱
```

클릭 시 툴팁: "Solar LLM으로 파싱된 결과입니다. 원본 보기로 내용을 확인하세요."

---

## 7. 데이터 관리 — session.json 자동저장

### 목적

현재 `_portfolio_cache`는 메모리 한정으로 서버 재시작 시 데이터가 소실된다.
`session.json`으로 자동저장하여 영속성을 확보한다.

### 저장 경로

```
backend/session.json
```

### 저장 트리거

| 이벤트 | 엔드포인트 |
|--------|-----------|
| 포트폴리오 추가 | POST /api/portfolios/add |
| 포트폴리오 삭제 | DELETE /api/portfolios/{id} |
| 포트폴리오 임포트 | POST /api/portfolios/import |

### 로드 우선순위

```
session.json 존재?
  YES → session.json 로드
  NO  → portfolios/ 디렉터리 파싱 (기존 방식)
```

### gitignore 추가

```
session.json
```

---

## 8. UI 변경 — 포지션 선택 (UploadModal)

```
포지션 유형
  ( ) 일반       ( ) 프론트엔드
  ( ) 백엔드     ( ) 데이터/AI
```

- 기본값: 일반
- 선택값은 `position` 필드로 API에 전달 (FormData)

파일: `frontend/src/components/UploadModal.jsx`, `frontend/src/api.js`

---

## 9. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | API 엔드포인트 수정 | solar.py |
| 2 | JSON 추출 방식 교체 (정규식) | solar.py |
| 3 | 환각 방지 제한 프롬프트 추가 | solar.py |
| 4 | 포지션별 프롬프트 분기 추가 | solar.py |
| 5 | MD 분기 제거, position·truncated 처리 | portfolios.py |
| 6 | session.json 자동저장 | portfolios.py |
| 7 | 포지션 선택 UI + AI 파싱 고지 | UploadModal.jsx, PortfolioPanel.jsx, api.js |

---

## 10. 미결 사항

| 항목 | 내용 |
|------|------|
| ~~엔드포인트 정확성~~ | ~~Upstage 공식 문서 확인 후 최종 결정~~ **✅ 완료** (`/v1/chat/completions`) |
| 토큰 한도 | 현재 8,000자 제한 — 긴 문서 절단 시 ⚠ 경고로 대응. 청킹은 추후 검토 |
| 환각 감지 자동화 | 원문 대조 자동 검증은 현재 미구현 — 사용자 수동 확인으로 대체 |
| 폴백 고지 | basic_parser 폴백 시 UI에 명시적 표시 필요 여부 추가 검토 |

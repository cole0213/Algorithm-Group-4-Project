# solar.py — Solar LLM API 연동
# 모든 포트폴리오 파일 형식(PDF/MD/TXT/텍스트)을 Solar LLM으로 파싱
#
# API 키 없을 시 NotConfiguredError 발생 → 라우터에서 처리

from __future__ import annotations
import os
import re
import json
import time
import requests
from dotenv import load_dotenv
from services.parser import clean_name

load_dotenv()

_API_KEY   = os.getenv("SOLAR_API_KEY", "")
_BASE_URL  = "https://api.upstage.ai/v1"
CHAT_URL   = f"{_BASE_URL}/chat/completions"
MODEL      = os.getenv("SOLARMODEL", "solar-pro")
_MAX_CHARS = 30000  # solar-pro 32k 토큰 기준 (한국어 3–4자/토큰 → 약 28k 토큰 사용 가능)

_JSON_RE = re.compile(r"\{[\s\S]*\}")  # LLM 응답에서 JSON 객체 추출용

# 섹션 경계 감지 정규식 — 마크다운 헤더·장식 구분선·한국어/영어 섹션 키워드 인식
_SECTION_HEADER_RE = re.compile(
    r"(?m)^[ \t]*(?:"
    r"#{1,3}[ \t]+\S[^\n]*"                              # ## 마크다운 헤더
    r"|[━─]{4,}[^\n]*"                                   # ━━━━ / ──── 장식 구분선
    r"|(?:기본\s*정보|개인\s*정보|연락처"
    r"|기술\s*스택|보유\s*기술"
    r"|자기\s*소개|소개글?"
    r"|프로젝트(?:\s*경험)?|주요\s*프로젝트"
    r"|경력\s*사항?|업무\s*경험"
    r"|수상\s*경력?|자격증|교육\s*사항?|학력"
    r"|활동|기타\s*활동)(?:\s*및[^\n]*)?[ \t]*$"         # 한국어 섹션 키워드
    r"|(?:ABOUT|SUMMARY|EXPERIENCE|WORK\s+HISTORY"
    r"|(?:TECHNICAL\s+)?SKILLS?|(?:NOTABLE\s+)?PROJECTS?"
    r"|EDUCATION(?:\s+&\s+ETC)?|CERTIFICATIONS?"
    r"|ACTIVIT(?:Y|IES))[ \t]*$"                        # 영어 섹션 키워드
    r")"
)


class NotConfiguredError(Exception):
    """SOLAR_API_KEY가 설정되지 않은 경우."""


class SolarAPIError(Exception):
    """Solar API 호출이 최종 실패한 경우."""


def extract_json(text: str) -> dict | None:
    """LLM 응답 텍스트에서 첫 번째 JSON 객체를 추출해 dict로 반환. 실패 시 None."""
    match = _JSON_RE.search(text)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except Exception:
        return None


def _call_solar_api(headers: dict, body: dict, max_retries: int = 3) -> requests.Response:
    """
    Solar Chat Completions 엔드포인트를 호출하고 재시도 로직을 처리한다.

    재시도 정책:
      - 429 (rate limit): Retry-After 헤더 값만큼 대기, 없으면 2^attempt * 1.0초 (최대 16초)
      - 500 / 502 / 503:  1회에 한해 1초 대기 후 재시도
      - 그 외 오류 코드:   즉시 실패
    최대 max_retries회 재시도 후에도 실패하면 SolarAPIError 발생.
    """
    server_error_retried = False  # 5xx 는 1회만 재시도

    for attempt in range(max_retries + 1):
        resp = requests.post(CHAT_URL, headers=headers, json=body, timeout=60)

        if resp.status_code == 200:
            return resp

        if resp.status_code == 429:
            if attempt >= max_retries:
                break
            # Retry-After 헤더 우선, 없으면 지수 백오프 (최대 16초)
            retry_after = resp.headers.get("Retry-After")
            if retry_after is not None:
                try:
                    wait = float(retry_after)
                except ValueError:
                    wait = min(2 ** attempt * 1.0, 16.0)
            else:
                wait = min(2 ** attempt * 1.0, 16.0)
            print(f"[Solar] rate limit, retry {attempt + 1}/{max_retries} after {wait}s")
            time.sleep(wait)
            continue

        if resp.status_code in (500, 502, 503):
            if not server_error_retried and attempt < max_retries:
                server_error_retried = True
                print(f"[Solar] server error {resp.status_code}, retry {attempt + 1}/{max_retries} after 1s")
                time.sleep(1.0)
                continue
            # 1회 이미 재시도했거나 max_retries 초과
            break

        # 그 외 오류(400, 401, 403 등): 즉시 실패
        resp.raise_for_status()

    raise SolarAPIError(
        f"Solar API가 {max_retries}회 재시도 후에도 실패했습니다. "
        f"마지막 상태 코드: {resp.status_code}"
    )


def _headers() -> dict:
    if not _API_KEY:
        raise NotConfiguredError("SOLAR_API_KEY가 .env에 설정되지 않았습니다.")
    return {"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"}


# ── 스키마 ────────────────────────────────────────────────────────

_SCHEMA = """{
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
  "awards": ["string"],
  "links": [
    {"label": "string", "url": "string"}
  ]
}"""


# ── 기술 스택 정의 (모든 LLM 호출에서 공통 사용) ───────────────────
# 포트폴리오 파싱(skills), 채용 공고 추출(required/preferred), 설정 생성에서 모두 이 정의를 따른다.
# 정의를 한 곳에서만 유지보수하기 위해 상수로 분리.

TECH_STACK_DEFINITION = """[기술 스택 정의 — 매우 중요]
"기술 스택"이란 소프트웨어 개발에 직접 사용되는 도구·기술의 고유명사입니다.
아래 카테고리에 해당하는 항목만 포함하고, 정규화 규칙을 반드시 따르세요.

[포함 카테고리]
- 프로그래밍 언어: Python, Java, JavaScript, TypeScript, Go, Rust, C, C++, C#, Kotlin, Swift, Ruby, PHP, Scala, Dart, R 등
- 프론트엔드 프레임워크/라이브러리: React, Vue, Angular, Svelte, Next.js, Nuxt, SvelteKit, Solid, Astro 등
- 백엔드 프레임워크: Spring, Spring Boot, Django, Flask, FastAPI, Express, NestJS, Koa, Rails, ASP.NET, Gin, Fiber 등
- 데이터베이스: MySQL, PostgreSQL, MariaDB, Oracle, MS SQL, MongoDB, Redis, Elasticsearch, DynamoDB, Cassandra, SQLite 등
- 인프라/클라우드: AWS, GCP, Azure, Docker, Kubernetes, Terraform, Ansible, Nginx, Apache 등
- CI/CD·DevOps: Jenkins, GitHub Actions, GitLab CI, CircleCI, ArgoCD, Helm 등
- 데이터/ML: TensorFlow, PyTorch, scikit-learn, pandas, NumPy, Spark, Hadoop, Kafka, Airflow, Hugging Face, LangChain 등
- 모바일: React Native, Flutter, SwiftUI, Jetpack Compose, Android SDK, iOS SDK 등
- 빌드/번들러/패키지: Webpack, Vite, Rollup, esbuild, Gradle, Maven, npm, pnpm, yarn 등
- 상태관리/HTTP 클라이언트: Redux, Zustand, MobX, Recoil, React Query, SWR, Axios 등
- ORM/쿼리: Prisma, SQLAlchemy, Hibernate, TypeORM, JPA, Sequelize 등
- 테스트: Jest, Pytest, JUnit, Cypress, Playwright, Mocha, Selenium 등
- 형상관리: Git, GitHub, GitLab, Bitbucket (보유 도구로 명시될 때만)
- 메시지큐/이벤트: Kafka, RabbitMQ, Redis Pub/Sub, NATS, AWS SQS 등
- 모니터링/관측: Prometheus, Grafana, Datadog, Sentry, ELK Stack 등
- 프로토콜/표준: REST, GraphQL, gRPC, WebSocket (명시적으로 기술됐을 때)

[포함하지 않는 것 — 자주 혼동되는 항목]
- 회사명·서비스명: "토스", "카카오", "네이버", "우아한형제들" 같은 회사 이름은 스킬이 아님
- 직무명·역할: "백엔드 개발자", "풀스택", "DevOps 엔지니어" 등
- 소프트스킬·태도: "협업", "커뮤니케이션", "책임감", "문제해결능력", "리더십" 등
- 분야명: "웹 개발", "모바일 개발", "데이터 분석" 같은 분야 자체는 스킬이 아님 (해당 분야의 구체적 도구가 스킬)
- 운영체제 단순 사용: "Linux 사용 가능" 수준이면 제외. 단 "Linux 서버 운영", "Bash 스크립팅" 같은 구체적 기술은 포함
- 학력·자격증·수상명: 자격증은 별도 필드(awards) 대상
- 일반 사무도구: Excel, Word, PowerPoint, Notion 등 (개발 도구가 아닌 경우)
- 추상 개념·패러다임: OOP, 함수형 프로그래밍, 디자인 패턴, MSA 등은 개념이지 도구 아님 (단 "Spring Cloud" 같은 구체 도구는 포함)
- 단순 학습 의향: "배우고 싶다", "관심 있다", "공부 중" 표현은 보유 스킬로 보지 않음

[정규화 규칙 — 반드시 적용]
- 한글 표기 → 영문 공식 표기로 변환: 파이썬→Python, 리액트→React, 도커→Docker, 자바→Java, 코틀린→Kotlin, 노드→Node.js, 스프링→Spring
- 버전·세부 표기 제거: "React 18"→"React", "Python 3.10"→"Python", "Spring Boot 3.x"→"Spring Boot", "Java 17"→"Java"
- 약어 → 공식 명칭: TS→TypeScript, JS→JavaScript, K8s→Kubernetes, postgres/psql→PostgreSQL, mongo→MongoDB
- 표기 통일: nodejs→Node.js, vuejs→Vue, nextjs→Next.js, expressjs→Express
- 동일 의미는 1회만: "Java", "JAVA", "자바"가 모두 등장하면 결과는 "Java" 1개
- 다른 기술은 별개 항목으로: "Spring"과 "Spring Boot"는 모두 포함 (서로 다른 프레임워크), "JavaScript"와 "TypeScript"도 별개"""


# ── 기본 시스템 프롬프트 ──────────────────────────────────────────

_BASE_PROMPT = """당신은 개발자 포트폴리오 파싱 전문가입니다.
이 문서는 채용 판단에 사용됩니다.

[출력 규칙]
- 유효한 JSON만 출력합니다. 설명 문장, 마크다운 코드블럭 사용 금지.
- null 사용 금지. 값이 없으면 "" 또는 [] 또는 0을 사용합니다.
- 스키마에 없는 필드를 추가하지 않습니다.

[원문 준수 규칙 — 필수]
- 원문에서 찾을 수 있는 내용만 포함하십시오. 찾을 수 없으면 반드시 빈값으로 두십시오.
- intro와 desc는 원문 텍스트를 그대로 복사하십시오. 단어 하나도 바꾸지 마십시오.
- career_years: 원문에 숫자가 있으면 그 숫자만 사용하십시오. 없으면 0.
- skills: **포트폴리오 본문의 명시적 기술 스택 표기만** 추출하십시오. 추론 금지. 아래 [기술 스택 정의]·[추출 우선순위]를 엄격히 따르십시오.
- links: GitHub, Notion, LinkedIn, 블로그, 개인 사이트 등 원문에 명시된 URL을 추출하십시오. label은 플랫폼명(예: "GitHub", "Notion", "LinkedIn", "Blog", "Portfolio"). 없으면 [].

[이렇게 하지 마십시오 — 예시]
예시 1) 원문: "React를 배우고 싶다"
  잘못된 출력: skills: ["React"]
  올바른 출력: skills: []

예시 2) 원문: "응답 속도를 개선했습니다"
  잘못된 출력: desc: "응답 속도를 30% 개선했습니다"
  올바른 출력: desc: "응답 속도를 개선했습니다"

예시 3) 원문: "2018년 입사, 현재 재직 중"
  잘못된 출력: career_years: 6
  올바른 출력: career_years: 0

[스키마]
""" + _SCHEMA + """

[필드 규칙]
- name: 원문에 한글 이름(예: 김도현)이 있으면 반드시 한글 이름만 name 필드에 사용하십시오. 영문 로마자(예: Kim Dohyun)가 함께 있어도 한글 이름만 저장하십시오. 한글 이름이 전혀 없는 경우에만 영문 이름을 사용하십시오.
- career_years: 원문 명시 정수만. 없으면 0. 날짜로부터 계산 금지.
- skills: [기술 스택 정의] 카테고리에 해당하는 도구만 포함. 정규화 규칙 적용 (파이썬→Python, 리액트→React, React 18→React, TS→TypeScript). 중복 제거. 학습 의향("배우고 싶다", "관심") 표현은 제외. **최대 25개**까지만 — 보유 가능성이 가장 높은 것 우선.

[추출 우선순위 — skills]
1순위: "기술 스택" / "Skills" / "Tech Stack" / "사용 기술" / "보유 기술" 같은 명시적 섹션 안의 항목. 이 섹션이 있다면 거의 모든 skills는 여기서만 추출하십시오.
2순위: 표 형식·불릿 리스트로 "사용 언어: Python, Java" 처럼 명시적 레이블이 붙은 부분.
3순위: 프로젝트 stack 필드에 명시된 도구.
**추출 금지**: 자기소개·프로젝트 desc 본문에 단어로만 등장한 도구 (예: "Python으로 진행", "Docker 환경에서" 정도의 1회 언급은 skills에 넣지 마십시오. 단 1순위 섹션에 동일 도구가 있으면 거기서 가져옴).
- intro, desc: 원문 그대로 복사. 요약·의역·보완·수치 추가 금지.
- projects[].stack: 쉼표 구분 단일 문자열 (배열 금지). skills와 같은 [기술 스택 정의]·정규화 규칙 적용.
- 인명·학교명·회사명: 원문 그대로 보존. 번역·의역 금지.

""" + TECH_STACK_DEFINITION


# ── 포지션별 추가 지침 ────────────────────────────────────────────

_POSITION_HINTS: dict[str, str] = {
    "general": "",
    "frontend": """
[포지션 추가 지침 — 프론트엔드]
- skills: CSS 프레임워크, 번들러, 상태관리 라이브러리를 원문에서 빠짐없이 추출하십시오.
- desc:   원문 텍스트를 그대로 복사하십시오. UI·프론트엔드 관련 내용이 있으면 누락 없이 포함하십시오.""",
    "backend": """
[포지션 추가 지침 — 백엔드]
- skills: DB, ORM, 서버 프레임워크, 인프라 도구를 원문에서 빠짐없이 추출하십시오.
- desc:   원문 텍스트를 그대로 복사하십시오. 서버·인프라 관련 내용이 있으면 누락 없이 포함하십시오.""",
    "data": """
[포지션 추가 지침 — 데이터/AI]
- skills: ML·DL 프레임워크, 데이터 파이프라인 도구를 원문에서 빠짐없이 추출하십시오.
- awards: 논문·학회 발표·대회 실적이 원문에 있으면 포함하십시오. 없으면 빈 배열.""",
}


def _build_prompt(position: str) -> str:
    hint = _POSITION_HINTS.get(position, "")
    return _BASE_PROMPT + hint


# ── 원문 한글 이름 탐색 ──────────────────────────────────────────

# 신뢰도 순으로 패턴 나열
_KO_NAME_PATTERNS = [
    # 1. 이름/성명 레이블 뒤
    re.compile(r'(?:이름|성명)\s*[:\|]\s*([가-힣]{2,5})', re.MULTILINE),
    # 2. 마크다운 표 셀 — | 이름 | 김도현 | 형태
    re.compile(r'\|\s*(?:이름|성명)\s*\|\s*([가-힣]{2,5})\s*\|', re.MULTILINE),
    # 3. H1 헤더에서 한글 이름 (# 김도현 또는 # 김도현 포트폴리오)
    re.compile(r'^\s*#\s+([가-힣]{2,5})', re.MULTILINE),
    # 4. H1/H2 헤더 내 한글 이름 (앞부분에만)
    re.compile(r'^\s*#{1,2}\s+(?:[^\n가-힣]*?)([가-힣]{2,5})', re.MULTILINE),
]


def _find_korean_name(text: str) -> str | None:
    """원문에서 한글 이름(2~5자)을 신뢰도 높은 패턴 순으로 탐색한다."""
    for pat in _KO_NAME_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(1)
    return None


def _supplement_korean_name(result: dict, raw_text: str) -> dict:
    """
    name 필드에 한글이 없으면 원문에서 한글 이름을 탐색해 보완한다.
    Solar가 영문 로마자만 반환한 경우를 커버한다.
    """
    if re.search(r'[가-힣]', result.get("name", "")):
        return result  # 이미 한글 포함 — 처리 불필요
    ko = _find_korean_name(raw_text)
    if ko:
        result["name"] = ko
    return result


# ── 후처리 — 타입 강제 및 스키마 정제 ──────────────────────────

_ALLOWED_KEYS = {
    "name", "email", "github", "career_years",
    "education", "skills", "intro", "projects", "awards", "links",
}


def _str(v) -> str:
    return v if isinstance(v, str) else ""


def _remove_image_links(text: str) -> str:
    """포트폴리오 텍스트에서 이미지 링크를 제거합니다."""
    if not isinstance(text, str):
        return text
    # 마크다운 이미지: ![alt](url)
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', text)
    # 단독 이미지 URL (http로 시작하는 이미지 확장자)
    text = re.sub(r'\(https?://[^\s)]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)[^\s)]*\)', '', text)
    # 이미지 URL만 남은 경우 (unsplash, cdn 등)
    text = re.sub(r'\(?https?://(?:images\.unsplash\.com|cdn\.|img\.)[^\s)]+\)?', '', text)
    return text.strip()


# 기술 스택 후처리 — 비기술 항목 블랙리스트
# (소문자 비교. 부분 매치는 별도 검사)
_SKILL_BLACKLIST_EXACT = {
    # 직무·역할
    "backend", "frontend", "fullstack", "full-stack", "full stack",
    "백엔드", "프론트엔드", "풀스택", "데이터엔지니어", "devops",
    "개발자", "엔지니어", "프로그래머",
    # 소프트스킬·태도
    "협업", "커뮤니케이션", "책임감", "문제해결", "리더십", "팀워크",
    "성실", "열정", "creativity", "communication", "teamwork", "leadership",
    # 분야명 (도구 아님)
    "웹개발", "웹 개발", "모바일개발", "모바일 개발", "데이터분석", "데이터 분석",
    "web development", "mobile development", "data analysis",
    "machine learning", "deep learning",  # 분야 — 구체 도구(pytorch, tf 등)는 OK
    # 패러다임·개념
    "oop", "객체지향", "함수형프로그래밍", "함수형 프로그래밍",
    "msa", "마이크로서비스", "디자인패턴", "디자인 패턴",
    "agile", "scrum", "애자일", "스크럼", "tdd", "ddd",
    # 사무 도구
    "excel", "word", "powerpoint", "엑셀", "워드", "파워포인트",
    "ms office", "office", "한글",
    # 자격증 (awards로 분류)
    "정보처리기사", "정보처리산업기사", "saa", "솔루션스 아키텍트",
    # 분야 일반어
    "ui", "ux", "ui/ux", "운영체제", "operating system",
}

# 부분 매치 차단 — 이 토큰이 포함되면 블락 (회사명 등)
_SKILL_BLACKLIST_SUBSTR = (
    "포트폴리오", "이력서", "resume", "portfolio",
    "졸업", "학사", "석사", "박사", "전공",
)


def _filter_skills(skills: list, max_count: int = 25) -> list:
    """비기술 항목 제거 + 정규화 표기로 중복 제거 + 개수 상한."""
    from .algorithms.alias_map import normalize as _alias_norm

    seen_canonical = set()
    filtered = []
    for raw in skills:
        if not isinstance(raw, str):
            continue
        s = raw.strip()
        if not s or len(s) > 40:
            continue
        low = s.lower()
        if low in _SKILL_BLACKLIST_EXACT:
            continue
        if any(sub in low for sub in _SKILL_BLACKLIST_SUBSTR):
            continue
        # 숫자만, 단일 문자(R 제외), 한글 1자 등 의심
        if low.isdigit() or (len(low) == 1 and low != "r"):
            continue
        canonical = _alias_norm(s)
        if canonical in seen_canonical:
            continue
        seen_canonical.add(canonical)
        filtered.append(s)
    return filtered[:max_count]


def _normalize(result: dict) -> dict:
    """Solar 출력을 고정 스키마로 정규화한다."""
    # 스키마 외 필드 제거
    result = {k: v for k, v in result.items() if k in _ALLOWED_KEYS}

    # career_years: 정수 강제
    cy = result.get("career_years", 0)
    if isinstance(cy, str):
        m = re.search(r"\d+", cy)
        result["career_years"] = int(m.group()) if m else 0
    elif not isinstance(cy, int):
        result["career_years"] = 0

    # 배열 필드
    for key in ("skills", "projects", "awards"):
        if not isinstance(result.get(key), list):
            result[key] = []

    # skills 후처리 — 비기술 항목 차단 + 정규화 중복 제거 + 상한
    result["skills"] = _filter_skills(result["skills"])

    # 문자열 필드
    for key in ("name", "email", "github", "education", "intro"):
        if not isinstance(result.get(key), str):
            result[key] = ""

    # 이름 정제: 한글 이름이 있으면 한글 이름만, 영어 이름만 있으면 영어 이름만
    if result.get("name"):
        result["name"] = clean_name(result["name"])

    # intro 이미지 링크 제거
    result["intro"] = _remove_image_links(result.get("intro", ""))

    # projects 내부 필드 정규화
    clean_projects = []
    for p in result.get("projects", []):
        if not isinstance(p, dict):
            continue
        clean_projects.append({
            "name":   _str(p.get("name")),
            "period": _str(p.get("period")),
            "role":   _str(p.get("role")),
            "stack":  _str(p.get("stack")),
            "desc":   _remove_image_links(_str(p.get("desc"))),
        })
    result["projects"] = clean_projects

    # awards: 문자열 배열만
    result["awards"] = [a for a in result.get("awards", []) if isinstance(a, str)]

    # links: {label, url} 딕셔너리 배열 정규화
    raw_links = result.get("links", [])
    if not isinstance(raw_links, list):
        raw_links = []
    clean_links = []
    for lnk in raw_links:
        if isinstance(lnk, dict):
            label = _str(lnk.get("label") or lnk.get("name") or "")
            url   = _str(lnk.get("url")   or lnk.get("href") or "")
            if url:
                clean_links.append({"label": label, "url": url})
    result["links"] = clean_links

    return result


# ── 분할 처리 ─────────────────────────────────────────────────────

# 청크 파싱 전용 추가 지침
_CHUNK_PREFIX = """이 텍스트는 개발자 포트폴리오의 일부 구간입니다.
이 구간에서 찾을 수 있는 모든 정보를 빠짐없이 추출하십시오.

[추가 지침]
- 이 구간에서 확인되는 경우에만 기본 정보 필드(name, email 등)를 채우십시오.
- 확인되지 않으면 "" 또는 0으로 두십시오.
- skills, projects, awards, links는 이 구간에서 찾을 수 있는 모든 내용을 추출하십시오.

"""

# Reduce 단계 — 여러 청크의 파싱 결과를 하나로 통합
_REDUCE_PROMPT = """당신은 개발자 포트폴리오 파싱 결과 통합 전문가입니다.
여러 청크에서 파싱된 JSON 결과 배열을 하나의 완전한 포트폴리오 JSON으로 통합하세요.

[통합 규칙]
- name, email, github, education, intro, career_years: 가장 완전한(비어있지 않은) 값을 선택
- intro: 가장 긴 버전을 선택
- skills: 모든 청크의 skills 합산 후 중복 제거, 원래 표기 보존
- projects: 이름이 동일하거나 매우 유사한 프로젝트는 desc가 더 긴 버전으로 통합. 나머지는 순서대로 합산.
- awards, links: 합산 후 중복 제거 (links는 URL 기준)
- 유효한 JSON 하나만 출력. 설명 문장·마크다운 코드블럭 사용 금지.

[스키마]
""" + _SCHEMA


def _chunk_by_boundaries(text: str, max_chars: int) -> list[str]:
    """
    섹션/프로젝트 헤더 경계를 기준으로 텍스트를 청크로 분할한다.

    - 각 청크는 max_chars 이하
    - 청크 경계는 반드시 섹션 헤더 위치에서 시작 (헤더 중간 절단 없음)
    - 여러 헤더를 한 청크에 묶어 API 호출 최소화
    - 단일 섹션이 max_chars를 초과하면 부득이하게 강제 절단
    """
    if len(text) <= max_chars:
        return [text]

    # 섹션 헤더 위치 목록 (0 포함 — 헤더 이전 텍스트도 한 구간)
    header_positions = [0] + [m.start() for m in _SECTION_HEADER_RE.finditer(text)]
    header_positions.append(len(text))  # 센티넬

    chunks: list[str] = []
    chunk_start = 0

    for i in range(1, len(header_positions)):
        next_boundary = header_positions[i]
        current_length = next_boundary - chunk_start

        if current_length <= max_chars:
            # 이 섹션까지 포함해도 한도 이내 → 아직 청크 확정 안 함 (더 묶을 수 있음)
            continue

        # 한도 초과 → 직전 경계까지를 하나의 청크로 확정
        prev_boundary = header_positions[i - 1]

        if prev_boundary > chunk_start:
            # 직전 경계에서 자름 (헤더 중간 절단 없음)
            chunks.append(text[chunk_start:prev_boundary])
            chunk_start = prev_boundary
        else:
            # 단일 섹션 자체가 max_chars 초과 → 강제 절단
            while chunk_start < next_boundary:
                end = min(chunk_start + max_chars, next_boundary)
                chunks.append(text[chunk_start:end])
                chunk_start = end

    # 남은 텍스트
    if chunk_start < len(text):
        tail = text[chunk_start:]
        if len(tail) > max_chars:
            # 꼬리가 여전히 크면 강제 절단
            while tail:
                chunks.append(tail[:max_chars])
                tail = tail[max_chars:]
        else:
            chunks.append(tail)

    return [c for c in chunks if c.strip()]


def _reduce_with_llm(partial_results: list[dict], position: str) -> dict:
    """
    Map 단계 파싱 결과 목록을 Solar LLM으로 통합한다.
    JSON 배열이 _MAX_CHARS 이내이므로 단일 호출로 처리 가능.
    """
    hint = _POSITION_HINTS.get(position, "")
    system_prompt = _REDUCE_PROMPT + hint

    # 파싱 결과에서 내부 메타 필드 제거 후 직렬화
    clean_parts = []
    for r in partial_results:
        clean_parts.append({k: v for k, v in r.items() if not k.startswith("_")})

    user_content = json.dumps(clean_parts, ensure_ascii=False)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ],
        "temperature": 0.1,
    }

    print(f"[Solar] Reduce 요청 | 입력 {len(user_content)}자 ({len(partial_results)}개 청크 결과)")
    t0 = time.time()
    resp = _call_solar_api(_headers(), payload)
    elapsed = time.time() - t0

    raw_resp = resp.json()
    content  = raw_resp["choices"][0]["message"]["content"]
    usage    = raw_resp.get("usage", {})
    print(
        f"[Solar] Reduce 완료 | {elapsed:.1f}s | "
        f"prompt={usage.get('prompt_tokens','?')} / "
        f"completion={usage.get('completion_tokens','?')} 토큰"
    )

    result = extract_json(content)
    if result is None:
        # Reduce 실패 시 가장 완전한 청크 결과를 폴백으로 사용
        print("[Solar] Reduce JSON 추출 실패 — 가장 긴 프로젝트를 가진 청크 결과로 폴백")
        result = max(partial_results, key=lambda r: len(r.get("projects", [])))

    merged = _normalize(result)
    merged["_reduce_elapsed"] = round(elapsed, 2)
    merged["_reduce_tokens"]  = usage
    return merged


def _call_single(chunk: str, system_prompt: str, label: str) -> tuple[dict, float, dict]:
    """Solar API 단일 호출. (정규화된 결과, elapsed, usage) 반환."""
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": chunk},
        ],
        "temperature": 0.1,
    }

    print(f"[Solar] {label} 요청 | 입력 {len(chunk)}자, 모델={MODEL}")
    t0 = time.time()
    resp = _call_solar_api(_headers(), payload)
    elapsed = time.time() - t0

    raw_resp = resp.json()
    content  = raw_resp["choices"][0]["message"]["content"]
    usage    = raw_resp.get("usage", {})
    print(
        f"[Solar] {label} 완료 | {elapsed:.1f}s | "
        f"prompt={usage.get('prompt_tokens','?')} / "
        f"completion={usage.get('completion_tokens','?')} 토큰"
    )

    result = extract_json(content)
    if result is None:
        raise ValueError(f"Solar 응답({label})에서 JSON 블럭을 찾을 수 없습니다.")
    return _normalize(result), round(elapsed, 2), usage




# ── Solar 파싱 ────────────────────────────────────────────────────

def parse_text(raw_text: str, position: str = "general") -> dict:
    """
    자유 형식 텍스트를 Solar로 파싱하여 구조화된 포트폴리오 딕셔너리 반환.
    position: "general" | "frontend" | "backend" | "data"

    _MAX_CHARS 이하: 단일 호출.
    초과 시: MapReduce — 섹션 헤더 경계 기준 청킹(Map) + LLM 합성(Reduce).
    """
    if len(raw_text) <= _MAX_CHARS:
        result, elapsed, usage = _call_single(raw_text, _build_prompt(position), "single")
        result["_solar_used"]    = True
        result["_solar_elapsed"] = elapsed
        result["_solar_tokens"]  = usage
        result["_truncated"]     = False
        result["_map_chunks"]    = 1
        _supplement_korean_name(result, raw_text)
        return result

    # ── Map 단계: 청크별 독립 파싱 ────────────────────────
    chunks = _chunk_by_boundaries(raw_text, _MAX_CHARS)
    print(
        f"[Solar] MapReduce 시작: 총 {len(raw_text)}자 → "
        f"{len(chunks)}개 청크 {[len(c) for c in chunks]}"
    )

    hint = _POSITION_HINTS.get(position, "")
    partial_results: list[dict] = []
    total_elapsed = 0.0
    total_prompt_tokens = 0
    total_completion_tokens = 0

    for i, chunk in enumerate(chunks):
        label = f"Map {i+1}/{len(chunks)}"
        # 첫 청크는 기본 프롬프트, 이후 청크는 구간 전용 프롬프트
        system_prompt = _build_prompt(position) if i == 0 else _CHUNK_PREFIX + _BASE_PROMPT + hint
        r, e, u = _call_single(chunk, system_prompt, label)
        partial_results.append(r)
        total_elapsed += e
        total_prompt_tokens     += u.get("prompt_tokens", 0) or 0
        total_completion_tokens += u.get("completion_tokens", 0) or 0

    # ── Reduce 단계: LLM으로 통합 ─────────────────────────
    merged = _reduce_with_llm(partial_results, position)
    reduce_elapsed = merged.pop("_reduce_elapsed", 0)
    reduce_tokens  = merged.pop("_reduce_tokens", {})

    merged["_solar_used"]    = True
    merged["_solar_elapsed"] = round(total_elapsed + reduce_elapsed, 2)
    merged["_solar_tokens"]  = {
        "prompt_tokens":     total_prompt_tokens     + (reduce_tokens.get("prompt_tokens")     or 0),
        "completion_tokens": total_completion_tokens + (reduce_tokens.get("completion_tokens") or 0),
    }
    merged["_truncated"]   = False
    merged["_map_chunks"]  = len(chunks)
    _supplement_korean_name(merged, raw_text)
    return merged


_SUMMARY_PROMPT = """당신은 개발자 포트폴리오 요약 전문가입니다.
주어진 포트폴리오 원문을 요약하세요.

[요약 규칙 — 필수]
- 원문에 없는 내용은 절대 추가하지 마세요. 원문 요약만 진행합니다.
- 마크다운 문법 사용을 최소화하세요. 코드블럭과 필요한 경우 heading만 사용.
- 원문에 중요한 코드 블럭(핵심 알고리즘, 설계 등)이 있다면 요약본에 그대로 포함하세요.
- 분량: 원문의 30~40% 수준으로 핵심만 요약
- 섹션 구조: 기본정보 > 기술스택 > 핵심 경험 > 주요 프로젝트 > 기타

[절대 금지]
- 원문에 없는 수치나 평가 추가 금지
- 새로운 기술 스택 추가 금지
- 과도한 마크다운 (#, ##, ***, - 등의 과도한 사용) 금지
"""


def summarize_text(raw_text: str, position: str = "general", job_config: dict = None) -> dict:
    """포트폴리오 원문을 요약합니다. job_config가 있으면 채용 설정 기준으로 요약."""
    prompt = _SUMMARY_PROMPT
    if job_config:
        specs = job_config.get("specs_text", "")
        prompt += f"\n\n[채용 설정 기준]\n필요 스펙: {specs}\n채용 설정에 중요한 부분을 중점적으로 요약하세요."

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": raw_text[:_MAX_CHARS]},
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
    }
    t0 = time.time()
    resp = _call_solar_api(_headers(), payload)
    elapsed = time.time() - t0
    content = resp.json()["choices"][0]["message"]["content"]
    return {"summary": content, "elapsed": round(elapsed, 2)}


def parse_portfolio_url(url: str, position: str = "general") -> dict:
    """URL에서 포트폴리오 텍스트를 가져와 Solar로 파싱."""
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    text = re.sub(r"<[^>]+>", " ", resp.text)
    text = re.sub(r"\s+", " ", text).strip()
    return parse_text(text, position=position)

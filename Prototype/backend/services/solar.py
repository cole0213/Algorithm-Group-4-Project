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

_API_KEY  = os.getenv("SOLAR_API_KEY", "")
_BASE_URL = "https://api.upstage.ai/v1"
_CHAT_URL = f"{_BASE_URL}/chat/completions"
_MODEL    = os.getenv("SOLAR_MODEL", "solar-pro")
_MAX_CHARS = 8000  # 32k 토큰 제한 대비 보수적 설정 (한국어 약 3–4자/토큰)

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
        resp = requests.post(_CHAT_URL, headers=headers, json=body, timeout=60)

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
- skills: 원문에 보유 기술로 명확히 언급된 경우에만 포함하십시오.
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
- skills: 원래 표기 보존 (파이썬 → Python, 리액트 → React). 버전 제거 (React 18 → React). 중복 제거. 보유·사용 기술로 명확히 언급된 것만 포함.
- intro, desc: 원문 그대로 복사. 요약·의역·보완·수치 추가 금지.
- projects[].stack: 쉼표 구분 단일 문자열 (배열 금지).
- 인명·학교명·회사명: 원문 그대로 보존. 번역·의역 금지."""


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

    # 문자열 필드
    for key in ("name", "email", "github", "education", "intro"):
        if not isinstance(result.get(key), str):
            result[key] = ""

    # 이름 정제: 한글 이름이 있으면 한글 이름만, 영어 이름만 있으면 영어 이름만
    if result.get("name"):
        result["name"] = clean_name(result["name"])

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
            "desc":   _str(p.get("desc")),
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

# 후반부 파트 전용 추가 지침 — 기본 정보는 이미 앞 파트에서 추출했음을 알림
_CONTINUATION_PREFIX = """이 텍스트는 개발자 포트폴리오의 후반부(연속)입니다.
앞 파트에서 기본 정보(이름, 이메일, 기술 스택 등)를 이미 추출했습니다.
이 파트에서는 프로젝트·수상·링크 등 남은 내용을 중점적으로 추출하십시오.

[추가 지침]
- 이 텍스트에서 확실히 확인되는 경우에만 기본 정보 필드(name, email 등)를 채우십시오.
- 확인되지 않으면 "" 또는 0으로 두십시오.
- skills, projects, awards, links는 이 텍스트에서 찾을 수 있는 모든 내용을 추출하십시오.

"""


def _find_split_point(text: str, max_chars: int) -> int:
    """
    섹션 경계를 기준으로 분할 지점을 결정한다.

    텍스트를 섹션 순서대로 읽다가 어느 섹션의 끝이 max_chars를 초과하면
    그 섹션의 시작 위치(= 이전 섹션의 끝)에서 분할한다.
    섹션 경계를 찾지 못하거나 첫 섹션부터 초과하면 max_chars를 반환한다.
    """
    if len(text) <= max_chars:
        return len(text)

    # 감지된 섹션 시작 위치 목록. 0을 앞에 추가해 "헤더 이전 텍스트"도 하나의 구간으로 처리
    boundaries = [0] + [m.start() for m in _SECTION_HEADER_RE.finditer(text)]
    boundaries.append(len(text))  # 센티넬

    for i in range(len(boundaries) - 1):
        section_start = boundaries[i]
        section_end   = boundaries[i + 1]

        if section_end > max_chars:
            # 이 섹션 끝이 한계 초과 → 이 섹션 시작에서 분할
            # section_start == 0 이면 첫 구간부터 초과 → 단순 절단(max_chars) 사용
            return section_start if section_start > 0 else max_chars

    return max_chars  # 모든 섹션이 한계 이내 (이론상 도달 안 함)


def _call_single(chunk: str, system_prompt: str, label: str) -> tuple[dict, float, dict]:
    """Solar API 단일 호출. (정규화된 결과, elapsed, usage) 반환."""
    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": chunk},
        ],
        "temperature": 0.1,
    }

    print(f"[Solar] {label} 요청 — 입력 {len(chunk)}자, 모델={_MODEL}")
    t0 = time.time()
    resp = _call_solar_api(_headers(), payload)
    elapsed = time.time() - t0

    raw_resp = resp.json()
    content  = raw_resp["choices"][0]["message"]["content"]
    usage    = raw_resp.get("usage", {})
    print(
        f"[Solar] {label} 완료 — {elapsed:.1f}s | "
        f"prompt={usage.get('prompt_tokens','?')} / "
        f"completion={usage.get('completion_tokens','?')} 토큰"
    )

    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        raise ValueError(f"Solar 응답({label})에서 JSON 블럭을 찾을 수 없습니다.")
    result = json.loads(match.group())
    return _normalize(result), round(elapsed, 2), usage


def _merge_results(part1: dict, part2: dict) -> dict:
    """
    두 파트의 Solar 결과를 병합한다.
    기본 정보(name·email 등)는 Part 1 우선, 비어있으면 Part 2로 보완.
    배열 필드(projects·awards·links)는 순서 유지 합산, skills는 중복 제거.
    """
    merged = dict(part1)

    # 기본 정보: Part 1 우선, 빈 값이면 Part 2에서 보완
    for key in ("name", "email", "github", "education", "intro"):
        if not merged.get(key) and part2.get(key):
            merged[key] = part2[key]
    if not merged.get("career_years") and part2.get("career_years"):
        merged["career_years"] = part2["career_years"]

    # skills: 순서 유지 중복 제거 (dict.fromkeys 활용)
    merged["skills"] = list(dict.fromkeys(
        merged.get("skills", []) + part2.get("skills", [])
    ))

    # projects·awards: 순서 유지 단순 합산
    merged["projects"] = merged.get("projects", []) + part2.get("projects", [])
    merged["awards"]   = merged.get("awards", [])   + part2.get("awards", [])

    # links: URL 기준 중복 제거
    seen_urls: set[str] = set()
    merged_links: list[dict] = []
    for lnk in merged.get("links", []) + part2.get("links", []):
        url = lnk.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            merged_links.append(lnk)
    merged["links"] = merged_links

    # 메타: 토큰·경과 시간 합산
    t1 = part1.get("_solar_tokens", {})
    t2 = part2.get("_solar_tokens", {})
    merged["_solar_tokens"] = {
        "prompt_tokens":     (t1.get("prompt_tokens")     or 0) + (t2.get("prompt_tokens")     or 0),
        "completion_tokens": (t1.get("completion_tokens") or 0) + (t2.get("completion_tokens") or 0),
    }
    merged["_solar_elapsed"]     = round((part1.get("_solar_elapsed") or 0) + (part2.get("_solar_elapsed") or 0), 2)
    merged["_split_processed"]   = True

    return merged


# ── Solar 파싱 ────────────────────────────────────────────────────

def parse_text(raw_text: str, position: str = "general") -> dict:
    """
    자유 형식 텍스트를 Solar로 파싱하여 구조화된 포트폴리오 딕셔너리 반환.
    position: "general" | "frontend" | "backend" | "data"

    텍스트 길이가 _MAX_CHARS 초과 시 섹션 경계 기준 2파트 분할 처리 후 결과 병합.
    """
    if len(raw_text) <= _MAX_CHARS:
        result, elapsed, usage = _call_single(raw_text, _build_prompt(position), f"position={position}")
        result["_solar_used"]    = True
        result["_solar_elapsed"] = elapsed
        result["_solar_tokens"]  = usage
        result["_truncated"]     = False
        _supplement_korean_name(result, raw_text)
        return result

    # 분할 지점 결정
    split_pos = _find_split_point(raw_text, _MAX_CHARS)
    part1_text = raw_text[:split_pos]
    part2_text = raw_text[split_pos:]

    print(
        f"[Solar] 문서 분할 처리: 총 {len(raw_text)}자 → "
        f"Part1 {len(part1_text)}자 / Part2 {len(part2_text)}자 (분할 위치={split_pos})"
    )

    # Part 1: 기본 파싱
    r1, e1, u1 = _call_single(part1_text, _build_prompt(position), "Part1")
    r1.update({"_solar_used": True, "_solar_elapsed": e1, "_solar_tokens": u1, "_truncated": False})

    # Part 2: 후반부 특화 파싱 (길면 추가 절단)
    hint = _POSITION_HINTS.get(position, "")
    r2, e2, u2 = _call_single(
        part2_text[:_MAX_CHARS],
        _CONTINUATION_PREFIX + _BASE_PROMPT + hint,
        "Part2(연속)",
    )
    r2.update({
        "_solar_used":    True,
        "_solar_elapsed": e2,
        "_solar_tokens":  u2,
        "_truncated":     len(part2_text) > _MAX_CHARS,
    })

    merged = _merge_results(r1, r2)
    merged["_solar_used"] = True
    merged["_truncated"]  = False
    _supplement_korean_name(merged, raw_text)
    return merged


def parse_portfolio_url(url: str, position: str = "general") -> dict:
    """URL에서 포트폴리오 텍스트를 가져와 Solar로 파싱."""
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    text = re.sub(r"<[^>]+>", " ", resp.text)
    text = re.sub(r"\s+", " ", text).strip()
    return parse_text(text, position=position)

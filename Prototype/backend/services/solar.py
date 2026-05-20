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

load_dotenv()

_API_KEY  = os.getenv("SOLAR_API_KEY", "")
_BASE_URL = "https://api.upstage.ai/v1"
_CHAT_URL = f"{_BASE_URL}/chat/completions"
_MODEL    = os.getenv("SOLAR_MODEL", "solar-pro")
_MAX_CHARS = 8000  # 32k 토큰 제한 대비 보수적 설정 (한국어 약 3–4자/토큰)


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


# ── Solar 파싱 ────────────────────────────────────────────────────

def parse_text(raw_text: str, position: str = "general") -> dict:
    """
    자유 형식 텍스트를 Solar로 파싱하여 구조화된 포트폴리오 딕셔너리 반환.
    position: "general" | "frontend" | "backend" | "data"
    """
    truncated = len(raw_text) > _MAX_CHARS
    chunk = raw_text[:_MAX_CHARS]

    system_prompt = _build_prompt(position)
    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": chunk},
        ],
        "temperature": 0.1,
    }

    print(f"[Solar] 요청 시작 — position={position}, 입력 {len(chunk)}자 (절단={truncated}), 모델={_MODEL}")
    t0 = time.time()
    resp = _call_solar_api(_headers(), payload)
    elapsed = time.time() - t0

    raw_resp = resp.json()
    content  = raw_resp["choices"][0]["message"]["content"]
    usage    = raw_resp.get("usage", {})
    print(
        f"[Solar] 완료 — {elapsed:.1f}s | "
        f"prompt={usage.get('prompt_tokens','?')} / "
        f"completion={usage.get('completion_tokens','?')} 토큰"
    )

    # JSON 추출 — 정규식으로 코드블럭 무관하게 추출
    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        raise ValueError("Solar 응답에서 JSON 블럭을 찾을 수 없습니다.")
    result = json.loads(match.group())

    # 정규화
    result = _normalize(result)

    # 메타 필드 추가
    result["_solar_used"]    = True
    result["_solar_elapsed"] = round(elapsed, 2)
    result["_solar_tokens"]  = usage
    result["_truncated"]     = truncated

    return result


def parse_portfolio_url(url: str, position: str = "general") -> dict:
    """URL에서 포트폴리오 텍스트를 가져와 Solar로 파싱."""
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    text = re.sub(r"<[^>]+>", " ", resp.text)
    text = re.sub(r"\s+", " ", text).strip()
    return parse_text(text, position=position)

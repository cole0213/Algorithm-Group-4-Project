# solar.py — Solar LLM API 연동
# PDF/URL 텍스트를 Solar로 파싱하여 구조화된 포트폴리오 딕셔너리 반환
#
# API 키 없을 시 NotConfiguredError 발생 → 라우터에서 처리

from __future__ import annotations
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

_API_KEY = os.getenv("SOLAR_API_KEY", "")
_BASE_URL = "https://api.upstage.ai/v1"
_CHAT_URL = f"{_BASE_URL}/solar/chat/completions"
_OCR_URL = f"{_BASE_URL}/ocr"
_MODEL = "solar-pro-2"
_MAX_CHARS = 8000  # 32k 토큰 제한 대비 보수적 설정 (한국어 약 3–4자/토큰)


class NotConfiguredError(Exception):
    """SOLAR_API_KEY가 설정되지 않은 경우."""


def _headers() -> dict:
    if not _API_KEY:
        raise NotConfiguredError("SOLAR_API_KEY가 .env에 설정되지 않았습니다.")
    return {"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"}


# ── OCR ───────────────────────────────────────────────────────────


def ocr_pdf(pdf_url: str) -> str:
    """PDF URL을 Upstage OCR로 텍스트 추출."""
    resp = requests.post(
        _OCR_URL,
        headers=_headers(),
        json={"image_url": pdf_url, "options": {"language": "ko"}},
        timeout=30,
    )
    resp.raise_for_status()
    texts = resp.json().get("texts", [])
    return " ".join(t["text"] for t in texts)


# ── Solar 파싱 ────────────────────────────────────────────────────

_SYSTEM_PROMPT = """당신은 개발자 포트폴리오 파싱 전문가입니다.
주어진 텍스트에서 아래 JSON 형식으로 정보를 추출하세요.
반드시 유효한 JSON만 출력하고, 다른 텍스트는 포함하지 마세요.

출력 형식:
{
  "name": "이름",
  "email": "이메일",
  "github": "GitHub URL 또는 아이디",
  "career_years": 경력 연수(정수),
  "education": "학력",
  "skills": ["기술1", "기술2", ...],
  "intro": "자기소개 전문",
  "projects": [
    {
      "name": "프로젝트명",
      "period": "기간",
      "role": "역할",
      "stack": "사용 기술",
      "desc": "설명"
    }
  ],
  "awards": ["수상/활동1", "수상/활동2"]
}

기술 스택은 대소문자·약어를 원래 표기로 유지하세요.
모르는 항목은 빈 문자열 또는 빈 배열로 채우세요."""


def parse_text(raw_text: str) -> dict:
    """
    자유 형식 텍스트를 Solar로 파싱하여 구조화된 포트폴리오 딕셔너리 반환.
    32k 토큰 초과 방지를 위해 텍스트를 최대 _MAX_CHARS로 분할.
    """
    import time
    chunk = raw_text[:_MAX_CHARS]
    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": chunk},
        ],
        "temperature": 0.1,
    }
    print(f"[Solar] 요청 시작 — 입력 {len(chunk)}자, 모델: {_MODEL}")
    t0 = time.time()
    resp = requests.post(_CHAT_URL, headers=_headers(), json=payload, timeout=60)
    elapsed = time.time() - t0
    resp.raise_for_status()

    raw_resp = resp.json()
    content = raw_resp["choices"][0]["message"]["content"]
    usage = raw_resp.get("usage", {})
    print(
        f"[Solar] 완료 — {elapsed:.1f}s | "
        f"prompt={usage.get('prompt_tokens','?')} / "
        f"completion={usage.get('completion_tokens','?')} 토큰"
    )

    # JSON 파싱 (마크다운 코드블럭 제거)
    content = (
        content.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )
    result = json.loads(content)
    result["_solar_used"] = True
    result["_solar_elapsed"] = round(elapsed, 2)
    result["_solar_tokens"] = usage
    return result


def parse_portfolio_url(url: str) -> dict:
    """URL에서 포트폴리오 텍스트를 가져와 Solar로 파싱."""
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    # 간단 HTML 태그 제거
    import re

    text = re.sub(r"<[^>]+>", " ", resp.text)
    text = re.sub(r"\s+", " ", text).strip()
    return parse_text(text)

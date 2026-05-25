# _solar_http.py — Solar chat/completions HTTP 래퍼
# routers/utils.py 의 extract-specs / extract-config / diff 엔드포인트가 동일하게
# 반복하던 httpx 호출·에러 매핑·content 파싱 코드를 단일 함수로 모은다.

from __future__ import annotations
import os

import httpx
from fastapi import HTTPException

from services.solar import CHAT_URL, MODEL


async def call_solar_chat(
    system_prompt: str,
    user_text: str,
    *,
    max_tokens: int = 400,
    temperature: float = 0.1,
    timeout: float = 30.0,
) -> str:
    """Solar chat/completions 호출 후 content 문자열을 반환.

    실패 시:
    - SOLAR_API_KEY 없음 → HTTPException(503)
    - API 비-200 응답 → HTTPException(502) (응답 본문에서 error.message 추출 시도)
    - 응답 JSON 파싱 실패 → HTTPException(502)
    """
    api_key = os.getenv("SOLAR_API_KEY") or os.getenv("UPSTAGE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Solar API 키가 설정되지 않았습니다.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(CHAT_URL, headers=headers, json=body)

    if resp.status_code != 200:
        try:
            err_body = resp.json()
            err_detail = err_body.get("error", {}).get("message", resp.text[:200])
        except Exception:
            err_detail = resp.text[:200]
        raise HTTPException(
            status_code=502,
            detail=f"Solar API 오류 ({resp.status_code}): {err_detail}",
        )

    try:
        resp_data = resp.json()
        return resp_data["choices"][0]["message"]["content"].strip()
    except Exception:
        raise HTTPException(status_code=502, detail=f"Solar 응답 파싱 실패: {resp.text[:200]}")

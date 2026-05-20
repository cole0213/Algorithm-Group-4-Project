from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json as json_mod

router = APIRouter(prefix="/api", tags=["utils"])

class ExtractSpecsRequest(BaseModel):
    text: str

@router.post("/extract-specs")
async def extract_specs(req: ExtractSpecsRequest):
    """채용 공고 텍스트에서 필요 기술 스택을 추출합니다 (Solar LLM 사용)."""
    api_key = os.getenv("SOLAR_API_KEY") or os.getenv("UPSTAGE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Solar API 키가 설정되지 않았습니다.")

    import httpx
    import re as re_mod

    system_prompt = """당신은 채용 공고 분석 전문가입니다.
주어진 채용 공고 텍스트(비정형 자연어)에서 기술 스택과 자격 요건을 추출하세요.

반드시 아래 JSON 형식으로만 응답하세요. 설명, 마크다운 코드블럭, 추가 문장 금지:
{"required": ["기술1", "기술2"], "preferred": ["기술3", "기술4"]}

규칙:
- required: 필수 사항, 우대 사항이 아닌 기술/자격 요건
- preferred: 우대 사항 기술/자격 요건
- 기술명은 원래 표기 보존 (React, AWS, C# 등), 버전 번호 제거
- 경력 년수 조건은 제외 (기술명만 추출)
- 없으면 빈 배열 []"""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "solar-pro",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.text[:4000]},
        ],
        "max_tokens": 300,
        "temperature": 0.1,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.upstage.ai/v1/chat/completions",
            headers=headers,
            json=body,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Solar API 오류: {resp.status_code}")

    content = resp.json()["choices"][0]["message"]["content"].strip()

    # JSON 추출 — 코드블럭 무관하게 파싱
    match = re_mod.search(r"\{[\s\S]*\}", content)
    if match:
        try:
            parsed = json_mod.loads(match.group())
            required = [s.strip() for s in parsed.get("required", []) if isinstance(s, str) and s.strip()]
            preferred = [s.strip() for s in parsed.get("preferred", []) if isinstance(s, str) and s.strip()]
            specs = required + [s for s in preferred if s not in required]
            return {"specs": specs, "specs_text": ", ".join(specs), "required": required, "preferred": preferred}
        except Exception:
            pass

    # 폴백: 쉼표 구분 파싱
    specs = [s.strip() for s in content.replace("\n", ",").split(",") if s.strip() and len(s.strip()) < 40]
    return {"specs": specs, "specs_text": ", ".join(specs), "required": specs, "preferred": []}


# ── Diff 엔드포인트 ────────────────────────────────────────────────

class DiffRequest(BaseModel):
    id_a: str
    id_b: str


@router.post("/diff")
async def diff_portfolios(req: DiffRequest):
    """두 포트폴리오를 Solar LLM으로 비교하여 항목별 차이를 반환합니다."""
    from routers.portfolios import _get_portfolios

    portfolios = _get_portfolios()
    a = next((p for p in portfolios if p.get("id") == req.id_a), None)
    b = next((p for p in portfolios if p.get("id") == req.id_b), None)

    if not a or not b:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없습니다.")

    api_key = os.getenv("SOLAR_API_KEY") or os.getenv("UPSTAGE_API_KEY")
    if not api_key:
        # Solar API 없이도 로컬 비교 반환
        return _local_diff(a, b)

    prompt = f"""두 지원자를 다음 항목별로 비교하고 JSON으로 반환하세요:
경력, 학력, 기술스택, 주요프로젝트, 강점, 약점

반드시 아래 JSON 형식으로만 응답하세요:
{{
  "경력": {{"A": "...", "B": "...", "winner": "A|B|동등"}},
  "학력": {{"A": "...", "B": "...", "winner": "A|B|동등"}},
  "기술스택": {{"A": "...", "B": "...", "winner": "A|B|동등"}},
  "주요프로젝트": {{"A": "...", "B": "...", "winner": "A|B|동등"}},
  "강점": {{"A": "...", "B": "..."}},
  "약점": {{"A": "...", "B": "..."}}
}}

지원자 A ({a.get("name", "A")}):
- 경력: {a.get("career_years", 0)}년
- 학력: {a.get("education", "")}
- 스킬: {", ".join(a.get("skills", []))}
- 자기소개: {(a.get("intro", "") or "")[:500]}

지원자 B ({b.get("name", "B")}):
- 경력: {b.get("career_years", 0)}년
- 학력: {b.get("education", "")}
- 스킬: {", ".join(b.get("skills", []))}
- 자기소개: {(b.get("intro", "") or "")[:500]}"""

    import httpx
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": "solar-pro",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 800,
        "temperature": 0.1,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.upstage.ai/v1/chat/completions",
            headers=headers, json=body,
        )
    if resp.status_code != 200:
        return _local_diff(a, b)

    content = resp.json()["choices"][0]["message"]["content"].strip()
    # JSON 파싱 시도 — markdown 코드블럭 제거
    try:
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        diff_data = json_mod.loads(content)
    except Exception:
        return _local_diff(a, b)

    return {"diff": diff_data, "name_a": a.get("name"), "name_b": b.get("name"), "solar": True}


def _local_diff(a: dict, b: dict) -> dict:
    """Solar 없이 로컬 데이터 기반 간단 비교"""
    skills_a = set(a.get("skills", []))
    skills_b = set(b.get("skills", []))
    only_a = list(skills_a - skills_b)
    only_b = list(skills_b - skills_a)
    common = list(skills_a & skills_b)

    career_a = a.get("career_years", 0) or 0
    career_b = b.get("career_years", 0) or 0

    return {
        "diff": {
            "경력": {
                "A": f"{career_a}년",
                "B": f"{career_b}년",
                "winner": "A" if career_a > career_b else ("B" if career_b > career_a else "동등"),
            },
            "학력": {
                "A": a.get("education", ""),
                "B": b.get("education", ""),
                "winner": "동등",
            },
            "기술스택": {
                "A": f"공통 {len(common)}개, 고유 {len(only_a)}개",
                "B": f"공통 {len(common)}개, 고유 {len(only_b)}개",
                "winner": "A" if len(only_a) > len(only_b) else ("B" if len(only_b) > len(only_a) else "동등"),
            },
            "공통 스킬": {
                "A": ", ".join(common) or "없음",
                "B": ", ".join(common) or "없음",
            },
            "고유 스킬": {
                "A": ", ".join(only_a) or "없음",
                "B": ", ".join(only_b) or "없음",
            },
        },
        "name_a": a.get("name"),
        "name_b": b.get("name"),
        "solar": False,
    }

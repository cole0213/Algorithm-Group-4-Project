from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from services.solar import CHAT_URL, MODEL, extract_json, TECH_STACK_DEFINITION
from services._solar_http import call_solar_chat
from routers.portfolios import DEFAULT_W_SKILL, DEFAULT_W_CAREER, DEFAULT_W_PROJECT

router = APIRouter(prefix="/api", tags=["utils"])

class ExtractSpecsRequest(BaseModel):
    text: str

@router.post("/extract-specs")
async def extract_specs(req: ExtractSpecsRequest):
    """채용 공고 텍스트에서 필요 기술 스택을 추출합니다 (Solar LLM 사용)."""
    system_prompt = """당신은 채용 공고 분석 전문가입니다.
주어진 채용 공고 텍스트(비정형 자연어)에서 기술 스택을 추출하세요.

반드시 아래 JSON 형식으로만 응답하세요. 설명, 마크다운 코드블럭, 추가 문장 금지:
{"required": ["기술1", "기술2"], "preferred": ["기술3", "기술4"]}

규칙:
- required: 필수 사항으로 명시된 기술 (예: "필수", "필요", "반드시" 등)
- preferred: 우대 사항 기술 (예: "우대", "가산점", "있으면 좋음" 등)
- 어느 분류로도 명확하지 않으면 required로 분류
- 경력 년수, 학력, 소프트스킬 조건은 제외 (오직 기술 스택만 추출)
- 없으면 빈 배열 []
- 아래의 [기술 스택 정의]를 엄격히 따르세요. 카테고리에 없는 항목은 절대 포함하지 마세요.

""" + TECH_STACK_DEFINITION

    content = await call_solar_chat(
        system_prompt,
        req.text[:4000],
        max_tokens=300,
        temperature=0.1,
        timeout=30,
    )

    parsed = extract_json(content)
    if parsed:
        try:
            required = [s.strip() for s in parsed.get("required", []) if isinstance(s, str) and s.strip()]
            preferred = [s.strip() for s in parsed.get("preferred", []) if isinstance(s, str) and s.strip()]
            specs = required + [s for s in preferred if s not in required]
            return {"specs": specs, "specs_text": ", ".join(specs), "required": required, "preferred": preferred}
        except Exception:
            pass

    # 폴백: 쉼표 구분 파싱
    specs = [s.strip() for s in content.replace("\n", ",").split(",") if s.strip() and len(s.strip()) < 40]
    return {"specs": specs, "specs_text": ", ".join(specs), "required": specs, "preferred": []}


# ── AI 설정 자동 생성 엔드포인트 ──────────────────────────────────
# 사용자가 자연어로 "백엔드 채용. Python 필수, AWS 우대. 경력·프로젝트 위주로 보고싶음" 같은
# 문장을 던지면 Solar LLM이 settings JSON으로 변환해 반환한다.

KNOWN_SECTIONS = ["info", "skills", "intro", "timeline", "projects", "awards", "links"]
SECTION_KO = {
    "info": "기본 정보",
    "skills": "기술 스택",
    "intro": "자기소개",
    "timeline": "타임라인",
    "projects": "프로젝트",
    "awards": "수상 및 활동",
    "links": "중요 링크",
}


class ExtractConfigRequest(BaseModel):
    text: str


@router.post("/extract-config")
async def extract_config(req: ExtractConfigRequest):
    """채용 요구사항 + 포폴 목차 자연어를 받아 settings JSON을 반환합니다 (Solar LLM)."""
    sections_desc = ", ".join(f'"{k}"({v})' for k, v in SECTION_KO.items())

    system_prompt = f"""당신은 채용 담당자의 요구사항을 구조화하는 전문가입니다.
사용자가 자연어로 입력한 "채용 요구사항 + 보고 싶은 포트폴리오 항목" 텍스트를 분석하여
아래 JSON 형식으로만 응답하세요. 설명·마크다운·추가 문장 금지.

{{
  "required": ["기술1", "기술2"],
  "preferred": ["기술3"],
  "visible_sections": ["info", "skills", "projects"],
  "weights": {{"skill": 60, "career": 25, "project": 15}},
  "min_career_years": 3,
  "education_keywords": ["대학교", "학사"],
  "position": "backend"
}}

규칙:
- required: 필수 자격 요건으로 명시된 기술 (필수·필요·반드시 등)
- preferred: 우대 사항으로 명시된 기술 (우대·가산점·있으면 좋음 등)
- 어느 분류로도 명확하지 않으면 required로 분류
- 기술 추출 시 아래의 [기술 스택 정의]를 엄격히 따르세요. 정의에 없는 항목(회사명·직무명·소프트스킬·분야명 등)은 절대 포함하지 마세요.
- visible_sections: 포트폴리오에서 보고 싶다고 언급된 섹션. 가능한 키: {sections_desc}
  - 사용자가 "기본정보·기술·프로젝트만" 같이 언급하면 그 키들만 배열에 포함
  - 명시적 언급이 전혀 없으면 전체 6개 키를 모두 포함
  - "자기소개 빼줘" 같은 부정 표현도 반영
- weights: skill+career+project = 100. 기본값 60/25/15.
  - "프로젝트 비중 크게" 같은 표현 있으면 project 가중치 상향 등 자연어 반영
- min_career_years: "경력 N년 이상" 같은 표현에서 N을 정수로 추출. 언급 없으면 null
  - "신입" → 0, "주니어" → 1, "시니어" → 5, "경력 무관" → null
- education_keywords: 학력 조건 키워드 배열. 가능한 값 예: "대학교", "고졸", "전문대", "학사", "석사", "박사", "재학"
  - "대학교 졸업생" / "학사 이상" → ["대학교", "학사"]
  - "석사 이상" → ["석사", "박사"]
  - 언급 없으면 빈 배열 []
- position: 직군. 가능한 값: "frontend" | "backend" | "data" | null
  - "백엔드", "서버" → "backend"
  - "프론트", "FE" → "frontend"
  - "데이터", "ML" → "data"
  - 언급 없거나 풀스택·기타면 null
- 알 수 없으면 기본값 사용

""" + TECH_STACK_DEFINITION

    content = await call_solar_chat(
        system_prompt,
        req.text[:4000],
        max_tokens=400,
        temperature=0.1,
        timeout=30,
    )

    parsed = extract_json(content)

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="Solar 응답 JSON 파싱 실패")

    required = [s.strip() for s in parsed.get("required", []) if isinstance(s, str) and s.strip()]
    preferred = [s.strip() for s in parsed.get("preferred", []) if isinstance(s, str) and s.strip()]
    specs = required + [s for s in preferred if s not in required]

    raw_sections = parsed.get("visible_sections")
    if isinstance(raw_sections, list) and raw_sections:
        visible_sections = [s for s in raw_sections if s in KNOWN_SECTIONS]
        if not visible_sections:
            visible_sections = list(KNOWN_SECTIONS)
    else:
        visible_sections = list(KNOWN_SECTIONS)

    raw_w = parsed.get("weights") or {}
    def _w(key, default):
        v = raw_w.get(key, default)
        try:
            return max(0, min(100, int(v)))
        except Exception:
            return default
    weights = {"skill": _w("skill", DEFAULT_W_SKILL), "career": _w("career", DEFAULT_W_CAREER), "project": _w("project", DEFAULT_W_PROJECT)}
    total = sum(weights.values()) or 1
    if total != 100:
        # 정규화 — 합이 100이 되도록 비례 조정
        weights = {k: round(v * 100 / total) for k, v in weights.items()}
        # 반올림 오차 보정
        diff = 100 - sum(weights.values())
        weights["skill"] += diff

    # 필터 조건 추출
    raw_min_years = parsed.get("min_career_years")
    try:
        min_career_years = int(raw_min_years) if raw_min_years is not None else None
        if min_career_years is not None and min_career_years < 0:
            min_career_years = 0
    except Exception:
        min_career_years = None

    edu_raw = parsed.get("education_keywords")
    education_keywords = [s.strip() for s in edu_raw if isinstance(s, str) and s.strip()] if isinstance(edu_raw, list) else []

    raw_pos = parsed.get("position")
    position = raw_pos if raw_pos in ("frontend", "backend", "data") else None

    return {
        "required": required,
        "preferred": preferred,
        "specs": specs,
        "specs_text": ", ".join(specs),
        "visible_sections": visible_sections,
        "weights": weights,
        "min_career_years": min_career_years,
        "education_keywords": education_keywords,
        "position": position,
    }


# ── Diff 엔드포인트 (2~4명) ─────────────────────────────────────────

from typing import List

LABELS = ["A", "B", "C", "D"]


class DiffRequest(BaseModel):
    ids: List[str]


@router.post("/diff")
async def diff_portfolios(req: DiffRequest):
    """2~4명의 포트폴리오를 Solar LLM으로 비교하여 항목별 차이를 반환합니다."""
    from routers.portfolios import _get_portfolios

    if not (2 <= len(req.ids) <= 4):
        raise HTTPException(status_code=400, detail="비교 인원은 2~4명이어야 합니다.")

    portfolios = _get_portfolios()
    targets = []
    for pid in req.ids:
        p = next((x for x in portfolios if x.get("id") == pid), None)
        if not p:
            raise HTTPException(status_code=404, detail=f"포트폴리오를 찾을 수 없습니다: {pid}")
        targets.append(p)

    labels = LABELS[:len(targets)]
    names = {labels[i]: targets[i].get("name", labels[i]) for i in range(len(targets))}

    api_key = os.getenv("SOLAR_API_KEY") or os.getenv("UPSTAGE_API_KEY")
    if not api_key:
        return _local_diff(targets, labels, names)

    label_keys = ", ".join(f'"{l}": "..."' for l in labels)
    winner_pipe = "|".join(labels) + "|동등"

    profiles = "\n\n".join(
        f"지원자 {labels[i]} ({targets[i].get('name', labels[i])}):\n"
        f"- 경력: {targets[i].get('career_years', 0)}년\n"
        f"- 학력: {targets[i].get('education', '')}\n"
        f"- 스킬: {', '.join(targets[i].get('skills', []))}\n"
        f"- 자기소개: {(targets[i].get('intro', '') or '')[:500]}"
        for i in range(len(targets))
    )

    prompt = f"""{len(targets)}명의 지원자를 다음 항목별로 비교하고 JSON으로 반환하세요:
경력, 학력, 기술스택, 주요프로젝트, 강점, 약점

반드시 아래 JSON 형식으로만 응답하세요:
{{
  "경력":         {{{label_keys}, "winner": "{winner_pipe}"}},
  "학력":         {{{label_keys}, "winner": "{winner_pipe}"}},
  "기술스택":     {{{label_keys}, "winner": "{winner_pipe}"}},
  "주요프로젝트": {{{label_keys}, "winner": "{winner_pipe}"}},
  "강점":         {{{label_keys}}},
  "약점":         {{{label_keys}}}
}}

각 항목의 winner는 가장 우수한 1명의 라벨이거나 "동등".
강점/약점은 winner 필드 없음.

{profiles}"""

    import httpx
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1200,
        "temperature": 0.1,
    }
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(
            CHAT_URL,
            headers=headers, json=body,
        )
    if resp.status_code != 200:
        print(f"[Diff] Solar 오류 {resp.status_code}: {resp.text[:200]}")
        return _local_diff(targets, labels, names)

    try:
        resp_data = resp.json()
        content = resp_data["choices"][0]["message"]["content"].strip()
    except Exception:
        print(f"[Diff] Solar 응답 파싱 실패: {resp.text[:200]}")
        return _local_diff(targets, labels, names)

    diff_data = extract_json(content)
    if diff_data is None:
        print("[Diff] JSON 파싱 실패")
        return _local_diff(targets, labels, names)

    return {"diff": diff_data, "labels": labels, "names": names, "solar": True}


def _local_diff(targets: list, labels: list, names: dict) -> dict:
    """Solar 없이 N명 로컬 비교"""
    skills_sets = [set(t.get("skills", [])) for t in targets]
    common = set.intersection(*skills_sets) if skills_sets else set()
    careers = [t.get("career_years", 0) or 0 for t in targets]

    def _winner_max(vals):
        m = max(vals)
        winners = [labels[i] for i, v in enumerate(vals) if v == m]
        return winners[0] if len(winners) == 1 else "동등"

    skill_counts = [len(s) for s in skills_sets]
    only_counts = [len(skills_sets[i] - set.union(*[skills_sets[j] for j in range(len(targets)) if j != i]) if len(targets) > 1 else skills_sets[i]) for i in range(len(targets))]

    diff = {
        "경력":     {labels[i]: f"{careers[i]}년" for i in range(len(targets))} | {"winner": _winner_max(careers)},
        "학력":     {labels[i]: targets[i].get("education", "") for i in range(len(targets))} | {"winner": "동등"},
        "기술스택": {labels[i]: f"{skill_counts[i]}개 (공통 {len(common)}, 고유 {only_counts[i]})" for i in range(len(targets))} | {"winner": _winner_max(only_counts)},
        "공통 스킬": {labels[i]: ", ".join(sorted(common)) or "없음" for i in range(len(targets))},
        "고유 스킬": {labels[i]: ", ".join(sorted(skills_sets[i] - set.union(*[skills_sets[j] for j in range(len(targets)) if j != i]) if len(targets) > 1 else skills_sets[i])) or "없음" for i in range(len(targets))},
    }
    return {"diff": diff, "labels": labels, "names": names, "solar": False}

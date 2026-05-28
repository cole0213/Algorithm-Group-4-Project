# routers/portfolios.py — 포트폴리오 관련 API 엔드포인트
#
# GET  /api/portfolios               - 전체 포트폴리오 목록
# POST /api/portfolios/add           - 포트폴리오 추가 (파일/텍스트)
# POST /api/analyze                  - 필요 스펙 기반 매칭 점수 + 정렬
# GET  /api/search?q=...&mode=cross  - 키워드 검색 (cross / intra)
# GET  /api/similar                  - 유사 문장 검출

from __future__ import annotations
import os, time, json, hashlib as hashlib_mod
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from difflib import SequenceMatcher

from services.parser import clean_name as _clean_name


# ── 내용 유사도 헬퍼 ─────────────────────────────────────────────

_CONTENT_DUP_THRESHOLD = 0.95  # 95% 이상이면 중복
_CONTENT_DUP_RAW_LIMIT = 10_000  # 내용 유사도 비교 시 원문 절단 길이
_CAREER_SCALE_YEARS = 10.0       # 경력 점수 스케일 기준 (년)
_PROJECT_SCALE_COUNT = 10.0      # 프로젝트 수 점수 스케일 기준 (개)


def _compute_config_version(required_specs: list, weights: dict) -> str:
    """채용 설정의 해시 버전 생성"""
    safe_specs = sorted(s for s in required_specs if isinstance(s, str))
    cfg_str = json.dumps({"specs": safe_specs, "weights": weights}, ensure_ascii=False, sort_keys=True)
    return hashlib_mod.md5(cfg_str.encode()).hexdigest()[:8]


def _normalize_weights_fraction(w: Optional["WeightsModel"]) -> tuple[float, float, float]:
    """WeightsModel → (skill_frac, career_frac, project_frac), all summing to 1.0.
    Falls back to DEFAULT_W_* / 100 if w is None or all zero."""
    if w is not None:
        total = w.skill + w.career + w.project
        if total > 0:
            return (w.skill / total, w.career / total, w.project / total)
    return (DEFAULT_W_SKILL / 100, DEFAULT_W_CAREER / 100, DEFAULT_W_PROJECT / 100)


def _normalize_weights_percent(w: Optional["WeightsModel"]) -> dict:
    """WeightsModel → {'skill': int, 'career': int, 'project': int} summing to 100.
    Falls back to {DEFAULT_W_SKILL, DEFAULT_W_CAREER, DEFAULT_W_PROJECT} if w is None or zero."""
    if w is not None:
        total = w.skill + w.career + w.project
        if total > 0:
            return {
                "skill":   round(w.skill   / total * 100),
                "career":  round(w.career  / total * 100),
                "project": round(w.project / total * 100),
            }
    return {"skill": DEFAULT_W_SKILL, "career": DEFAULT_W_CAREER, "project": DEFAULT_W_PROJECT}


def _find_portfolio(portfolios: list, pid: str) -> Optional[dict]:
    """ID로 포트폴리오 검색."""
    return next((p for p in portfolios if p.get("id") == pid), None)


def _find_portfolio_idx(portfolios: list, pid: str) -> Optional[int]:
    """ID로 포트폴리오 인덱스 검색."""
    return next((i for i, p in enumerate(portfolios) if p.get("id") == pid), None)


def _content_similarity(raw_a: str, raw_b: str) -> float:
    """두 원문의 내용 유사도 (0.0~1.0). difflib.SequenceMatcher 기반."""
    if not raw_a or not raw_b:
        return 0.0
    a = raw_a[:_CONTENT_DUP_RAW_LIMIT]
    b = raw_b[:_CONTENT_DUP_RAW_LIMIT]
    sm = SequenceMatcher(None, a, b, autojunk=False)
    if sm.quick_ratio() < _CONTENT_DUP_THRESHOLD:
        return sm.quick_ratio()
    return sm.ratio()


def _find_content_duplicate(portfolios: list[dict], new_name: str, raw_text: str) -> dict | None:
    """이름이 같은 포트폴리오 중 원문 유사도가 임계값 이상인 첫 항목 반환."""
    if not new_name:
        return None
    for p in portfolios:
        if (p.get("name") or "").strip() != new_name:
            continue
        sim = _content_similarity(raw_text, p.get("_raw", ""))
        if sim >= _CONTENT_DUP_THRESHOLD:
            return {
                "id":         p["id"],
                "name":       p.get("name", ""),
                "similarity": round(sim * 100, 1),
            }
    return None
from services.algorithms.hash_table import SpecMatcher
from services.algorithms.lcs import match_score, matched_skills
from services.algorithms.sort import sort_applicants
from services.algorithms.bst import TextIndex, invalidate_cache as bst_invalidate, get_or_build_bst
from services.algorithms.alias_search import portfolio_matches_query, highlight_positions, _portfolio_text as _portfolio_full_text
from services.algorithms.rabin_karp import detect_similar_response

router = APIRouter(prefix="/api")

# ── 포트폴리오 디렉토리 경로 ─────────────────────────────────────
_PORTFOLIOS_DIR = Path(
    os.getenv("PORTFOLIOS_DIR", "../ui-prototype/portfolios")
)


def _abs_portfolios_dir() -> Path:
    """main.py 기준으로 절대 경로 반환."""
    base = Path(__file__).parent.parent  # backend/
    return (base / _PORTFOLIOS_DIR).resolve()


# ── 세션 파일 경로 ───────────────────────────────────────────────
_SESSION_FILE = Path(__file__).parent.parent / "session.json"

# ── 캐시 (프로세스 수명 내) ─────────────────────────────────────
_portfolio_cache: list[dict] | None = None


def _get_portfolios() -> list[dict]:
    global _portfolio_cache
    if _portfolio_cache is None:
        try:
            data = json.loads(_SESSION_FILE.read_text(encoding="utf-8"))
            _portfolio_cache = data.get("portfolios", [])
            print(f"[Session] session.json에서 {len(_portfolio_cache)}개 로드")
        except Exception as e:
            print(f"[Session] session.json 로드 실패: {e} | 빈 목록으로 시작")
            _portfolio_cache = []
    return _portfolio_cache


def _save_session() -> None:
    """현재 캐시를 session.json에 저장한다."""
    try:
        _SESSION_FILE.write_text(
            json.dumps({"portfolios": _portfolio_cache or []}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        print(f"[Session] 저장 실패: {e}")


# ── 가중치 기본값 (utils.py / 프론트엔드와 동기화 필요) ──────────
DEFAULT_W_SKILL   = 60
DEFAULT_W_CAREER  = 25
DEFAULT_W_PROJECT = 15

# ── 포트폴리오 헬퍼 ──────────────────────────────────────────────

_PORTFOLIO_FIELD_DEFAULTS = [
    ("projects", []), ("awards", []), ("skills", []),
    ("intro", ""), ("career_years", 0),
    ("education", ""), ("email", ""), ("github", ""), ("file", ""),
]


def _ensure_portfolio_defaults(portfolio: dict) -> None:
    for k, default in _PORTFOLIO_FIELD_DEFAULTS:
        if k not in portfolio:
            portfolio[k] = list(default) if isinstance(default, list) else default


def _extract_solar_debug(portfolio: dict) -> dict:
    return {
        "used":      portfolio.get("_solar_used", False),
        "elapsed":   portfolio.pop("_solar_elapsed", None),
        "tokens":    portfolio.pop("_solar_tokens", {}),
        "truncated": portfolio.get("_truncated", False),
    }


# ── 요청/응답 모델 ────────────────────────────────────────────────

class WeightsModel(BaseModel):
    skill:   float = DEFAULT_W_SKILL
    career:  float = DEFAULT_W_CAREER
    project: float = DEFAULT_W_PROJECT


class AnalyzeRequest(BaseModel):
    required_specs: list[str]
    sort_key: str = "match"   # "match" | "career" | "name"
    weights: Optional[WeightsModel] = None


class SummarizeRequest(BaseModel):
    required_specs: list[str] = []
    weights: Optional[WeightsModel] = None


# ── 엔드포인트 ────────────────────────────────────────────────────

@router.get("/portfolios")
def list_portfolios():
    """파싱된 포트폴리오 전체 목록 반환."""
    portfolios = _get_portfolios()
    return {"portfolios": portfolios, "count": len(portfolios)}


@router.post("/portfolios/add")
async def add_portfolio(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    name: Optional[str] = Form(""),
    position: Optional[str] = Form("general"),  # general | frontend | backend | data
    skip_content_check: bool = Form(False),      # True이면 내용 중복 검사 건너뜀
):
    """
    포트폴리오 추가.
    - file: PDF (.pdf) / Markdown (.md) / 텍스트 (.txt) 파일
    - text: 직접 붙여넣은 텍스트
    - name: 지원자 이름 (선택)
    - position: 직군 유형 — general | frontend | backend | data
    모든 형식을 Solar LLM으로 파싱. 실패 시 기본 파서 폴백.
    """
    from services import solar as solar_svc
    from services.parser import extract_pdf_text, parse_text_basic

    raw_text = ""
    filename = ""

    # ── 파일 처리 ──────────────────────────────────────────────────
    if file and file.filename:
        filename = file.filename
        content = await file.read()
        ext = Path(filename).suffix.lower()

        if ext == ".pdf":
            try:
                raw_text = extract_pdf_text(content)
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"PDF 추출 실패: {e}")
        elif ext in (".md", ".txt"):
            raw_text = content.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=415, detail="지원 형식: .pdf, .md, .txt")

    # ── 텍스트 처리 ────────────────────────────────────────────────
    elif text and text.strip():
        raw_text = text.strip()
    else:
        raise HTTPException(status_code=400, detail="file 또는 text 중 하나는 필요합니다.")

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="파싱할 텍스트가 비어 있습니다.")

    # ── ID 생성 ────────────────────────────────────────────────────
    raw_uid = (name or "").strip() or (Path(filename).stem if filename else "")
    uid = _clean_name(raw_uid) if raw_uid else f"upload_{int(time.time())}"
    portfolio: dict = {}
    pos = position or "general"

    # ── 파싱: Solar 우선 (모든 형식), 폴백 기본 파서 ──────────────
    try:
        portfolio = solar_svc.parse_text(raw_text, position=pos)
        portfolio.setdefault("id", uid)
        if name:
            portfolio["name"] = name
    except solar_svc.NotConfiguredError:
        portfolio = parse_text_basic(
            raw_text,
            name=name or (Path(filename).stem if filename else ""),
            uid=uid,
        )
    except Exception as e:
        print(f"[Solar] 파싱 실패: {e} | 기본 파서 사용")
        portfolio = parse_text_basic(raw_text, name=name or "", uid=uid)

    # ── 필수 필드 보완 ─────────────────────────────────────────────
    _ensure_portfolio_defaults(portfolio)

    # ── 캐시에 추가 (중복 ID 방지) ────────────────────────────────
    portfolios = _get_portfolios()
    existing_ids = {p["id"] for p in portfolios}
    if portfolio["id"] in existing_ids:
        portfolio["id"] = f"{portfolio['id']}_{int(time.time())}"

    # ── 원본 텍스트 보존 ───────────────────────────────────────────
    portfolio["_raw"]     = raw_text
    portfolio["_raw_ext"] = Path(filename).suffix.lower().lstrip(".") if filename else "txt"
    portfolio["_position"] = pos
    portfolio["_added_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")

    # ── Solar 디버그 정보 분리 ─────────────────────────────────────
    solar_debug = _extract_solar_debug(portfolio)

    # ── 파일 중복 감지 ─────────────────────────────────────────────
    raw_hash = hashlib_mod.md5(raw_text.encode("utf-8")).hexdigest()
    duplicate_file = any(
        hashlib_mod.md5((p.get("_raw") or "").encode("utf-8")).hexdigest() == raw_hash
        for p in portfolios
    )

    # ── 동명이인 감지 ──────────────────────────────────────────────
    new_name = (portfolio.get("name") or "").strip()
    duplicate_name = new_name and any(
        (p.get("name") or "").strip() == new_name for p in portfolios
    )

    # ── 내용 중복 감지 (이름 일치 + 원문 유사도 ≥ 95%) ──────────────
    content_duplicate = None
    if not skip_content_check:
        content_duplicate = _find_content_duplicate(portfolios, new_name, raw_text)
        if content_duplicate:
            # 저장하지 않고 중복 정보만 반환
            return {
                "message": "content_duplicate",
                "portfolio": portfolio,
                "solar": solar_debug,
                "duplicate_name": duplicate_name,
                "duplicate_file": duplicate_file,
                "content_duplicate": content_duplicate,
            }

    portfolios.append(portfolio)
    _save_session()
    bst_invalidate()

    return {
        "message": "추가 완료",
        "portfolio": portfolio,
        "solar": solar_debug,
        "duplicate_name": duplicate_name,
        "duplicate_file": duplicate_file,
        "content_duplicate": None,
    }


@router.post("/portfolios/{portfolio_id}/reanalyze")
async def reanalyze_portfolio(portfolio_id: str):
    """Solar LLM으로 포트폴리오를 재파싱한다.
    저장된 _raw 원본 텍스트를 다시 Solar에 넘겨 결과를 갱신한다."""
    from services import solar as solar_svc

    portfolios = _get_portfolios()
    idx = _find_portfolio_idx(portfolios, portfolio_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없습니다.")

    existing = portfolios[idx]
    raw_text = existing.get("_raw", "")
    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="원본 텍스트가 없습니다. 재분석 불가.")

    pos = existing.get("_position", "general")

    try:
        portfolio = solar_svc.parse_text(raw_text, position=pos)
    except solar_svc.NotConfiguredError:
        raise HTTPException(status_code=503, detail="Solar API 키가 설정되지 않았습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solar 파싱 실패: {e}")

    # 기존 메타 보존
    portfolio["id"]        = portfolio_id
    portfolio["_raw"]      = raw_text
    portfolio["_raw_ext"]  = existing.get("_raw_ext", "txt")
    portfolio["_position"] = pos
    portfolio["_added_at"] = existing.get("_added_at", "")

    _ensure_portfolio_defaults(portfolio)
    solar_debug = _extract_solar_debug(portfolio)

    portfolios[idx] = portfolio
    _save_session()
    bst_invalidate()

    return {"message": "재분석 완료", "portfolio": portfolio, "solar": solar_debug}


@router.post("/portfolios/summarize-all")
async def summarize_all_portfolios(req: SummarizeRequest):
    """채용 설정 기준으로 모든 포트폴리오를 AI 요약한다."""
    from services import solar as solar_svc

    portfolios = _get_portfolios()

    w_dict = _normalize_weights_percent(req.weights)

    config_version = _compute_config_version(req.required_specs, w_dict)
    job_config = {
        "specs_text": ", ".join(req.required_specs),
        "required_specs": req.required_specs,
    }

    try:
        solar_svc._headers()
    except solar_svc.NotConfiguredError:
        raise HTTPException(status_code=503, detail="Solar API 키가 설정되지 않았습니다.")

    results = []
    for p in portfolios:
        pid = p.get("id", "")
        raw_text = p.get("_raw", "")
        if not raw_text.strip():
            results.append({"id": pid, "skipped": True})
            continue
        pos = p.get("_position", "general")
        try:
            result = solar_svc.summarize_text(raw_text, position=pos, job_config=job_config)
            p["_summary"] = result["summary"]
            p["_summary_config_version"] = config_version
            results.append({"id": pid, "elapsed": result["elapsed"]})
        except Exception as e:
            print(f"[Summarize] {pid} 실패: {e}")
            results.append({"id": pid, "error": str(e)})

    _save_session()
    return {"results": results, "config_version": config_version, "total": len(results)}


@router.post("/portfolios/{portfolio_id}/summarize")
async def summarize_portfolio(portfolio_id: str, req: SummarizeRequest):
    """채용 설정 기준으로 단일 포트폴리오를 AI 요약한다."""
    from services import solar as solar_svc

    portfolios = _get_portfolios()
    idx = _find_portfolio_idx(portfolios, portfolio_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없습니다.")

    existing = portfolios[idx]
    raw_text = existing.get("_raw", "")
    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="원본 텍스트가 없습니다. 요약 불가.")

    pos = existing.get("_position", "general")

    w_dict = _normalize_weights_percent(req.weights)

    config_version = _compute_config_version(req.required_specs, w_dict)
    job_config = {
        "specs_text": ", ".join(req.required_specs),
        "required_specs": req.required_specs,
    }

    try:
        result = solar_svc.summarize_text(raw_text, position=pos, job_config=job_config)
    except solar_svc.NotConfiguredError:
        raise HTTPException(status_code=503, detail="Solar API 키가 설정되지 않았습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"요약 실패: {e}")

    existing["_summary"] = result["summary"]
    existing["_summary_config_version"] = config_version
    _save_session()

    return {
        "summary": result["summary"],
        "elapsed": result["elapsed"],
        "config_version": config_version,
    }


@router.get("/portfolios/{portfolio_id}/raw")
def get_raw(portfolio_id: str):
    """포트폴리오 원본 텍스트 반환."""
    portfolios = _get_portfolios()
    p = _find_portfolio(portfolios, portfolio_id)
    if not p:
        raise HTTPException(status_code=404, detail="포트폴리오 없음")

    # 업로드된 포트폴리오 (raw_text 보존됨)
    if "_raw" in p:
        return {"raw": p["_raw"], "ext": p.get("_raw_ext", "txt")}

    # 파일 기반 MD (시작 시 로드된 포트폴리오)
    if p.get("file"):
        path = Path(p["file"])
        if path.exists():
            return {"raw": path.read_text(encoding="utf-8"), "ext": "md"}

    raise HTTPException(status_code=404, detail="원본 없음")


@router.get("/portfolios/export")
def export_portfolios():
    """현재 포트폴리오 전체를 JSON으로 내보내기."""
    from fastapi.responses import JSONResponse
    portfolios = _get_portfolios()
    # _raw, _raw_ext 등 내부 필드 포함하여 내보냄 (복원 가능)
    return JSONResponse(
        content={"portfolios": portfolios, "version": 1},
        headers={"Content-Disposition": "attachment; filename=portfolios_export.json"},
    )


@router.post("/portfolios/import")
async def import_portfolios(
    file: UploadFile = File(...),
    mode: str = Form("overwrite"),
):
    """JSON 파일로 포트폴리오 불러오기.
    mode="overwrite" : 중복 ID는 기존 항목을 교체, 나머지는 유지.
    mode="reset"     : 기존 포트폴리오 전체 삭제 후 파일 내용으로 교체.
    """
    global _portfolio_cache
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=422, detail="유효하지 않은 JSON 파일")

    imported = data.get("portfolios", [])
    if not isinstance(imported, list):
        raise HTTPException(status_code=422, detail="portfolios 배열이 없습니다.")
    imported = [p for p in imported if isinstance(p, dict) and "id" in p]
    imported_settings = data.get("settings", None)

    if mode == "reset":
        _portfolio_cache = imported
        _save_session()
        bst_invalidate()
        return {"message": f"초기화 후 {len(imported)}개 불러오기 완료", "total": len(imported), "settings": imported_settings}

    # mode == "overwrite"
    portfolios = _get_portfolios()
    existing_map = {p["id"]: i for i, p in enumerate(portfolios)}
    added = 0
    overwritten = 0
    for p in imported:
        pid = p["id"]
        if pid in existing_map:
            portfolios[existing_map[pid]] = p
            overwritten += 1
        else:
            portfolios.append(p)
            existing_map[pid] = len(portfolios) - 1
            added += 1

    _save_session()
    bst_invalidate()
    parts = []
    if added:       parts.append(f"{added}개 추가")
    if overwritten: parts.append(f"{overwritten}개 덮어쓰기")
    return {"message": f"{', '.join(parts)} 완료", "total": len(portfolios), "added": added, "overwritten": overwritten, "settings": imported_settings}


@router.patch("/portfolios/{portfolio_id}/name")
def rename_portfolio(portfolio_id: str, body: dict):
    """지원자 이름 변경."""
    new_name = (body.get("name") or "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="이름을 입력해주세요.")
    portfolios = _get_portfolios()
    p = _find_portfolio(portfolios, portfolio_id)
    if not p:
        raise HTTPException(status_code=404, detail="포트폴리오 없음")
    p["name"] = new_name
    _save_session()
    return {"message": "이름 변경 완료", "id": portfolio_id, "name": new_name}


@router.delete("/portfolios/{portfolio_id}")
def delete_portfolio(portfolio_id: str):
    """포트폴리오 삭제."""
    portfolios = _get_portfolios()
    idx = _find_portfolio_idx(portfolios, portfolio_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="포트폴리오 없음")
    portfolios.pop(idx)
    _save_session()
    bst_invalidate()
    return {"message": "삭제 완료", "id": portfolio_id}


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    """
    필요 스펙 입력 → 각 지원자에 대해:
    - hash_table로 O(1) 스킬 매칭 여부
    - LCS로 매칭 점수 산출
    - 가중치(skill/career/project)를 반영한 종합 점수 계산
    - 요청 기준으로 정렬
    """
    portfolios = _get_portfolios()
    matcher = SpecMatcher(req.required_specs)

    # 가중치 정규화 (합계가 0이 되지 않도록 보호)
    w_skill, w_career, w_project = _normalize_weights_fraction(req.weights)

    current_config_version = _compute_config_version(req.required_specs, {
        "skill": round(w_skill * 100),
        "career": round(w_career * 100),
        "project": round(w_project * 100),
    })

    results = []
    for p in portfolios:
        # LCS 기반 스킬 매칭 점수 (0–100)
        skill_score = match_score(req.required_specs, p.get("skills", []))
        skills_match = matcher.match_skills(p["skills"])
        matched = matched_skills(req.required_specs, p["skills"])

        # 경력 점수: career_years를 최대 10년 기준으로 0–100 스케일
        career_years = float(p.get("career_years") or 0)
        career_score = min(career_years / _CAREER_SCALE_YEARS, 1.0) * 100

        # 프로젝트 수 점수: 최대 10개 기준으로 0–100 스케일
        project_count = len(p.get("projects") or [])
        project_score = min(project_count / _PROJECT_SCALE_COUNT, 1.0) * 100

        # 가중 합산 점수
        weighted_score = round(
            skill_score   * w_skill +
            career_score  * w_career +
            project_score * w_project
        )

        p_config_version = p.get("_config_version", None)
        is_legacy = p_config_version is not None and p_config_version != current_config_version

        results.append({
            **p,
            "match_score": weighted_score,
            "skill_score": skill_score,
            "career_score": round(career_score),
            "project_score": round(project_score),
            "skills_match": skills_match,   # { "React": True, "Vue": False, ... }
            "matched_skills": matched,
            "_config_version": current_config_version,
            "_is_legacy": is_legacy,
        })

    sorted_results = sort_applicants(results, req.sort_key)
    return {
        "required_specs": req.required_specs,
        "sort_key": req.sort_key,
        "portfolios": sorted_results,
    }


@router.get("/search")
def search(
    q: str = Query(..., description="검색 키워드"),
    mode: str = Query("cross", description="cross | intra"),
    portfolio_id: str | None = Query(None, description="intra 모드 시 대상 포트폴리오 ID"),
):
    """
    cross 모드: BST로 키워드를 가진 지원자 ID 목록 반환
    intra 모드: TextIndex로 특정 포트폴리오 내 키워드 위치 반환
    """
    portfolios = _get_portfolios()

    if mode == "cross":
        # alias_search로 확장된 쿼리로 필터링
        matched_ids = [
            p["id"] for p in portfolios
            if portfolio_matches_query(p, q)
        ]
        # BST 인덱스로 결과 재검증 (성능 시연용) — 캐시 활용
        idx = get_or_build_bst(portfolios)
        bst_ids = idx.search(q)
        # 두 결과 합집합 (alias_search가 더 넓게 탐지)
        all_ids = list(dict.fromkeys(matched_ids + bst_ids))
        return {"mode": "cross", "query": q, "matched_ids": all_ids}

    elif mode == "intra":
        if not portfolio_id:
            raise HTTPException(status_code=400, detail="intra 모드는 portfolio_id 필요")
        target = _find_portfolio(portfolios, portfolio_id)
        if not target:
            raise HTTPException(status_code=404, detail=f"포트폴리오 '{portfolio_id}' 없음")

        full_text = _portfolio_full_text(target)
        positions = highlight_positions(full_text, q)
        text_idx = TextIndex(full_text)
        contexts = text_idx.search_context(q)

        return {
            "mode": "intra",
            "query": q,
            "portfolio_id": portfolio_id,
            "positions": [{"start": s, "end": e} for s, e in positions],
            "contexts": contexts,
        }

    raise HTTPException(status_code=400, detail="mode는 'cross' 또는 'intra'")


@router.get("/similar")
def similar(ids: str | None = Query(None, description="쉼표 구분 포트폴리오 ID (없으면 전체)")):
    """Rabin-Karp + LCS로 포트폴리오 간 유사 문장 검출.
    ids 파라미터로 비교 대상을 특정 포트폴리오로 제한할 수 있다."""
    portfolios = _get_portfolios()
    if ids:
        id_set = set(i.strip() for i in ids.split(',') if i.strip())
        portfolios = [p for p in portfolios if p["id"] in id_set]
    spans = detect_similar_response(portfolios)
    return {"spans": spans, "count": len(spans)}



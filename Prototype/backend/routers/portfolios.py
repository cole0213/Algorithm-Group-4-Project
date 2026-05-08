# routers/portfolios.py — 포트폴리오 관련 API 엔드포인트
#
# GET  /api/portfolios               - 전체 포트폴리오 목록
# POST /api/portfolios/add           - 포트폴리오 추가 (파일/텍스트)
# POST /api/analyze                  - 필요 스펙 기반 매칭 점수 + 정렬
# GET  /api/search?q=...&mode=cross  - 키워드 검색 (cross / intra)
# GET  /api/similar                  - 유사 문장 검출

from __future__ import annotations
import os, time, json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from services import parser as parser_svc
from services.algorithms.hash_table import SpecMatcher
from services.algorithms.lcs import match_score, matched_skills
from services.algorithms.sort import sort_applicants
from services.algorithms.bst import ApplicantIndex, TextIndex
from services.algorithms.alias_search import portfolio_matches_query, highlight_positions
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
            print(f"[Session] session.json 로드 실패: {e} — 빈 목록으로 시작")
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


# ── 요청/응답 모델 ────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    required_specs: list[str]
    sort_key: str = "match"   # "match" | "career" | "name"


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
    uid = (name or "").strip() or (Path(filename).stem if filename else f"upload_{int(time.time())}")
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
        print(f"[Solar] 파싱 실패: {e} — 기본 파서 사용")
        portfolio = parse_text_basic(raw_text, name=name or "", uid=uid)

    # ── 필수 필드 보완 ─────────────────────────────────────────────
    for k, default in [
        ("projects", []), ("awards", []), ("skills", []),
        ("intro", ""), ("career_years", 0),
        ("education", ""), ("email", ""), ("github", ""), ("file", ""),
    ]:
        portfolio.setdefault(k, default)

    # ── 캐시에 추가 (중복 ID 방지) ────────────────────────────────
    portfolios = _get_portfolios()
    existing_ids = {p["id"] for p in portfolios}
    if portfolio["id"] in existing_ids:
        portfolio["id"] = f"{portfolio['id']}_{int(time.time())}"

    # ── 원본 텍스트 보존 ───────────────────────────────────────────
    portfolio["_raw"]     = raw_text
    portfolio["_raw_ext"] = Path(filename).suffix.lower().lstrip(".") if filename else "txt"
    portfolio["_position"] = pos

    # ── Solar 디버그 정보 분리 ─────────────────────────────────────
    solar_debug = {
        "used":      portfolio.get("_solar_used", False),
        "elapsed":   portfolio.pop("_solar_elapsed", None),
        "tokens":    portfolio.pop("_solar_tokens",  {}),
        "truncated": portfolio.get("_truncated", False),
    }

    portfolios.append(portfolio)
    _save_session()

    return {"message": "추가 완료", "portfolio": portfolio, "solar": solar_debug}


@router.get("/portfolios/{portfolio_id}/raw")
def get_raw(portfolio_id: str):
    """포트폴리오 원본 텍스트 반환."""
    portfolios = _get_portfolios()
    p = next((x for x in portfolios if x["id"] == portfolio_id), None)
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
async def import_portfolios(file: UploadFile = File(...)):
    """JSON 파일로 포트폴리오 불러오기 (기존 목록에 병합)."""
    global _portfolio_cache
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=422, detail="유효하지 않은 JSON 파일")

    imported = data.get("portfolios", [])
    if not isinstance(imported, list):
        raise HTTPException(status_code=422, detail="portfolios 배열이 없습니다.")

    portfolios = _get_portfolios()
    existing_ids = {p["id"] for p in portfolios}
    added = 0
    for p in imported:
        if not isinstance(p, dict) or "id" not in p:
            continue
        pid = p["id"]
        if pid in existing_ids:
            pid = f"{pid}_{int(time.time())}"
            p["id"] = pid
        portfolios.append(p)
        existing_ids.add(pid)
        added += 1

    _save_session()
    return {"message": f"{added}개 불러오기 완료", "total": len(portfolios)}


@router.delete("/portfolios/{portfolio_id}")
def delete_portfolio(portfolio_id: str):
    """포트폴리오 삭제."""
    portfolios = _get_portfolios()
    idx = next((i for i, p in enumerate(portfolios) if p["id"] == portfolio_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="포트폴리오 없음")
    portfolios.pop(idx)
    _save_session()
    return {"message": "삭제 완료", "id": portfolio_id}


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    """
    필요 스펙 입력 → 각 지원자에 대해:
    - hash_table로 O(1) 스킬 매칭 여부
    - LCS로 매칭 점수 산출
    - 요청 기준으로 정렬
    """
    portfolios = _get_portfolios()
    matcher = SpecMatcher(req.required_specs)

    results = []
    for p in portfolios:
        score = match_score(req.required_specs, p["skills"])
        skills_match = matcher.match_skills(p["skills"])
        matched = matched_skills(req.required_specs, p["skills"])

        results.append({
            **p,
            "match_score": score,
            "skills_match": skills_match,   # { "React": True, "Vue": False, ... }
            "matched_skills": matched,
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
        # BST 인덱스로 결과 재검증 (성능 시연용)
        idx = ApplicantIndex.build(portfolios)
        bst_ids = idx.search(q)
        # 두 결과 합집합 (alias_search가 더 넓게 탐지)
        all_ids = list(dict.fromkeys(matched_ids + bst_ids))
        return {"mode": "cross", "query": q, "matched_ids": all_ids}

    elif mode == "intra":
        if not portfolio_id:
            raise HTTPException(status_code=400, detail="intra 모드는 portfolio_id 필요")
        target = next((p for p in portfolios if p["id"] == portfolio_id), None)
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


# ── 헬퍼 ─────────────────────────────────────────────────────────

def _portfolio_full_text(p: dict) -> str:
    parts = [p.get("intro", "")]
    for proj in p.get("projects", []):
        parts.append(proj.get("desc", ""))
        parts.append(proj.get("stack", ""))
    parts.extend(p.get("awards", []))
    return " ".join(parts)

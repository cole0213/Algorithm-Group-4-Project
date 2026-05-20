# parser.py — MD 포트폴리오 파일 → 구조화된 딕셔너리 파싱
#
# MD 포맷 (ui-prototype/portfolios/*.md):
#   # 이름 포트폴리오
#   ## 기본 정보  (표: 이름/이메일/GitHub/경력/학력)
#   ## 기술 스택  (쉼표 구분 텍스트)
#   ## 자기소개   (단락)
#   ## 프로젝트   (### 프로젝트명 (날짜) + 불릿)
#   ## 수상 및 활동 (불릿)

from __future__ import annotations
import os
import re
from pathlib import Path


def parse_md(filepath: str | Path) -> dict:
    """단일 MD 파일을 파싱하여 포트폴리오 딕셔너리 반환."""
    text = Path(filepath).read_text(encoding="utf-8")
    lines = text.splitlines()

    portfolio: dict = {
        "id": Path(filepath).stem,       # 파일명 = ID (예: 김지수)
        "name": "",
        "email": "",
        "github": "",
        "career_years": 0,
        "education": "",
        "skills": [],
        "intro": "",
        "projects": [],
        "awards": [],
        "file": str(filepath),
    }

    section = None
    project_buf: dict | None = None
    intro_lines: list[str] = []

    for line in lines:
        stripped = line.strip()

        # ── H1: 이름 ──────────────────────────────────────────────
        if stripped.startswith("# ") and not stripped.startswith("## "):
            portfolio["name"] = stripped[2:].replace("포트폴리오", "").strip()
            continue

        # ── 섹션 전환 ─────────────────────────────────────────────
        if stripped.startswith("## "):
            # 이전 프로젝트 버퍼 flush
            if project_buf:
                portfolio["projects"].append(project_buf)
                project_buf = None
            # intro 버퍼 flush
            if intro_lines:
                portfolio["intro"] = "\n".join(intro_lines).strip()
                intro_lines = []

            title = stripped[3:].strip()
            if "기본" in title:
                section = "info"
            elif "기술" in title:
                section = "skills"
            elif "자기소개" in title:
                section = "intro"
            elif "프로젝트" in title:
                section = "projects"
            elif "수상" in title or "활동" in title:
                section = "awards"
            else:
                section = None
            continue

        # ── 각 섹션 파싱 ─────────────────────────────────────────
        if section == "info":
            # 마크다운 표 행: | 항목 | 내용 |
            if stripped.startswith("|") and not set(stripped) <= set("|-: "):
                cells = [c.strip() for c in stripped.split("|") if c.strip()]
                if len(cells) >= 2:
                    key, val = cells[0], cells[1]
                    if "이메일" in key:
                        portfolio["email"] = val
                    elif "GitHub" in key or "github" in key.lower():
                        portfolio["github"] = val
                    elif "경력" in key:
                        portfolio["career_years"] = _parse_years(val)
                    elif "학력" in key:
                        portfolio["education"] = val

        elif section == "skills":
            if stripped and not stripped.startswith("#"):
                raw = stripped.replace("，", ",")  # 전각 쉼표 대응
                portfolio["skills"] = [s.strip() for s in raw.split(",") if s.strip()]

        elif section == "intro":
            if stripped and not stripped.startswith("#"):
                intro_lines.append(stripped)

        elif section == "projects":
            # H3: 새 프로젝트 시작
            if stripped.startswith("### "):
                if project_buf:
                    portfolio["projects"].append(project_buf)
                project_buf = {"name": "", "period": "", "role": "", "stack": "", "desc": ""}
                # "### 프로젝트명 (기간)" 파싱
                h3 = stripped[4:].strip()
                m = re.match(r"^(.+?)\s*\((.+?)\)\s*$", h3)
                if m:
                    project_buf["name"] = m.group(1).strip()
                    project_buf["period"] = m.group(2).strip()
                else:
                    project_buf["name"] = h3

            elif project_buf and stripped.startswith("- "):
                content = stripped[2:].strip()
                # **역할**: / **기술**: / **내용**:
                m = re.match(r"\*\*(.+?)\*\*\s*:\s*(.+)", content)
                if m:
                    label, val = m.group(1), m.group(2)
                    if "역할" in label:
                        project_buf["role"] = val
                    elif "기술" in label:
                        project_buf["stack"] = val
                    elif "내용" in label:
                        project_buf["desc"] = val

        elif section == "awards":
            if stripped.startswith("- "):
                portfolio["awards"].append(stripped[2:].strip())

    # 잔여 버퍼 flush
    if project_buf:
        portfolio["projects"].append(project_buf)
    if intro_lines and not portfolio["intro"]:
        portfolio["intro"] = "\n".join(intro_lines).strip()

    return portfolio


def load_all(portfolios_dir: str | Path) -> list[dict]:
    """디렉토리 내 모든 .md 파일을 파싱하여 리스트로 반환."""
    base = Path(portfolios_dir)
    result = []
    for md_file in sorted(base.glob("*.md")):
        try:
            result.append(parse_md(md_file))
        except Exception as exc:
            print(f"[parser] {md_file.name} 파싱 오류: {exc}")
    return result


def _parse_years(text: str) -> int:
    """'3년', '3년 6개월' 등에서 정수 연수 추출."""
    m = re.search(r"(\d+)\s*년", text)
    return int(m.group(1)) if m else 0


# ── PDF 텍스트 추출 ────────────────────────────────────────────────

def extract_pdf_text(file_bytes: bytes) -> str:
    """pdfplumber로 PDF 바이트를 텍스트로 변환."""
    import io
    import pdfplumber
    pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n\n".join(pages)


# ── 기본 텍스트 파서 (Solar 없을 때 폴백) ────────────────────────

def parse_text_basic(text: str, name: str = "", uid: str = "") -> dict:
    """
    Solar 없이 정규식으로 포트폴리오 텍스트를 간단히 파싱.
    alias_map의 알려진 기술명을 텍스트에서 스캔해 skills 추출.
    """
    import time
    from .algorithms.alias_map import ALIAS_MAP

    portfolio: dict = {
        "id":           uid or name.strip() or f"upload_{int(time.time())}",
        "name":         name.strip() or "업로드된 포트폴리오",
        "email":        "",
        "github":       "",
        "career_years": 0,
        "education":    "",
        "skills":       [],
        "intro":        "",
        "projects":     [],
        "awards":       [],
        "file":         "",
    }

    # 이메일
    m = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", text)
    if m:
        portfolio["email"] = m.group()

    # GitHub
    m = re.search(r"github\.com/[\w.-]+", text, re.I)
    if m:
        portfolio["github"] = m.group()

    # 경력
    m = re.search(r"(\d+)\s*년\s*(?:경력|차)?", text)
    if m:
        portfolio["career_years"] = int(m.group(1))

    # 학력
    m = re.search(r"([가-힣A-Za-z\s]+(?:대학교|대학|University|College)[^\n,·]*)", text, re.I)
    if m:
        portfolio["education"] = m.group(1).strip()[:80]

    # 기술 스택 (alias_map 기반 탐색)
    text_lower = text.lower()
    found: set[str] = set()
    for canonical, aliases in ALIAS_MAP.items():
        for alias in aliases:
            pat = r"(?<![a-z가-힣])" + re.escape(alias) + r"(?![a-z가-힣])"
            if re.search(pat, text_lower):
                # 표시명: alias_map에서 첫 번째 영소문자 단어 → 제목 케이스
                display = next(
                    (a for a in aliases if re.fullmatch(r"[a-z][a-z0-9.+\-#]*", a) and len(a) > 1),
                    canonical,
                )
                found.add(display[0].upper() + display[1:])
                break
    portfolio["skills"] = sorted(found)

    # 자기소개: 가장 긴 문단
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if len(p.strip()) > 40]
    if paragraphs:
        portfolio["intro"] = max(paragraphs, key=len)[:600]

    return portfolio

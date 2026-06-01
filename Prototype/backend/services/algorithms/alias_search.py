# alias_search.py — 알고리즘 #7 (별칭 해시맵 + Edit Distance)
# 검색어 입력 시 alias_map 동의어 + edit_distance 오타 허용으로 통합 검색
# (use_alias 토글로 동의어·오타 흡수를 끌 수 있다)
#
# 사용처: routers/portfolios.py (search 엔드포인트)

from __future__ import annotations
import re
from .alias_map import ALIAS_MAP, normalize, get_aliases
from .edit_distance import edit_distance
from ._common import merge_ranges

# 길이 3 미만 토큰을 자유 텍스트에서 substring 검색하면 오탐 폭발.
# (예: "py" -> "google" 안에 'g','o' 없음이지만, "c","r" 등은 영문에 거의 항상 등장)
# → 짧은 토큰은 단어 경계 매칭(_short_token_in_text)으로만 허용.
_SHORT_TOKEN_LEN = 3
_WORD_BOUNDARY_LR = r'(?<![a-zA-Z0-9가-힣])'   # 좌측: 영숫자·한글 아님
_WORD_BOUNDARY_RR = r'(?![a-zA-Z0-9가-힣])'     # 우측: 영숫자·한글 아님


def _short_token_in_text(token: str, text: str) -> bool:
    """짧은 토큰을 단어 경계 기준으로 검사 (대소문자 무시)."""
    pattern = _WORD_BOUNDARY_LR + re.escape(token) + _WORD_BOUNDARY_RR
    return re.search(pattern, text, flags=re.IGNORECASE) is not None

# ── 오타 허용 정책 ────────────────────────────────────────────
# ED 기반 오타 흡수는 다음 조건을 모두 만족할 때만 동작:
#   1) 쿼리 길이 >= _MIN_TYPO_LEN
#   2) 별칭 길이 >= _MIN_TYPO_LEN  (짧은 별칭 'go','js','ts',… 와의 충돌 방지)
#   3) 길이차 <= _MAX_LEN_DIFF
#   4) ED <= 임계값 (길이에 따라 1 또는 2)
# 매치된 별칭은 그 별칭이 속한 canonical 그룹 전체로 확장 → 그룹 단위 검색.
_MIN_TYPO_LEN  = 4
_MAX_LEN_DIFF  = 2


def _typo_threshold(n: int) -> int:
    """길이에 따른 ED 허용 임계값. 짧은 단어일수록 엄격."""
    return 1 if n <= 5 else 2


def expand_query(query: str) -> list[str]:
    """
    검색어를 동의어 + 오타 허용 목록으로 확장.

    단계:
    1. alias_map에서 정규 키 → 별칭 목록 O(1) 조회
    2. 쿼리/별칭이 충분히 길 때만 edit distance 흡수 (짧은 별칭 충돌 방지)
    3. ED 매칭 시 별칭 단독이 아니라 그 별칭이 속한 canonical 그룹 전체를 추가
    4. 중복 제거 후 반환

    예:
        "파이선"      → python 그룹 (alias_map에 등록됨, ED 안 거침)
        "typscript"  → typescript 그룹 (ED=1로 typescript 매치)
        "py"         → python 그룹만 (짧으므로 ED 흡수 없음)
        "go"         → go 그룹만 (golang, ".go", "고랭" 포함, py/js 등 누수 없음)
    """
    q = query.lower().strip()
    canonical = normalize(q)
    base_aliases = get_aliases(canonical)       # O(1) alias 조회
    result: set[str] = set(base_aliases)

    # 짧은 쿼리는 ED 흡수 비활성화 → 짧은 별칭들과 충돌 방지
    if len(q) < _MIN_TYPO_LEN:
        return list(result)

    # 오타 흡수: 길이가 충분한 별칭하고만 ED 비교
    for aliases in ALIAS_MAP.values():
        for alias in aliases:
            if len(alias) < _MIN_TYPO_LEN:
                continue
            if abs(len(alias) - len(q)) > _MAX_LEN_DIFF:
                continue
            if edit_distance(q, alias) <= _typo_threshold(min(len(q), len(alias))):
                # 매치된 별칭의 그룹 전체를 추가 (개별 별칭만 넣으면 누락 발생)
                result.update(aliases)
                break  # 같은 그룹의 다른 별칭은 더 볼 필요 없음

    return list(result)


def portfolio_matches_query(portfolio: dict, query: str, use_alias: bool = True) -> bool:
    """
    포트폴리오가 검색어 또는 그 동의어/오타 변형에 해당하는 기술을 갖는지 확인.

    use_alias=False면 동의어·오타 흡수 없이 입력 쿼리만으로 검색
    (별칭 통합 검색 토글 OFF 시 동작).

    skills 목록 + 텍스트(name, career_years, education, intro, project descriptions) 모두 검사.
    """
    q = query.strip().lower()
    if not q:
        return False

    if use_alias:
        targets = expand_query(query)
        target_set = {normalize(t) for t in targets}
        skill_matches = lambda s: normalize(s) in target_set
    else:
        # 토글 OFF: 입력 쿼리 그대로, alias 정규화 없음 (lowercase 비교만)
        targets = [q]
        target_set = {q}
        skill_matches = lambda s: s.strip().lower() == q

    # 기술 스택 매칭
    for skill in portfolio.get("skills", []):
        if skill_matches(skill):
            return True

    # 이름 검색: 띄어쓰기 제거 후 비교 (예: "임 재 현" → "임재현")
    name_raw = portfolio.get("name", "")
    name_nospace = name_raw.replace(" ", "").lower()
    q_nospace = query.replace(" ", "").lower()
    if q_nospace and q_nospace in name_nospace:
        return True

    # 자유 텍스트도 검색 — 짧은 토큰은 단어 경계 매칭으로 오탐 방지
    full_text = _portfolio_text(portfolio).lower()
    for t in targets:
        if len(t) >= _SHORT_TOKEN_LEN:
            if t in full_text:
                return True
        else:
            if _short_token_in_text(t, full_text):
                return True

    # 숫자 직접 검색 (경력 N년, 등)
    career = str(portfolio.get("career_years", ""))
    if query.strip() == career:
        return True

    return False


def highlight_positions(text: str, query: str) -> list[tuple[int, int]]:
    """
    텍스트에서 검색어(및 동의어)가 등장하는 (시작, 끝) 위치 목록 반환.
    intra-portfolio 하이라이트에 활용.
    """
    targets = expand_query(query)
    positions: list[tuple[int, int]] = []
    lower_text = text.lower()

    for t in targets:
        start = 0
        while True:
            idx = lower_text.find(t, start)
            if idx == -1:
                break
            positions.append((idx, idx + len(t)))
            start = idx + 1

    # 겹치는 구간 병합
    return merge_ranges(positions)


def _portfolio_text(portfolio: dict) -> str:
    parts = [
        portfolio.get("name", ""),
        portfolio.get("education", ""),
        str(portfolio.get("career_years", "")),
        portfolio.get("intro", ""),
    ]
    for proj in portfolio.get("projects", []):
        parts.append(proj.get("name", ""))
        parts.append(proj.get("stack", ""))
        parts.append(proj.get("desc", ""))
    parts.extend(portfolio.get("awards", []))
    return " ".join(filter(None, parts))

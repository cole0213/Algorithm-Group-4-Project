# alias_search.py — 알고리즘 #7 (별칭 해시맵 + Edit Distance)
# 검색어 입력 시 alias_map 동의어 + edit_distance 오타 허용으로 통합 검색
#
# 사용처: routers/portfolios.py (search 엔드포인트)

from __future__ import annotations
from .alias_map import ALIAS_MAP, normalize, get_aliases
from .edit_distance import edit_distance

# 오타 허용 임계값 (이하이면 매칭)
_TYPO_THRESHOLD = 2


def expand_query(query: str) -> list[str]:
    """
    검색어를 동의어 + 오타 허용 목록으로 확장.

    단계:
    1. alias_map에서 정규 키 → 별칭 목록 O(1) 조회
    2. 각 별칭에 대해 모든 알려진 별칭과 edit distance 비교,
       임계값 이하인 항목도 추가
    3. 중복 제거 후 반환

    예: "파이선" → ["py", "파이썬", "파이선", "python", ".py", "python3"]
    """
    canonical = normalize(query)
    base_aliases = get_aliases(canonical)       # O(1) alias 조회
    result: set[str] = set(base_aliases)

    # 오타 흡수: 모든 알려진 별칭에 대해 거리 비교
    for aliases in ALIAS_MAP.values():
        for alias in aliases:
            if edit_distance(query.lower(), alias) <= _TYPO_THRESHOLD:
                result.add(alias)

    return list(result)


def portfolio_matches_query(portfolio: dict, query: str) -> bool:
    """
    포트폴리오가 검색어 또는 그 동의어/오타 변형에 해당하는 기술을 갖는지 확인.
    skills 목록 + 텍스트(intro, project descriptions) 모두 검사.
    """
    targets = expand_query(query)
    target_set = {normalize(t) for t in targets}

    # 기술 스택에서 O(1) 해시 조회
    for skill in portfolio.get("skills", []):
        if normalize(skill) in target_set:
            return True

    # 자유 텍스트(intro + project stack 설명)도 검색
    full_text = _portfolio_text(portfolio).lower()
    for t in targets:
        if t in full_text:
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
    positions.sort()
    merged: list[tuple[int, int]] = []
    for s, e in positions:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))

    return merged


def _portfolio_text(portfolio: dict) -> str:
    parts = [portfolio.get("intro", "")]
    for proj in portfolio.get("projects", []):
        parts.append(proj.get("stack", ""))
        parts.append(proj.get("desc", ""))
    return " ".join(parts)

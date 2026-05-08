# sort.py — 알고리즘 #5
# 매칭률 / 경력 / 이름 기준 지원자 정렬
#
# 사용처: routers/portfolios.py

from __future__ import annotations
from typing import Any


def sort_applicants(
    applicants: list[dict[str, Any]],
    key: str = "match",
) -> list[dict[str, Any]]:
    """
    지원자 리스트를 주어진 기준으로 내림차순 정렬.

    key:
        "match"   — 매칭률 (높은 순)
        "career"  — 경력 연수 (많은 순)
        "name"    — 이름 (가나다 순, 오름차순)

    sort()는 Python 내장 Tim Sort (O(n log n)).
    """
    if key == "match":
        return sorted(applicants, key=lambda a: a.get("match_score", 0), reverse=True)
    if key == "career":
        return sorted(applicants, key=lambda a: a.get("career_years", 0), reverse=True)
    if key == "name":
        return sorted(applicants, key=lambda a: a.get("name", ""))
    return applicants

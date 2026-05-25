# _common.py — 알고리즘 모듈 공용 헬퍼
# rabin_karp / alias_search 등에서 공통으로 쓰이는 구간 병합 로직을 단일화한다.

from __future__ import annotations


def merge_ranges(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """
    겹치거나 인접한 (start, end) 구간들을 정렬·병합해 반환.

    규칙:
    - 입력은 임의 순서. 내부에서 정렬 후 선형 스캔.
    - 다음 구간의 start 가 직전 구간의 end 이하이면 같은 묶음으로 병합.
    - 빈 입력은 빈 리스트.
    """
    if not intervals:
        return []
    ranges = sorted(intervals)
    merged: list[tuple[int, int]] = [ranges[0]]
    for start, end in ranges[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged

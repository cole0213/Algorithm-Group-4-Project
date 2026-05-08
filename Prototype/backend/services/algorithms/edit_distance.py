# edit_distance.py — 알고리즘 #3 (DP 구성 요소)
# Wagner-Fischer 알고리즘으로 두 문자열 간 편집 거리(Levenshtein) 계산
#
# 사용처: alias_search.py (별칭 유사도 비교)

from __future__ import annotations


def edit_distance(a: str, b: str) -> int:
    """
    두 문자열 a, b 사이의 편집 거리를 DP로 계산.
    삽입/삭제/대체 비용 = 1.

    시간복잡도: O(|a| × |b|)
    공간복잡도: O(|a| × |b|) → 롤링 배열로 O(|b|) 가능하나 가독성 우선

    예:
        edit_distance("react", "reactjs") → 2
        edit_distance("파이선", "파이썬")  → 1
    """
    m, n = len(a), len(b)

    # dp[i][j] = a[:i] → b[:j] 변환 비용
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    # 베이스케이스: 빈 문자열 ↔ 길이 k 문자열 = k번 삽입/삭제
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]          # 동일 문자: 비용 0
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],      # 삭제
                    dp[i][j - 1],      # 삽입
                    dp[i - 1][j - 1],  # 대체
                )

    return dp[m][n]


def is_similar(a: str, b: str, threshold: int = 2) -> bool:
    """편집 거리가 threshold 이하이면 유사한 것으로 판단."""
    return edit_distance(a.lower(), b.lower()) <= threshold

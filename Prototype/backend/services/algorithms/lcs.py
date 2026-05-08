# lcs.py — 알고리즘 #4
# LCS(Longest Common Subsequence) DP로 필요 스펙 대비 매칭 점수 산출
#
# 사용처: routers/portfolios.py (analyze 엔드포인트)

from __future__ import annotations
from .alias_map import normalize


def lcs_length(seq_a: list[str], seq_b: list[str]) -> int:
    """
    두 시퀀스의 LCS 길이를 DP로 계산.
    비교 전 alias_map으로 정규화하고 정렬하여
    표기 차이 및 스킬 순서 차이를 흡수.

    스킬 목록은 순서 비의존적이므로 정렬 후 LCS 적용 →
    결과적으로 "공통 스킬 수"와 동일하게 동작.

    시간복잡도: O(|seq_a| × |seq_b|)

    예:
        lcs_length(["react","python","docker","aws","git"],
                   ["react","vue","python","git","linux"])
        → 3  (react, python, git)
    """
    a = sorted(normalize(s) for s in seq_a)
    b = sorted(normalize(s) for s in seq_b)
    m, n = len(a), len(b)

    # 공간 절약 롤링 배열 (이전 행만 유지)
    prev = [0] * (n + 1)
    curr = [0] * (n + 1)

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = max(prev[j], curr[j - 1])
        prev, curr = curr, [0] * (n + 1)

    return prev[n]


def match_score(required: list[str], applicant: list[str]) -> float:
    """
    매칭 점수 = LCS 길이 / 필요 스펙 수 × 100 (0–100 정수 반환).
    필요 스펙이 없으면 0 반환.

    예:
        match_score(["React","Python","Docker","AWS","Git"],
                    ["React","Vue","Python","Git","Linux"])
        → 60
    """
    if not required:
        return 0
    common = lcs_length(required, applicant)
    return round(common / len(required) * 100)


def matched_skills(required: list[str], applicant: list[str]) -> list[str]:
    """매칭된 스킬 목록 반환 (하이라이트 목적)."""
    req_norm = {normalize(s): s for s in required}
    return [
        req_norm[normalize(s)]
        for s in applicant
        if normalize(s) in req_norm
    ]

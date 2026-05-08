# rabin_karp.py — 알고리즘 #8
# Rabin-Karp 롤링 해시 + LCS로 포트폴리오 간 유사 문장 검출
# 유사 문장은 그룹 번호(색상 코드)와 함께 반환
#
# 사용처: routers/portfolios.py (similar 엔드포인트)

from __future__ import annotations
from dataclasses import dataclass, field
from .lcs import lcs_length

# ── 상수 ───────────────────────────────────────────────────────────
_BASE = 31
_MOD = (1 << 61) - 1       # 메르센 소수
_WORD_WINDOW = 5            # 비교 단위: 연속 n개 단어
_LCS_THRESHOLD = 0.7        # LCS 유사도 임계값 (70% 이상 → 유사)

# UI accent 색상 (design.md 기준)
_GROUP_COLORS = [
    "#DC2626",  # red
    "#EA580C",  # orange
    "#0284C7",  # blue
    "#65A30D",  # green
    "#7C3AED",  # purple
    "#0D9488",  # teal
]


# ── 데이터 클래스 ──────────────────────────────────────────────────

@dataclass
class SimilarSpan:
    portfolio_id: str
    text: str                  # 유사한 원문 구간
    group: int                 # 동일 그룹 번호 (같은 번호 = 유사 쌍)
    color: str = ""            # UI 색상

    def __post_init__(self) -> None:
        self.color = _GROUP_COLORS[self.group % len(_GROUP_COLORS)]


# ── Rabin-Karp 해시 계산 ───────────────────────────────────────────

def _words(text: str) -> list[str]:
    """텍스트를 소문자 단어 리스트로 변환."""
    return [w.strip(".,;:!?()\"'") for w in text.lower().split() if w.strip(".,;:!?()\"'")]


def _hash_word(w: str) -> int:
    h = 0
    for ch in w:
        h = (h * _BASE + ord(ch)) % _MOD
    return h


def _rolling_hashes(words: list[str], window: int) -> dict[int, list[int]]:
    """
    슬라이딩 윈도우로 각 n-gram의 해시값 계산.
    반환: { hash_value: [시작 인덱스, ...] }
    """
    if len(words) < window:
        return {}

    # 개별 단어 해시 미리 계산
    wh = [_hash_word(w) for w in words]

    # 각 윈도우 위치의 합산 해시 (순서 고려: 위치별 가중치)
    result: dict[int, list[int]] = {}
    pow_base = pow(_BASE, window - 1, _MOD)

    cur = 0
    for i in range(window):
        cur = (cur * _BASE + wh[i]) % _MOD
    result.setdefault(cur, []).append(0)

    for i in range(1, len(words) - window + 1):
        cur = (cur - wh[i - 1] * pow_base % _MOD + _MOD) % _MOD
        cur = (cur * _BASE + wh[i + window - 1]) % _MOD
        result.setdefault(cur, []).append(i)

    return result


# ── 유사 문장 감지 메인 함수 ──────────────────────────────────────

def detect_similar(portfolios: list[dict]) -> list[SimilarSpan]:
    """
    모든 포트폴리오 쌍에 대해 유사 문장 검출.

    단계:
    1. 각 포트폴리오의 intro + project desc를 단어 리스트로 변환
    2. Rabin-Karp 롤링 해시로 n-gram 해시 충돌 빠르게 탐지
    3. 충돌 구간에 LCS 유사도 검증 (false positive 제거)
    4. 임계값 초과 구간에 그룹 번호 부여

    Returns: 유사 구간 목록 (SimilarSpan)
    """
    # 포트폴리오별 단어 목록 추출
    entries: list[tuple[str, list[str], str]] = []
    for p in portfolios:
        text = _extract_text(p)
        words = _words(text)
        entries.append((p["id"], words, text))

    spans: list[SimilarSpan] = []
    group = 0
    seen_pairs: set[tuple[str, str, int, int]] = set()

    for i in range(len(entries)):
        id_a, words_a, _ = entries[i]
        hashes_a = _rolling_hashes(words_a, _WORD_WINDOW)

        for j in range(i + 1, len(entries)):
            id_b, words_b, _ = entries[j]
            hashes_b = _rolling_hashes(words_b, _WORD_WINDOW)

            # 해시 충돌 탐지
            common_hashes = set(hashes_a.keys()) & set(hashes_b.keys())
            if not common_hashes:
                continue

            for h in common_hashes:
                for pos_a in hashes_a[h]:
                    for pos_b in hashes_b[h]:
                        pair_key = (id_a, id_b, pos_a, pos_b)
                        if pair_key in seen_pairs:
                            continue
                        seen_pairs.add(pair_key)

                        chunk_a = words_a[pos_a: pos_a + _WORD_WINDOW]
                        chunk_b = words_b[pos_b: pos_b + _WORD_WINDOW]

                        # LCS 유사도 검증
                        lcs = lcs_length(chunk_a, chunk_b)
                        sim = lcs / _WORD_WINDOW
                        if sim >= _LCS_THRESHOLD:
                            text_a = " ".join(chunk_a)
                            text_b = " ".join(chunk_b)
                            spans.append(SimilarSpan(id_a, text_a, group))
                            spans.append(SimilarSpan(id_b, text_b, group))
                            group += 1

    return spans


def detect_similar_response(portfolios: list[dict]) -> list[dict]:
    """API 응답 형식으로 변환."""
    spans = detect_similar(portfolios)
    return [
        {
            "portfolio_id": s.portfolio_id,
            "text": s.text,
            "group": s.group,
            "color": s.color,
        }
        for s in spans
    ]


def _extract_text(portfolio: dict) -> str:
    parts = [portfolio.get("intro", "")]
    for proj in portfolio.get("projects", []):
        parts.append(proj.get("desc", ""))
    return " ".join(parts)

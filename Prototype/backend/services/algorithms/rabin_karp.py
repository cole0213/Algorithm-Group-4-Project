# rabin_karp.py — 알고리즘 #8
# Rabin-Karp 롤링 해시 + LCS로 포트폴리오 간 유사 문장 검출
# 유사 문장은 그룹 번호(색상 코드)와 함께 반환
#
# 사용처: routers/portfolios.py (similar 엔드포인트)

from __future__ import annotations
import re as _re
from dataclasses import dataclass, field
from .lcs import lcs_length
from ._common import merge_ranges

_TOKEN_RE   = _re.compile(r'\S+')
_STRIP_CHARS = ".,;:!?()\"'"

# ── 상수 ───────────────────────────────────────────────────────────
_BASE = 31
_MOD = (1 << 61) - 1       # 메르센 소수
_WORD_WINDOW = 5            # 비교 단위: 연속 n개 단어
_LCS_THRESHOLD = 0.7        # LCS 유사도 임계값 (70% 이상 → 유사)

# UI 유사 문장 그룹 색상 — 프론트엔드 SettingsDrawer.jsx의 colorful 팔레트와 순서·값 동일하게 유지
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

def _tokenize(text: str) -> list[tuple[str, int, int]]:
    """(소문자_정제어, 원문_시작_char, 원문_끝_char) 목록 반환.
    span 텍스트를 원문에서 직접 잘라내기 위해 문자 위치를 함께 추적한다."""
    result = []
    for m in _TOKEN_RE.finditer(text):
        cleaned = m.group().strip(_STRIP_CHARS).lower()
        if cleaned:
            result.append((cleaned, m.start(), m.end()))
    return result


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

def _merge_ranges(positions: set[int], window: int) -> list[tuple[int, int]]:
    """매칭된 윈도우 시작 위치들을 인접/겹치는 구간으로 병합."""
    return merge_ranges([(p, p + window) for p in positions])


# _SectionInfo: (section_text, section_tokens, combined_word_start, combined_word_end)
_SectionInfo = tuple[str, list[tuple[str, int, int]], int, int]


def _build_sections(portfolio: dict) -> tuple[str, list[_SectionInfo]]:
    """
    포트폴리오의 섹션별(intro + 프로젝트 desc) 텍스트·토큰·단어 인덱스 경계를 계산.

    Returns:
        combined_text: 모든 섹션을 공백으로 이은 문자열 (해시 비교용)
        sections:      [(섹션원문, 섹션토큰, 합산_단어시작, 합산_단어끝), ...]
    """
    intro = portfolio.get("intro", "") or ""
    descs = [proj.get("desc", "") or "" for proj in portfolio.get("projects", [])]
    all_parts = [intro] + descs

    sections: list[_SectionInfo] = []
    word_pos = 0
    for sec_text in all_parts:
        sec_tokens = _tokenize(sec_text)
        sections.append((sec_text, sec_tokens, word_pos, word_pos + len(sec_tokens)))
        word_pos += len(sec_tokens)

    combined_text = " ".join(all_parts)
    return combined_text, sections


def _section_spans(
    merged: list[tuple[int, int]],
    sections: list[_SectionInfo],
    portfolio_id: str,
    group: int,
) -> list[SimilarSpan]:
    """
    병합된 합산-단어-인덱스 범위를 섹션 경계에서 잘라 SimilarSpan 목록으로 변환.

    하나의 merged 범위가 intro와 desc를 동시에 포함하더라도
    각 섹션 원문에서 독립적으로 잘라내므로 프론트엔드 indexOf 탐색이 성공한다.
    """
    result: list[SimilarSpan] = []
    for rng_s, rng_e in merged:
        for sec_text, sec_tokens, sec_ws, sec_we in sections:
            c_s = max(rng_s, sec_ws)
            c_e = min(rng_e, sec_we)
            if c_s >= c_e or not sec_tokens:
                continue
            local_s = c_s - sec_ws
            local_e = min(c_e - sec_ws, len(sec_tokens))
            if local_s >= local_e:
                continue
            char_s = sec_tokens[local_s][1]
            char_e = sec_tokens[local_e - 1][2]
            span_text = sec_text[char_s:char_e]
            if span_text.strip():
                result.append(SimilarSpan(portfolio_id, span_text, group))
    return result


def detect_similar(portfolios: list[dict]) -> list[SimilarSpan]:
    """
    모든 포트폴리오 쌍에 대해 유사 문장 검출.

    단계:
    1. 각 포트폴리오의 intro + project desc를 섹션별로 토큰화
    2. Rabin-Karp 롤링 해시로 n-gram 해시 충돌 빠르게 탐지
    3. 충돌 구간에 LCS 유사도 검증 (false positive 제거)
    4. 인접/겹치는 윈도우를 병합해 하나의 연속 구간으로 합산
    5. 병합 구간을 섹션 경계에서 잘라 각 섹션 원문 기준의 span 텍스트 추출
    6. 병합된 구간에 그룹 번호 부여

    Returns: 유사 구간 목록 (SimilarSpan)
    """
    entries: list[tuple[str, list[tuple[str, int, int]], list[_SectionInfo]]] = []
    for p in portfolios:
        combined_text, sections = _build_sections(p)
        tokens = _tokenize(combined_text)
        entries.append((p["id"], tokens, sections))

    spans: list[SimilarSpan] = []
    group = 0

    for i in range(len(entries)):
        id_a, tokens_a, sections_a = entries[i]
        words_a = [t[0] for t in tokens_a]
        hashes_a = _rolling_hashes(words_a, _WORD_WINDOW)

        for j in range(i + 1, len(entries)):
            id_b, tokens_b, sections_b = entries[j]
            words_b = [t[0] for t in tokens_b]
            hashes_b = _rolling_hashes(words_b, _WORD_WINDOW)

            common_hashes = set(hashes_a.keys()) & set(hashes_b.keys())
            if not common_hashes:
                continue

            matched_a: set[int] = set()
            matched_b: set[int] = set()
            seen: set[tuple[int, int]] = set()

            for h in common_hashes:
                for pos_a in hashes_a[h]:
                    for pos_b in hashes_b[h]:
                        if (pos_a, pos_b) in seen:
                            continue
                        seen.add((pos_a, pos_b))
                        chunk_a = words_a[pos_a: pos_a + _WORD_WINDOW]
                        chunk_b = words_b[pos_b: pos_b + _WORD_WINDOW]
                        lcs = lcs_length(chunk_a, chunk_b)
                        if lcs / _WORD_WINDOW >= _LCS_THRESHOLD:
                            matched_a.add(pos_a)
                            matched_b.add(pos_b)

            if not matched_a:
                continue

            merged_a = _merge_ranges(matched_a, _WORD_WINDOW)
            merged_b = _merge_ranges(matched_b, _WORD_WINDOW)
            n_groups = max(len(merged_a), len(merged_b))
            for k in range(n_groups):
                if k < len(merged_a):
                    spans += _section_spans([merged_a[k]], sections_a, id_a, group)
                if k < len(merged_b):
                    spans += _section_spans([merged_b[k]], sections_b, id_b, group)
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

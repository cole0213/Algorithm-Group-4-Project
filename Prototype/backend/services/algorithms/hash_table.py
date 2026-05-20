# hash_table.py — 알고리즘 #2
# 필요 스펙 키워드를 해시셋에 저장하고 O(1) 매칭/하이라이트 탐지
#
# 사용처: parser.py, routers/portfolios.py (analyze 엔드포인트)

from __future__ import annotations
from .alias_map import normalize, get_aliases


class SpecMatcher:
    """
    필요 스펙을 해시셋으로 저장.
    별칭 해시맵(alias_map)으로 정규화 후 저장하므로
    "ReactJS", "react.js" 등도 동일하게 매칭됨.
    """

    def __init__(self, required_specs: list[str]) -> None:
        # 정규 키(canonical key) 해시셋 — O(1) 조회
        self._required: set[str] = set()
        # 원본 표기 보존용 (UI 표시에 사용)
        self._originals: dict[str, str] = {}

        for spec in required_specs:
            key = normalize(spec)
            self._required.add(key)
            self._originals[key] = spec

    # ── 핵심 메서드 ────────────────────────────────────────────────

    def is_required(self, skill: str) -> bool:
        """O(1): 해당 기술이 필요 스펙에 포함되는지 확인."""
        return normalize(skill) in self._required

    def match_skills(self, skills: list[str]) -> dict[str, bool]:
        """
        기술 스택 리스트를 받아 { 기술명: 매칭여부 } 딕셔너리 반환.
        UI 하이라이트 렌더링에 직접 활용.
        """
        return {skill: self.is_required(skill) for skill in skills}

    def matched_count(self, skills: list[str]) -> int:
        """매칭된 스펙 수 반환 (LCS 점수 산출 전 빠른 필터용)."""
        return sum(1 for s in skills if self.is_required(s))

    @property
    def required_count(self) -> int:
        return len(self._required)

    @property
    def required_keys(self) -> set[str]:
        return set(self._required)

    def required_display_list(self) -> list[str]:
        """원본 표기 기준 필요 스펙 목록 반환."""
        return list(self._originals.values())

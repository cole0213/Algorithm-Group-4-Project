# bst.py — 알고리즘 #6
# 이진 탐색 트리(BST)로 두 가지 검색 모드 지원
#   A. cross  — 키워드 기준 지원자 인덱스 (O(log n))
#   B. intra  — 포트폴리오 내 키워드 위치/맥락 탐색
#
# 사용처: routers/portfolios.py (search 엔드포인트)

from __future__ import annotations
from dataclasses import dataclass, field
from .alias_map import normalize


# ── 모듈 수준 캐시 ──────────────────────────────────────────────────

_bst_cache: dict = {}   # cache_key → BST 인스턴스
_cache_version: int = 0  # 포트폴리오 변경 시마다 증가


def invalidate_cache() -> None:
    """포트폴리오 추가·삭제·재분석 시 호출하여 BST 캐시를 전부 무효화한다."""
    global _cache_version
    _cache_version += 1
    _bst_cache.clear()


def get_or_build_bst(portfolios: list[dict]) -> "ApplicantIndex":
    """
    cross 모드용 ApplicantIndex를 캐시에서 반환하거나 새로 빌드한다.
    캐시 키는 '_v{_cache_version}' 으로 구성되며, invalidate_cache() 호출 시
    버전이 올라가 다음 요청에서 자동으로 재빌드된다.
    """
    cache_key = f"cross_v{_cache_version}"
    if cache_key in _bst_cache:
        return _bst_cache[cache_key]

    idx = ApplicantIndex.build(portfolios)
    _bst_cache[cache_key] = idx
    return idx


# ── BST 노드 ────────────────────────────────────────────────────────

@dataclass
class _Node:
    key: str                              # 정규화된 키워드 (소문자)
    portfolio_ids: list[str] = field(default_factory=list)  # cross 모드: 해당 키워드를 가진 지원자 ID 목록
    positions: list[int] = field(default_factory=list)      # intra 모드: 텍스트 내 시작 위치 목록
    left: "_Node | None" = field(default=None, repr=False)
    right: "_Node | None" = field(default=None, repr=False)


# ── Cross-Portfolio BST ──────────────────────────────────────────────

class ApplicantIndex:
    """
    전체 지원자를 대상으로 기술/키워드 → 지원자 ID 매핑.
    BST로 구성하여 O(log n) 검색.
    """

    def __init__(self) -> None:
        self._root: _Node | None = None

    # ── 삽입 ──────────────────────────────────────────────────────
    def insert(self, keyword: str, portfolio_id: str) -> None:
        key = normalize(keyword)
        self._root = self._insert(self._root, key, portfolio_id)

    def _insert(self, node: _Node | None, key: str, pid: str) -> _Node:
        if node is None:
            return _Node(key=key, portfolio_ids=[pid])
        if key < node.key:
            node.left = self._insert(node.left, key, pid)
        elif key > node.key:
            node.right = self._insert(node.right, key, pid)
        else:
            if pid not in node.portfolio_ids:
                node.portfolio_ids.append(pid)
        return node

    # ── 검색 ──────────────────────────────────────────────────────
    def search(self, keyword: str) -> list[str]:
        """O(log n): 키워드를 가진 지원자 ID 목록 반환."""
        key = normalize(keyword)
        node = self._find(self._root, key)
        return node.portfolio_ids if node else []

    def _find(self, node: _Node | None, key: str) -> _Node | None:
        if node is None or node.key == key:
            return node
        if key < node.key:
            return self._find(node.left, key)
        return self._find(node.right, key)

    # ── 전체 빌드 헬퍼 ────────────────────────────────────────────
    @classmethod
    def build(cls, portfolios: list[dict]) -> "ApplicantIndex":
        """
        portfolios: [{ "id": ..., "skills": [...], "name": ..., ... }, ...]
        스킬 + 이름 토큰을 BST에 삽입.
        """
        idx = cls()
        for p in portfolios:
            pid = p["id"]
            for skill in p.get("skills", []):
                idx.insert(skill, pid)
            # 이름 토큰 인덱싱 (띄어쓰기 분리 + 전체 이름)
            name = p.get("name", "")
            if name:
                idx.insert(name, pid)
                for token in name.split():
                    idx.insert(token, pid)
            # 경력 연수 인덱싱
            career = str(p.get("career_years", ""))
            if career and career != "0":
                idx.insert(career, pid)
        return idx


# ── Intra-Portfolio BST ─────────────────────────────────────────────

class TextIndex:
    """
    단일 포트폴리오 텍스트를 토큰화하여 키워드 위치를 BST로 인덱싱.
    """

    def __init__(self, text: str) -> None:
        self._root: _Node | None = None
        self._text = text
        self._build(text)

    def _build(self, text: str) -> None:
        words = text.lower().split()
        for pos, word in enumerate(words):
            clean = word.strip(".,;:!?()[]{}\"'")
            if clean:
                self._root = self._insert_pos(self._root, normalize(clean), pos)

    def _insert_pos(self, node: _Node | None, key: str, pos: int) -> _Node:
        if node is None:
            return _Node(key=key, positions=[pos])
        if key < node.key:
            node.left = self._insert_pos(node.left, key, pos)
        elif key > node.key:
            node.right = self._insert_pos(node.right, key, pos)
        else:
            node.positions.append(pos)
        return node

    def search(self, keyword: str) -> list[int]:
        """O(log n): 키워드가 등장하는 토큰 위치(인덱스) 목록 반환."""
        key = normalize(keyword)
        node = self._find(self._root, key)
        return node.positions if node else []

    def _find(self, node: _Node | None, key: str) -> _Node | None:
        if node is None or node.key == key:
            return node
        if key < node.key:
            return self._find(node.left, key)
        return self._find(node.right, key)

    def search_context(self, keyword: str, window: int = 5) -> list[str]:
        """
        키워드 주변 ±window 토큰을 추출하여 문맥 스니펫 리스트 반환.
        """
        positions = self.search(keyword)
        words = self._text.split()
        snippets = []
        for pos in positions:
            start = max(0, pos - window)
            end = min(len(words), pos + window + 1)
            snippets.append(" ".join(words[start:end]))
        return snippets

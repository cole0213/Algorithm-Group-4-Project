# alias_map.py
# 기술명 별칭 정적 해시맵 — 전체 알고리즘 모듈에서 공유하는 단일 소스
#
# 구조: { 정규 키(소문자) : [인식할 별칭 목록(소문자)] }
# - 정규 키는 항상 소문자
# - 별칭 목록에는 정규 키 자체도 포함
# - 사용처: hash_table.py, edit_distance.py, bst.py, alias_search.py, rabin_karp.py

from __future__ import annotations

ALIAS_MAP: dict[str, list[str]] = {
    # ── 언어 ──────────────────────────────────────────────────────────
    "python": [
        "python", "py", "파이썬", "파이선", ".py", "python3",
    ],
    "javascript": [
        "javascript", "js", "자바스크립트", ".js", "es6", "es2015",
        "ecmascript",
    ],
    "typescript": [
        "typescript", "ts", "타입스크립트", ".ts",
    ],
    "java": [
        "java", "자바", ".java",
    ],
    "kotlin": [
        "kotlin", "코틀린", ".kt",
    ],
    "swift": [
        "swift", "스위프트", ".swift",
    ],
    "c": [
        "c", "c language", "clang",
    ],
    "cpp": [
        "cpp", "c++", "c plus plus", "c플러스플러스", ".cpp", ".cc", ".cxx",
    ],
    "csharp": [
        "csharp", "c#", "c sharp", "씨샵", ".cs",
    ],
    "go": [
        "go", "golang", "고랭", ".go",
    ],
    "rust": [
        "rust", "러스트", ".rs",
    ],
    "ruby": [
        "ruby", "루비", ".rb",
    ],
    "php": [
        "php", "피에이치피", ".php",
    ],
    "scala": [
        "scala", "스칼라", ".scala",
    ],
    "r": [
        "r", "r language", "r lang", ".r",
    ],
    "dart": [
        "dart", "다트", ".dart",
    ],

    # ── 프론트엔드 프레임워크 / 라이브러리 ───────────────────────────
    "react": [
        "react", "reactjs", "react.js", "리액트",
    ],
    "vue": [
        "vue", "vuejs", "vue.js", "뷰", "뷰js",
    ],
    "angular": [
        "angular", "angularjs", "angular.js", "앵귤러",
    ],
    "svelte": [
        "svelte", "스벨트",
    ],
    "nextjs": [
        "nextjs", "next.js", "next js", "넥스트", "넥스트js",
    ],
    "nuxtjs": [
        "nuxtjs", "nuxt.js", "nuxt js", "눅스트",
    ],

    # ── 백엔드 프레임워크 ─────────────────────────────────────────────
    "fastapi": [
        "fastapi", "fast api", "패스트api",
    ],
    "django": [
        "django", "장고",
    ],
    "flask": [
        "flask", "플라스크",
    ],
    "spring": [
        "spring", "spring boot", "springboot", "스프링", "스프링부트",
    ],
    "express": [
        "express", "expressjs", "express.js", "익스프레스",
    ],
    "nestjs": [
        "nestjs", "nest.js", "nest js", "네스트", "네스트js",
    ],
    "rails": [
        "rails", "ruby on rails", "루비온레일즈",
    ],
    "laravel": [
        "laravel", "라라벨",
    ],

    # ── 데이터베이스 ──────────────────────────────────────────────────
    "mysql": [
        "mysql", "마이에스큐엘", "마이sql",
    ],
    "postgresql": [
        "postgresql", "postgres", "pg", "포스트그레스", "포스트그레sql",
    ],
    "mongodb": [
        "mongodb", "mongo", "몽고db", "몽고디비",
    ],
    "redis": [
        "redis", "레디스",
    ],
    "sqlite": [
        "sqlite", "sqlite3", "에스큐라이트",
    ],
    "oracle": [
        "oracle", "oracle db", "오라클",
    ],
    "mssql": [
        "mssql", "sql server", "sqlserver", "microsoft sql server",
    ],

    # ── 클라우드 / 인프라 ─────────────────────────────────────────────
    "aws": [
        "aws", "amazon web services", "아마존 웹 서비스",
    ],
    "gcp": [
        "gcp", "google cloud", "google cloud platform", "구글 클라우드",
    ],
    "azure": [
        "azure", "microsoft azure", "애저",
    ],
    "docker": [
        "docker", "도커",
    ],
    "kubernetes": [
        "kubernetes", "k8s", "쿠버네티스",
    ],
    "terraform": [
        "terraform", "테라폼",
    ],

    # ── 버전 관리 / 협업 ──────────────────────────────────────────────
    "git": [
        "git", "깃",
    ],
    "github": [
        "github", "깃허브",
    ],
    "gitlab": [
        "gitlab", "깃랩",
    ],

    # ── AI / ML ───────────────────────────────────────────────────────
    "pytorch": [
        "pytorch", "torch", "파이토치",
    ],
    "tensorflow": [
        "tensorflow", "tf", "텐서플로", "텐서플로우",
    ],
    "scikit-learn": [
        "scikit-learn", "sklearn", "사이킷런",
    ],
    "pandas": [
        "pandas", "판다스",
    ],
    "numpy": [
        "numpy", "넘파이",
    ],

    # ── 모바일 ────────────────────────────────────────────────────────
    "flutter": [
        "flutter", "플러터",
    ],
    "reactnative": [
        "reactnative", "react native", "react-native", "리액트 네이티브",
    ],
}

# ── 역방향 인덱스: 별칭 → 정규 키 (O(1) 조회용) ─────────────────────
# 예: "파이선" -> "python", "reactjs" -> "react"
REVERSE_MAP: dict[str, str] = {
    alias: canonical
    for canonical, aliases in ALIAS_MAP.items()
    for alias in aliases
}


def normalize(term: str) -> str:
    """입력 문자열을 정규 키로 변환. 매칭 없으면 소문자 그대로 반환."""
    return REVERSE_MAP.get(term.lower().strip(), term.lower().strip())


def get_aliases(term: str) -> list[str]:
    """정규 키(또는 별칭)에 해당하는 전체 별칭 목록 반환."""
    canonical = normalize(term)
    return ALIAS_MAP.get(canonical, [canonical])

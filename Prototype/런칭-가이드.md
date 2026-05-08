# 런칭 가이드 — 데이터 저장 및 접근 제어

## 현재 상태 (로컬/데모)

- 포트폴리오 데이터는 `backend/session.json`에 **자동 저장**됨
- 추가·삭제·임포트 시 즉시 저장 → 서버 재시작 후에도 데이터 유지됨
- `session.json`이 없으면 `ui-prototype/portfolios/*.md`에서 로드 후 자동 생성
- export/import 기능으로 수동 백업/복원도 가능 (팀원 간 데이터 공유 시 유용)

---

## 런칭 시 선택 방안

### 방안 A: Supabase 무료 플랜 ✅ 권장

> DB를 직접 관리하지 않고 클라우드 저장소처럼 사용하는 방식

**특징**
- 완전 관리형 PostgreSQL — 설치/운영 불필요
- 무료 플랜: 500MB, 50,000 row (이 프로젝트 규모에 충분)
- Row-level Security(RLS)로 인증된 사용자만 접근 가능
- REST API 제공 → Python `requests`로 바로 연결

**구현 변경 범위**
1. `backend/requirements.txt`에 `supabase` 추가
2. `.env`에 Supabase URL·API 키 추가
3. `routers/portfolios.py`의 `_portfolio_cache` 로직을 Supabase 테이블 CRUD로 교체
4. 프론트엔드 변경 없음

**`.env` 추가 항목**
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
```

**Supabase 테이블 스키마 (SQL)**
```sql
create table portfolios (
  id          text primary key,
  session_token text not null,          -- 접근 제어용 토큰
  name        text,
  email       text,
  github      text,
  career_years int default 0,
  education   text,
  skills      jsonb default '[]',
  intro       text,
  projects    jsonb default '[]',
  awards      jsonb default '[]',
  raw_text    text,
  raw_ext     text,
  created_at  timestamptz default now()
);
```

**접근 제어**: `session_token`을 팀원에게만 공유하고, API 요청 시 해당 토큰 기준으로 필터링

---

### 방안 B: 세션 토큰 + 서버 파일 저장

> 외부 서비스 없이 서버 파일시스템에 JSON으로 저장

**특징**
- 외부 의존성 없음
- `data/{session_token}.json` 파일 하나로 세션별 데이터 관리
- URL에 토큰 포함: `https://yoursite.com/?session=abc123`
- 토큰을 모르면 접근 불가

**주의사항**
- 서버 재배포 시 파일 소멸 위험 → **영구 디스크** 마운트 필요
  - Render: Persistent Disk 유료 옵션
  - Railway: Volume 마운트
  - Fly.io: Volume 마운트
- 동시 쓰기 시 파일 손상 가능 → 파일 잠금(lock) 처리 필요
- 수평 확장(서버 2대 이상) 불가

**구현 변경 범위**
1. `routers/portfolios.py`에 세션 토큰 파라미터 추가
2. 쓰기 시 `data/{token}.json` 저장 함수 추가
3. 서버 시작 시 파일에서 로드

---

### 방안 C: export/import 수동 공유 (현재 구현됨)

> 서버/DB 없이 JSON 파일을 직접 팀원과 공유

**특징**
- 추가 구현 없음 (이미 완성)
- 실시간 동기화 불가
- 팀원 각자 로컬에서 파일 import 후 작업

**적합한 경우**
- 1회성 채용 심사 (동기화 불필요)
- 인터넷 없는 환경
- 완전히 오프라인으로 운용하고 싶을 때

---

## 배포 플랫폼 권장

| 플랫폼 | 방안 A | 방안 B | 비용 |
|--------|--------|--------|------|
| **Railway** | ✅ | ✅ (Volume) | 무료~$5/월 |
| **Render** | ✅ | ✅ (Persistent Disk) | 무료~$7/월 |
| **Fly.io** | ✅ | ✅ (Volume) | 무료~소액 |
| Vercel / Netlify | ✅ | ❌ (서버리스) | 무료 |
| AWS EC2 / DigitalOcean | ✅ | ✅ | $5/월~ |

> 방안 A + Railway 또는 Render 조합이 가장 간단하고 안정적

---

## 접근 제어 방식 (공통)

팀원 외 접근을 막으려면 다음 중 하나 적용:

### 1. HTTP Basic Auth (가장 단순)
`main.py`에 미들웨어 추가:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets

security = HTTPBasic()

def verify(creds: HTTPBasicCredentials = Depends(security)):
    ok = secrets.compare_digest(creds.password, os.getenv("ACCESS_PASSWORD", ""))
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
```
`.env`에 `ACCESS_PASSWORD=your-password` 설정 후 팀원에게 공유

### 2. 세션 토큰 URL 파라미터
URL에 토큰 포함: `https://yoursite.com/?token=abc123`
프론트엔드가 모든 API 요청 헤더에 토큰 포함 → 백엔드에서 검증

### 3. Supabase Auth (방안 A 사용 시)
이메일 초대 방식으로 특정 계정만 접근 허용

---

## 우선순위 권장 순서

1. **지금 당장**: 현재 상태 유지 + export/import로 수동 공유
2. **런칭 시**: Supabase 무료 플랜 + Railway 배포 + HTTP Basic Auth
3. **확장 필요 시**: Supabase Auth로 계정 기반 접근 제어 고도화

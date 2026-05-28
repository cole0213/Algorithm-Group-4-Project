# 설치 및 실행

## 요구사항

| 항목 | 버전 |
|------|------|
| Node.js | 18 이상 |
| Python | 3.10 이상 |

---

## Frontend 설치

```bash
cd frontend
npm install
```

### 개발 서버 실행

```bash
npm run dev
# http://localhost:5173
```

---

## Backend 설치

### 가상환경 생성 및 활성화

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 패키지 설치

```bash
pip install -r requirements.txt
```

### 개발 서버 실행

```bash
uvicorn main:app --reload
# http://localhost:8000
```

---

## 환경 변수

`backend/.env` 파일 생성 (`.env.example` 참고):

```
SOLAR_API_KEY=your_api_key_here
SOLAR_MODEL=solar-pro
```

- `SOLAR_API_KEY`: Upstage 콘솔에서 발급
- `SOLAR_MODEL`: Solar 모델명 (기본값 `solar-pro`)

---

## 원클릭 실행

터미널 두 개를 직접 열지 않고 스크립트 하나로 백엔드 + 프론트엔드를 동시 실행할 수 있다.

```bash
# macOS / Linux
./start.sh

# Windows
start.bat
```

- 가상환경이 없으면 자동 생성 후 패키지 설치
- Apple Silicon(M1/M2/M3)에서 rollup 네이티브 모듈 누락 시 자동 클린 재설치
- 서버 기동 후 브라우저에서 http://localhost:5173 자동 오픈
- `Ctrl+C`로 백엔드·프론트엔드 동시 종료

---

## 수동 실행 순서

```
1. backend 가상환경 활성화
2. uvicorn main:app --reload       (터미널 1)
3. cd frontend && npm run dev      (터미널 2)
4. 브라우저에서 http://localhost:5173 접속
```

---

## 주요 URL

| URL | 설명 |
|-----|------|
| http://localhost:5173 | 프론트엔드 (React + Vite) |
| http://localhost:8000 | 백엔드 API |
| http://localhost:8000/docs | FastAPI 자동 생성 API 문서 (Swagger UI) |

---

## Frontend ↔ Backend 연결

Vite 개발 서버의 프록시 설정(`vite.config.js`)으로 `/api` 요청을 `:8000`으로 전달한다.

```js
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

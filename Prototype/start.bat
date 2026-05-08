@echo off
echo [Portfolio Reviewer] 서버 시작 중...

:: 백엔드 (새 창)
start "Backend - FastAPI" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && uvicorn main:app --reload"

:: 프론트엔드 (새 창)
start "Frontend - Vite" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo 백엔드:    http://localhost:8000
echo 프론트엔드: http://localhost:5173
echo API 문서:  http://localhost:8000/docs
echo.
echo 브라우저가 열릴 때까지 잠시 기다려 주세요...
timeout /t 3 /nobreak > nul
start http://localhost:5173

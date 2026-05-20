@echo off
echo [Portfolio Reviewer] Starting servers...

:: Backend (new window)
start "Backend - FastAPI" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && uvicorn main:app --reload"

:: Frontend (new window)
start "Frontend - Vite" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend:   http://localhost:8000
echo Frontend:  http://localhost:5173
echo API Docs:  http://localhost:8000/docs
echo.
echo Please wait for the browser to open...
timeout /t 3 /nobreak > nul
start http://localhost:5173

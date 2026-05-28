#!/bin/bash
# macOS 실행 스크립트 — Portfolio Reviewer
# 사용법: ./start.sh
# 종료: Ctrl+C (백그라운드 프로세스 자동 정리)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "[Portfolio Reviewer] Shutting down..."
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null
  wait 2>/dev/null
  echo "[Portfolio Reviewer] Stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "[Portfolio Reviewer] Starting servers..."

# ── Backend ──────────────────────────────────────────────
cd "$BACKEND_DIR"

if [[ ! -d venv ]]; then
  echo "[Backend] Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate

echo "[Backend] Installing dependencies..."
pip install -q -r requirements.txt

echo "[Backend] Starting FastAPI..."
uvicorn main:app --reload > uvicorn.log 2>&1 &
BACKEND_PID=$!

deactivate

# ── Frontend ─────────────────────────────────────────────
cd "$FRONTEND_DIR"

if [[ ! -d node_modules ]]; then
  echo "[Frontend] Installing npm packages..."
  npm install
fi

# rollup 네이티브 모듈 누락 시 (Apple Silicon npm 버그) 클린 재설치
if [[ ! -d node_modules/@rollup/rollup-darwin-arm64 && "$(uname -m)" == "arm64" ]]; then
  echo "[Frontend] Fixing missing rollup native module — clean reinstall..."
  rm -rf node_modules package-lock.json
  npm install
fi

chmod -R +x node_modules/.bin 2>/dev/null || true

echo "[Frontend] Starting Vite..."
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

# ── Open browser ─────────────────────────────────────────
echo ""
echo "  Backend:   http://localhost:8000"
echo "  Frontend:  http://localhost:5173"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

sleep 3
open "http://localhost:5173"

wait

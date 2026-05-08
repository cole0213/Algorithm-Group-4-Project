# main.py — FastAPI 애플리케이션 진입점
#
# 실행:
#   cd backend
#   uvicorn main:app --reload
#   → http://localhost:8000

from __future__ import annotations
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.portfolios import router as portfolio_router

app = FastAPI(
    title="Portfolio Reviewer API",
    description="개발자 포트폴리오 정형화·비교 서비스 백엔드",
    version="1.0.0",
)

# CORS: Vite(5173) + 프로토타입(파일 직접 열기) 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "null"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio_router)


@app.get("/")
def root():
    return {"message": "Portfolio Reviewer API", "docs": "/docs"}

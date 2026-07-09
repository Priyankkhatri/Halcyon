"""
Halcyon Backend — FastAPI Application Entry Point
Run with: uvicorn app:app --reload
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import init_db
from routes import router

# ── Logging Setup ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("halcyon")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB tables on startup."""
    logger.info("🚀 Halcyon backend starting up…")
    await init_db()
    logger.info("✅ Database initialized.")
    yield
    logger.info("🛑 Halcyon backend shutting down.")


# ── App Factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Halcyon — AI Log Analysis Backend",
    description=(
        "Production-ready FastAPI backend for intelligent log analysis. "
        "Powered by Google Gemini AI with persistent SQLite storage."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # React dev server
        "http://localhost:5173",   # Vite dev server
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again.", "success": False},
    )


# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(router)


# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/", tags=["root"])
async def root():
    return {
        "message": "Halcyon AI Log Analysis API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


# ── Dev Entry Point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )

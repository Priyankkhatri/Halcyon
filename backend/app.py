"""
Halcyon Backend — FastAPI Application Entry Point
Run with: uvicorn app:app --reload
"""
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import init_db
from demo_seed import seed_demo_data
from memory import init_memory
from routes import router

# ── Logging Setup ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("halcyon")


async def keep_model_endpoint_alive():
    """Ping the self-hosted model endpoint every 5 mins to prevent idle disconnects
    (Colab idle reclaim, HF Space sleep, ngrok tunnel timeouts)."""
    import httpx
    while True:
        if settings.ollama_enabled and settings.ollama_url:
            base = settings.ollama_url.rstrip("/").removesuffix("/v1")
            headers = {"ngrok-skip-browser-warning": "true"}
            if settings.ollama_token:
                headers["Authorization"] = f"Bearer {settings.ollama_token}"
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(f"{base}/api/tags", headers=headers)
                    if resp.status_code == 200:
                        logger.debug("Model endpoint keep-alive OK: %s", base)
                    else:
                        logger.warning(
                            "Model endpoint keep-alive got HTTP %s from %s — tunnel may be down.",
                            resp.status_code, base,
                        )
            except Exception as e:
                logger.warning("Model endpoint keep-alive failed (%s): %s", base, e)

        await asyncio.sleep(300)  # 5 minutes


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB tables and memory system on startup."""
    logger.info("🚀 Halcyon backend starting up…")
    await init_db()
    logger.info("✅ Database initialized.")
    if settings.seed_demo_data:
        seeded = await seed_demo_data()
        if seeded:
            logger.info("✅ Seeded %d demo incidents and audit logs.", seeded)
    else:
        logger.info("ℹ️ Seeding disabled; starting with empty database.")
    await init_memory()
    logger.info("✅ Memory system initialized.")
    
    # Start background GitHub commit monitor loop
    from github_monitor import github_polling_loop
    polling_task = asyncio.create_task(github_polling_loop())
    
    # Start model endpoint keep-alive task
    keepalive_task = asyncio.create_task(keep_model_endpoint_alive())
    
    yield
    
    logger.info("🛑 Halcyon backend shutting down.")
    polling_task.cancel()
    keepalive_task.cancel()
    try:
        await polling_task
        await keepalive_task
    except asyncio.CancelledError:
        pass



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
    allow_origins=["*"],
    allow_credentials=False,
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

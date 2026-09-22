"""
FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload

Or via Docker (see Dockerfile).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.database import close_mongo_connection, connect_to_mongo

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---------------------------------------------------------------
    logger.info("Starting %s (%s environment)...", settings.APP_NAME, settings.ENVIRONMENT)
    await connect_to_mongo()

    # Warm the embedding model at startup rather than on first request, so
    # the first real API call isn't penalized with a multi-second model load.
    from app.services.embedder import get_embedding_service

    get_embedding_service()

    logger.info("Startup complete.")
    yield
    # --- Shutdown --------------------------------------------------------------
    logger.info("Shutting down...")
    await close_mongo_connection()


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-driven resume parsing, semantic embedding, and vector-search "
        "based ranking backend."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected internal error occurred."},
    )


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "service": settings.APP_NAME,
        "status": "running",
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX,
    }

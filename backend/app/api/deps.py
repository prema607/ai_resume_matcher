"""
Shared FastAPI dependency providers.

Each function here is designed to be used with `Depends(...)` in endpoint
signatures, giving a single place to swap implementations (e.g. for
testing with a mocked database or storage driver).
"""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import Settings, get_settings
from app.core.database import get_database
from app.services.embedder import EmbeddingService, get_embedding_service
from app.services.matcher import VectorMatcher, get_vector_matcher
from app.services.parser import ResumeParser, get_resume_parser
from app.storage.local_storage import LocalStorageDriver

_storage_driver: LocalStorageDriver | None = None


def get_db() -> AsyncIOMotorDatabase:
    return get_database()


def get_app_settings() -> Settings:
    return get_settings()


def get_storage() -> LocalStorageDriver:
    global _storage_driver
    if _storage_driver is None:
        settings = get_settings()
        _storage_driver = LocalStorageDriver(base_dir=settings.STORAGE_DIR)
    return _storage_driver


def get_embedder() -> EmbeddingService:
    return get_embedding_service()


def get_parser() -> ResumeParser:
    return get_resume_parser()


def get_matcher(db: AsyncIOMotorDatabase = None) -> VectorMatcher:  # type: ignore[assignment]
    # When used directly (not via Depends chaining) callers should pass db explicitly.
    if db is None:
        db = get_database()
    return get_vector_matcher(db)

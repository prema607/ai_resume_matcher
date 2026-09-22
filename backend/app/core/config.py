"""
Centralized application configuration.

All environment-dependent values are loaded here via pydantic-settings so
the rest of the codebase never touches `os.environ` directly. This keeps
configuration typed, validated at startup, and easy to override in tests
(by instantiating `Settings(**overrides)`).
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---------------------------------------------------------------
    APP_NAME: str = "Resume Matcher API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["*"])

    # --- MongoDB -------------------------------------------------------------
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "resume_matcher"
    VECTOR_INDEX_NAME: str = "vector_index"

    # --- LLM (structured parsing) -------------------------------------------
    GEMINI_API_KEY: str

    LLM_MODEL: str = "gemini-3.6-flash"
    # --- Embeddings ----------------------------------------------------------
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSIONS: int = 384

    # --- Storage ---------------------------------------------------------------
    STORAGE_DIR: str = "storage_vaults"
    MAX_UPLOAD_SIZE_MB: int = 10

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v):
        # Allow either a JSON list (from .env: CORS_ORIGINS=["a","b"]) or a
        # simple comma-separated string (CORS_ORIGINS=a,b) for convenience.
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json

                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """
    Cached settings accessor. Using lru_cache means the .env file is parsed
    exactly once per process, and Settings() is reused everywhere via
    dependency injection (see api/deps.py).
    """
    return Settings()

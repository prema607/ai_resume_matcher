"""
Local vector embedding generation via sentence-transformers.

The model is loaded exactly once per process (it's ~90MB and loading it
per-request would be far too slow) and reused for every embed() call.
Because SentenceTransformer.encode() is CPU/GPU-bound synchronous work,
we run it in a thread pool executor so it doesn't block the FastAPI
event loop.
"""
from __future__ import annotations

import asyncio
import logging
import threading
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Thread-safe singleton wrapper around a SentenceTransformer model.

    Usage:
        embedder = EmbeddingService.get_instance()
        vector = await embedder.embed_async("some text")
    """

    _instance: "EmbeddingService | None" = None
    _lock = threading.Lock()

    def __init__(self, model_name: str):
        logger.info("Loading embedding model '%s' (first load may take a while)...", model_name)
        self._model = SentenceTransformer(model_name)
        self._dimensions = self._model.get_sentence_embedding_dimension()
        logger.info("Embedding model loaded. Output dimensions: %d", self._dimensions)

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:  # double-checked locking
                    settings = get_settings()
                    cls._instance = cls(settings.EMBEDDING_MODEL_NAME)
        return cls._instance

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def embed(self, text: str) -> List[float]:
        """Synchronous embed. Prefer embed_async() from async request handlers."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text.")
        vector: np.ndarray = self._model.encode(
            text,
            normalize_embeddings=True,  # pre-normalize so cosine == dot product
            show_progress_bar=False,
        )
        return vector.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        vectors: np.ndarray = self._model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32,
        )
        return vectors.tolist()

    async def embed_async(self, text: str) -> List[float]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.embed, text)

    async def embed_batch_async(self, texts: List[str]) -> List[List[float]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.embed_batch, texts)


def get_embedding_service() -> EmbeddingService:
    """FastAPI dependency accessor for the embedding singleton."""
    return EmbeddingService.get_instance()

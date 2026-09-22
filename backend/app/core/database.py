"""
Async MongoDB client lifecycle management using Motor.

A single AsyncIOMotorClient is created at application startup and reused
for the lifetime of the process (Motor manages its own connection pool
internally, so per-request clients are unnecessary and wasteful).
"""
from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class MongoManager:
    """Holds the singleton Motor client/database instances for the app."""

    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongo_manager = MongoManager()


async def connect_to_mongo() -> None:
    """Open the Mongo connection. Call once from the FastAPI startup event."""
    settings = get_settings()
    logger.info("Connecting to MongoDB at %s", settings.MONGODB_DB_NAME)

    mongo_manager.client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=8000,
    )
    mongo_manager.db = mongo_manager.client[settings.MONGODB_DB_NAME]

    try:
        # The ping command is cheap and confirms auth + network reachability
        # immediately at startup rather than failing silently on first query.
        await mongo_manager.client.admin.command("ping")
        logger.info("MongoDB connection established successfully.")
    except ConnectionFailure as exc:
        logger.error("Failed to connect to MongoDB: %s", exc)
        raise

    await _ensure_indexes()


async def close_mongo_connection() -> None:
    """Close the Mongo connection. Call once from the FastAPI shutdown event."""
    if mongo_manager.client is not None:
        mongo_manager.client.close()
        logger.info("MongoDB connection closed.")


async def _ensure_indexes() -> None:
    """
    Create standard (non-vector) indexes idempotently.

    The Atlas Vector Search index itself (`$vectorSearch`) cannot be created
    through a normal `create_index` call -- it must be created via the Atlas
    UI, Atlas CLI, or the `create_search_index` admin command on a cluster
    that supports it. That definition lives in
    `app/services/matcher.py::VECTOR_INDEX_DEFINITION` for reference/tooling.
    """
    assert mongo_manager.db is not None

    resumes = mongo_manager.db["resumes"]
    jobs = mongo_manager.db["job_descriptions"]

    await resumes.create_index("email")
    await resumes.create_index("created_at")
    await jobs.create_index("created_at")

    logger.info("Standard MongoDB indexes ensured.")


def get_database() -> AsyncIOMotorDatabase:
    """
    Returns the active database instance. Raises if called before
    `connect_to_mongo()` has run (i.e. outside the app lifespan).
    """
    if mongo_manager.db is None:
        raise RuntimeError(
            "Database has not been initialized. "
            "Ensure connect_to_mongo() ran during application startup."
        )
    return mongo_manager.db

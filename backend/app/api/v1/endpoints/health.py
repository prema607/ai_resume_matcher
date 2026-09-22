from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from app.api.deps import get_db

router = APIRouter()


@router.get("", summary="Liveness / readiness probe")
async def health_check(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    """
    Returns 200 with connection status. Used by Docker HEALTHCHECK and
    orchestrators (Kubernetes liveness/readiness probes, load balancers).
    """
    mongo_ok = True
    try:
        await db.command("ping")
    except PyMongoError:
        mongo_ok = False

    return {
        "status": "ok" if mongo_ok else "degraded",
        "mongodb": "connected" if mongo_ok else "unreachable",
    }

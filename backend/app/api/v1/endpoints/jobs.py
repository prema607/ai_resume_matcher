from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_db, get_embedder
from app.schemas.job import (
    DeleteResponse,
    JobDescriptionCreate,
    JobDescriptionResponse,
    JobDescriptionUpdate,
    JobListResponse,
)
from app.services.embedder import EmbeddingService

router = APIRouter()


def _embedding_source_text(title: str, description: str, required_skills: list[str]) -> str:
    """
    Builds the text that gets embedded for a job description. Skills are
    appended explicitly since they carry strong matching signal that might
    otherwise be diluted in a long free-text description.
    """
    skills_line = f"Required skills: {', '.join(required_skills)}." if required_skills else ""
    return f"{title}. {description} {skills_line}".strip()


@router.post(
    "",
    response_model=JobDescriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a job description and generate its embedding",
)
async def create_job(
    payload: JobDescriptionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    embedder: EmbeddingService = Depends(get_embedder),
) -> JobDescriptionResponse:
    embedding = await embedder.embed_async(
        _embedding_source_text(payload.title, payload.description, payload.required_skills)
    )

    now = datetime.now(timezone.utc)
    document = {
        "title": payload.title,
        "description": payload.description,
        "required_skills": payload.required_skills,
        "embedding": embedding,
        "created_at": now,
    }
    result = await db["job_descriptions"].insert_one(document)

    return JobDescriptionResponse(
        id=str(result.inserted_id),
        title=payload.title,
        description=payload.description,
        required_skills=payload.required_skills,
        created_at=now,
    )


@router.get("", response_model=JobListResponse, summary="List job descriptions")
async def list_jobs(
    db: AsyncIOMotorDatabase = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None, description="Case-insensitive substring match on job title."),
) -> JobListResponse:
    query: dict = {}
    if search:
        query["title"] = {"$regex": search, "$options": "i"}

    total = await db["job_descriptions"].count_documents(query)
    cursor = (
        db["job_descriptions"]
        .find(query, {"embedding": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    items = [
        JobDescriptionResponse(
            id=str(doc["_id"]),
            title=doc["title"],
            description=doc["description"],
            required_skills=doc.get("required_skills", []),
            created_at=doc["created_at"],
        )
        async for doc in cursor
    ]

    return JobListResponse(total=total, items=items)


@router.get("/{job_id}", response_model=JobDescriptionResponse, summary="Get a job description")
async def get_job(job_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> JobDescriptionResponse:
    doc = await _fetch_job_or_404(db, job_id)
    return JobDescriptionResponse(
        id=str(doc["_id"]),
        title=doc["title"],
        description=doc["description"],
        required_skills=doc.get("required_skills", []),
        created_at=doc["created_at"],
    )


@router.patch("/{job_id}", response_model=JobDescriptionResponse, summary="Update a job description")
async def update_job(
    job_id: str,
    payload: JobDescriptionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    embedder: EmbeddingService = Depends(get_embedder),
) -> JobDescriptionResponse:
    doc = await _fetch_job_or_404(db, job_id)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")

    merged = {**doc, **updates}

    # Re-embed if any field feeding the embedding text changed.
    if any(key in updates for key in ("title", "description", "required_skills")):
        merged["embedding"] = await embedder.embed_async(
            _embedding_source_text(
                merged["title"], merged["description"], merged.get("required_skills", [])
            )
        )

    updates_to_write = {k: v for k, v in merged.items() if k not in ("_id",)}
    await db["job_descriptions"].update_one({"_id": doc["_id"]}, {"$set": updates_to_write})

    refreshed = await db["job_descriptions"].find_one({"_id": doc["_id"]})
    return JobDescriptionResponse(
        id=str(refreshed["_id"]),
        title=refreshed["title"],
        description=refreshed["description"],
        required_skills=refreshed.get("required_skills", []),
        created_at=refreshed["created_at"],
    )


@router.delete("/{job_id}", response_model=DeleteResponse, summary="Delete a job description")
async def delete_job(job_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> DeleteResponse:
    doc = await _fetch_job_or_404(db, job_id)
    await db["job_descriptions"].delete_one({"_id": doc["_id"]})
    return DeleteResponse(id=job_id, deleted=True)


async def _fetch_job_or_404(db: AsyncIOMotorDatabase, job_id: str) -> dict:
    try:
        object_id = ObjectId(job_id)
    except InvalidId as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job id.") from exc

    doc = await db["job_descriptions"].find_one({"_id": object_id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found.")
    return doc

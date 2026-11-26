"""Local-dataset bulk import endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_db
from app.core.config import get_settings
from app.services.bulk_importer import (
    run_bulk_import,
    retry_failed_bulk_import,
    normalize_category,
)
router = APIRouter()


@router.post("/start", summary="Start importing PDFs from the configured dataset folder")
async def start_bulk_import(
    background_tasks: BackgroundTasks,
    max_files: int = Query(1000, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    settings = get_settings()
    root = Path(settings.BULK_IMPORT_ROOT).expanduser().resolve()

    if not root.exists() or not root.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Configured bulk import folder does not exist: {root}",
        )

    active = await db["bulk_import_jobs"].find_one(
        {"status": {"$in": ["queued", "processing"]}},
        {"_id": 1},
    )
    if active:
        raise HTTPException(
            status_code=409,
            detail=f"An import job is already active: {active['_id']}",
        )

    pdf_paths = sorted(
        (path for path in root.rglob("*") if path.is_file() and path.suffix.lower() == ".pdf"),
        key=lambda path: str(path).lower(),
    )[:max_files]
    
    if not pdf_paths:
        raise HTTPException(status_code=404, detail="No PDF files found in the configured folder.")

    files = []
    for path in pdf_paths:
        try:
            path.resolve().relative_to(root)
        except ValueError:
            continue
        source_folder = path.parent.name
        files.append({
            "path": str(path.resolve()),
            "file_name": path.name,
            "source_folder": source_folder,
            "category": normalize_category(source_folder),
        })

    if not files:
        raise HTTPException(status_code=404, detail="No valid PDF files found.")

    job_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    await db["bulk_import_jobs"].insert_one({
        "_id": job_id,
        "status": "queued",
        "total": len(files),
        "processed": 0,
        "imported": 0,
        "skipped_duplicates": 0,
        "failed": 0,
        "next_index": 0,
        "files": files,
        "errors": [],
        "created_at": now,
        "updated_at": now,
    })

    background_tasks.add_task(run_bulk_import, job_id)
    return {
        "job_id": job_id,
        "status": "queued",
        "total_files": len(files),
        "message": "Bulk import started. Use the status endpoint to monitor progress.",
    }


@router.get("/{job_id}", summary="Get bulk import progress")
async def get_bulk_import_status(
    job_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    job = await db["bulk_import_jobs"].find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Bulk import job not found.")

    return {
        "job_id": job["_id"],
        "status": job.get("status"),
        "total": job.get("total", 0),
        "processed": job.get("processed", 0),
        "imported": job.get("imported", 0),
        "skipped_duplicates": job.get("skipped_duplicates", 0),
        "failed": job.get("failed", 0),
        "next_index": job.get("next_index", 0),
        "errors": job.get("errors", [])[-30:],
        "last_error": job.get("last_error"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "completed_at": job.get("completed_at"),
    }


@router.post("/{job_id}/resume", summary="Resume an interrupted bulk import")
async def resume_bulk_import(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    job = await db["bulk_import_jobs"].find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Bulk import job not found.")
    if job.get("status") == "completed":
        raise HTTPException(status_code=409, detail="This import job is already completed.")

    await db["bulk_import_jobs"].update_one(
        {"_id": job_id},
        {"$set": {"status": "queued", "updated_at": datetime.now(timezone.utc)}},
    )
    background_tasks.add_task(run_bulk_import, job_id)
    return {"job_id": job_id, "status": "queued", "next_index": job.get("next_index", 0)}

@router.post("/{job_id}/retry-failed", summary="Retry failed PDFs")
async def retry_failed_import(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    job = await db["bulk_import_jobs"].find_one({"_id": job_id})

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Bulk import job not found.",
        )

    if job.get("status") in ["queued", "processing"]:
        raise HTTPException(
            status_code=409,
            detail="An import job is already active.",
        )

    if job.get("failed", 0) == 0:
        raise HTTPException(
            status_code=400,
            detail="There are no failed PDFs to retry.",
        )

    background_tasks.add_task(retry_failed_bulk_import, job_id)

    return {
        "job_id": job_id,
        "status": "retry_queued",
        "failed_files": job.get("failed", 0),
        "message": "Retry of failed PDFs has been scheduled.",
    }

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_db, get_embedder, get_parser, get_storage
from app.core.config import Settings, get_settings
from app.schemas.resume import (
    DeleteResponse,
    ResumeDetail,
    ResumeListItem,
    ResumeListResponse,
    ResumeUploadResponse,
)
from app.services.embedder import EmbeddingService
from app.services.extractor import PDFExtractionError, extract_text_from_pdf_bytes
from app.services.parser import ResumeParser, ResumeParsingError
from app.storage.local_storage import LocalStorageDriver

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a resume PDF for parsing, embedding, and storage",
)
async def upload_resume(
    file: UploadFile = File(..., description="Candidate resume as a PDF file."),
    db: AsyncIOMotorDatabase = Depends(get_db),
    storage: LocalStorageDriver = Depends(get_storage),
    parser: ResumeParser = Depends(get_parser),
    embedder: EmbeddingService = Depends(get_embedder),
    settings: Settings = Depends(get_settings),
) -> ResumeUploadResponse:
    """
    End-to-end resume ingestion pipeline:
      1. Persist the raw PDF to disk.
      2. Extract raw text via PyMuPDF.
      3. Parse raw text into structured JSON via the LLM.
      4. Embed the structured summary into a 384-dim vector.
      5. Persist everything as a single `resumes` document.
    """
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are accepted.",
        )

    # --- 1. Save to disk -----------------------------------------------------
    try:
        file_path = await storage.save(file, max_size_bytes=settings.max_upload_size_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    pdf_bytes = storage.read_bytes(file_path)

    # --- 2. Extract raw text ---------------------------------------------------
    try:
        raw_text = extract_text_from_pdf_bytes(pdf_bytes)
    except PDFExtractionError as exc:
        storage.delete(file_path)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    # --- 3. Structured parse via LLM --------------------------------------------
    try:
        parsed = parser.parse(raw_text)
    except ResumeParsingError as exc:
        storage.delete(file_path)
        logger.error("Resume parsing failed for %s: %s", file_path, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to parse resume content via the language model. Please try again.",
        ) from exc

    # --- 4. Embed the summary -------------------------------------------------
    try:
        embedding = await embedder.embed_async(parsed.summary)
    except ValueError as exc:
        storage.delete(file_path)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    # --- 5. Persist ------------------------------------------------------------
    now = datetime.now(timezone.utc)
    document = {
        "candidate_name": parsed.full_name,
        "email": parsed.email,
        "phone": parsed.phone,
        "file_path": file_path,
        "raw_text": raw_text,
        "parsed_json": parsed.model_dump(),
        "embedding": embedding,
        "created_at": now,
    }

    result = await db["resumes"].insert_one(document)

    return ResumeUploadResponse(
        id=str(result.inserted_id),
        candidate_name=parsed.full_name,
        email=parsed.email,
        phone=parsed.phone,
        skills=parsed.skills,
        summary=parsed.summary,
        created_at=now,
    )


@router.get("", response_model=ResumeListResponse, summary="List stored resumes")
async def list_resumes(
    db: AsyncIOMotorDatabase = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None, description="Case-insensitive substring match on candidate name."),
) -> ResumeListResponse:
    query: dict = {}
    if search:
        query["candidate_name"] = {"$regex": search, "$options": "i"}

    total = await db["resumes"].count_documents(query)
    cursor = (
        db["resumes"]
        .find(query, {"raw_text": 0, "embedding": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        items.append(
            ResumeListItem(
                id=str(doc["_id"]),
                candidate_name=doc.get("candidate_name", "Unknown"),
                email=doc.get("email"),
                phone=doc.get("phone"),
                skills=doc.get("parsed_json", {}).get("skills", []),
                created_at=doc["created_at"],
            )
        )

    return ResumeListResponse(total=total, items=items)


@router.get("/{resume_id}", response_model=ResumeDetail, summary="Get full resume detail")
async def get_resume(resume_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> ResumeDetail:
    doc = await _fetch_resume_or_404(db, resume_id)
    return ResumeDetail(
        id=str(doc["_id"]),
        candidate_name=doc.get("candidate_name", "Unknown"),
        email=doc.get("email"),
        phone=doc.get("phone"),
        file_path=doc["file_path"],
        raw_text=doc.get("raw_text", ""),
        parsed_json=doc.get("parsed_json", {}),
        created_at=doc["created_at"],
    )


@router.delete("/{resume_id}", response_model=DeleteResponse, summary="Delete a resume")
async def delete_resume(
    resume_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    storage: LocalStorageDriver = Depends(get_storage),
) -> DeleteResponse:
    doc = await _fetch_resume_or_404(db, resume_id)

    await db["resumes"].delete_one({"_id": doc["_id"]})
    storage.delete(doc["file_path"])

    return DeleteResponse(id=resume_id, deleted=True)


async def _fetch_resume_or_404(db: AsyncIOMotorDatabase, resume_id: str) -> dict:
    try:
        object_id = ObjectId(resume_id)
    except InvalidId as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resume id.") from exc

    doc = await db["resumes"].find_one({"_id": object_id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    return doc

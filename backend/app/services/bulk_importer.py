
"""
Sequential, resumable bulk PDF importer.

The source dataset is read-only. Each successfully imported PDF is copied
into the application's storage directory before its MongoDB record is saved.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.database import get_database
from app.services.embedder import get_embedding_service
from app.services.extractor import extract_text_from_pdf_bytes
from app.services.parser import get_resume_parser
from app.services.local_ocr import extract_text_with_tesseract

logger = logging.getLogger(__name__)


# ---------------------------------------------------------
# OCR: Gemini first, Tesseract fallback
# ---------------------------------------------------------

def _extract_page_text_with_fallback(image_bytes: bytes, parser) -> str:
    """Try Gemini OCR first, then use local Tesseract if Gemini fails."""
    try:
        return parser.extract_text_from_image(image_bytes)

    except Exception as gemini_error:
        logger.warning(
            "Gemini OCR failed. Trying Tesseract fallback: %s",
            gemini_error,
        )

        try:
            return extract_text_with_tesseract(image_bytes)

        except Exception as tesseract_error:
            raise RuntimeError(
                f"Both OCR methods failed. "
                f"Gemini: {gemini_error}. "
                f"Tesseract: {tesseract_error}"
            ) from tesseract_error


# ---------------------------------------------------------
# Category normalization
# ---------------------------------------------------------

_CATEGORY_ALIASES = {
    "agricultural": "agriculture",
    "architects": "architect",
    "businessanalyst": "business analyst",
    "civilengineer": "civil engineer",
    "datascience": "data science",
    "devopsengineer": "devops engineer",
    "digital": "digital media",
    "dot": "dotnet developer",
    "dotnetdeveloper": "dotnet developer",
    "electricalengineer": "electrical engineer",
    "etl": "etl developer",
    "food": "food and beverages",
    "foodbeverages": "food and beverages",
    "healthfitness": "health and fitness",
    "healthfitnessresumes": "health and fitness",
    "humanresources": "hr",
    "informationtechnology": "information technology",
    "it": "information technology",
    "javadeveloper": "java developer",
    "managment": "management",
    "mechanicalengineer": "mechanical engineer",
    "nse": "network security engineer",
    "operationmanager": "operations manager",
    "operationsmanager": "operations manager",
    "pbo": "bpo",
    "public": "public relations",
    "pythondeveloper": "python developer",
    "sapdeveloper": "sap developer",
    "webdesigning": "web designing",
    "accountant": "accountant",
    "advocate": "advocate",
    "apparel": "apparel",
    "arts": "arts",
    "automobile": "automobile",
    "aviation": "aviation",
    "banking": "banking",
    "blockchain": "blockchain",
    "consult": "consultant",
    "consultant": "consultant",
    "database": "database",
    "design": "design",
    "designer": "design",
    "education": "education",
    "finance": "finance",
    "hr": "hr",
    "management": "management",
    "pmo": "pmo",
    "react": "react developer",
    "reactdeveloper": "react developer",
    "sales": "sales",
    "sql": "sql developer",
    "sqldeveloper": "sql developer",
    "testing": "testing",
    "digitalmedia": "digital media",
    "businessanalystresumes": "business analyst",
    "datascienceresumes": "data science",
    "pythondeveloperresumes": "python developer",
    "javadeveloperresumes": "java developer",
    "reactdeveloperresumes": "react developer",
    "sapdeveloperresumes": "sap developer",
    "sql developer": "sql developer",
}


def normalize_category(folder_name: str) -> str:
    """Normalize common aliases while preserving source_folder separately."""
    cleaned = folder_name.strip().lower().replace("_", " ").replace("-", " ")
    cleaned = " ".join(cleaned.split())

    if cleaned.endswith(" resumes"):
        cleaned = cleaned[:-8].strip()

    compact = "".join(ch for ch in cleaned if ch.isalnum())

    return _CATEGORY_ALIASES.get(compact, cleaned)


# ---------------------------------------------------------
# Shared resume processing
# ---------------------------------------------------------

async def _process_resume(
    item: dict[str, Any],
    job_id: str,
    parser,
    embedder,
    resumes,
    storage_dir: Path,
    settings,
) -> str:
    """
    Extract, parse, embed and save one resume.

    Returns:
        imported or skipped_duplicate
    """
    source_path = Path(item["path"])
    stored_path: Path | None = None

    try:
        pdf_bytes = await asyncio.to_thread(source_path.read_bytes)

        if len(pdf_bytes) > settings.max_upload_size_bytes:
            raise ValueError(
                f"PDF exceeds configured upload limit "
                f"({settings.MAX_UPLOAD_SIZE_MB} MB)."
            )

        file_hash = hashlib.sha256(pdf_bytes).hexdigest()

        existing = await resumes.find_one(
            {"file_hash": file_hash},
            {"_id": 1},
        )

        if existing:
            return "skipped_duplicate"

        # Extract PDF text. Scanned pages use Gemini first,
        # followed by local Tesseract if Gemini fails.
        raw_text = await asyncio.to_thread(
            extract_text_from_pdf_bytes,
            pdf_bytes,
            lambda image_bytes: _extract_page_text_with_fallback(
                image_bytes, parser
            ),
        )

        parsed = await asyncio.to_thread(parser.parse, raw_text)
        embedding = await embedder.embed_async(parsed.summary)

        stored_path = storage_dir / f"{uuid.uuid4().hex}.pdf"

        await asyncio.to_thread(
            shutil.copyfile,
            source_path,
            stored_path,
        )

        document = {
            "candidate_name": parsed.full_name,
            "email": parsed.email,
            "phone": parsed.phone,
            "file_path": str(stored_path),
            "raw_text": raw_text,
            "parsed_json": parsed.model_dump(),
            "embedding": embedding,
            "created_at": datetime.now(timezone.utc),
            "file_hash": file_hash,
            "dataset_category": item["category"],
            "source_folder": item["source_folder"],
            "source_file_name": item["file_name"],
            "import_batch_id": job_id,
        }

        try:
            await resumes.insert_one(document)
            return "imported"

        except DuplicateKeyError:
            stored_path.unlink(missing_ok=True)
            return "skipped_duplicate"

    except Exception:
        if stored_path:
            stored_path.unlink(missing_ok=True)
        raise


# ---------------------------------------------------------
# Initial bulk import
# ---------------------------------------------------------

async def run_bulk_import(job_id: str) -> None:
    """Process the remaining files for a persisted import job."""

    db = get_database()
    jobs = db["bulk_import_jobs"]
    resumes = db["resumes"]

    settings = get_settings()
    parser = get_resume_parser()
    embedder = get_embedding_service()

    job = await jobs.find_one({"_id": job_id})

    if not job:
        logger.error("Bulk import job %s was not found.", job_id)
        return

    await jobs.update_one(
        {"_id": job_id},
        {
            "$set": {
                "status": "processing",
                "started_at": datetime.now(timezone.utc),
            }
        },
    )

    files = job.get("files", [])
    start_index = int(job.get("next_index", 0))

    storage_dir = Path(settings.STORAGE_DIR)
    storage_dir.mkdir(parents=True, exist_ok=True)

    try:
        for index in range(start_index, len(files)):
            item = files[index]
            source_path = Path(item["path"])

            outcome = "failed"
            error_message = None

            try:
                outcome = await _process_resume(
                    item=item,
                    job_id=job_id,
                    parser=parser,
                    embedder=embedder,
                    resumes=resumes,
                    storage_dir=storage_dir,
                    settings=settings,
                )

            except Exception as exc:
                error_message = f"{type(exc).__name__}: {exc}"
                logger.exception(
                    "Bulk import failed for %s",
                    source_path,
                )

            update: dict[str, Any] = {
                "$set": {
                    "next_index": index + 1,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$inc": {"processed": 1},
            }

            if outcome == "imported":
                update["$inc"]["imported"] = 1

            elif outcome == "skipped_duplicate":
                update["$inc"]["skipped_duplicates"] = 1

            else:
                update["$inc"]["failed"] = 1

                await jobs.update_one(
                    {"_id": job_id},
                    {
                        "$push": {
                            "errors": {
                                "file_name": item["file_name"],
                                "source_folder": item["source_folder"],
                                "error": (
                                    error_message or "Unknown error"
                                )[:1000],
                            }
                        }
                    },
                )

            await jobs.update_one({"_id": job_id}, update)

        final_job = await jobs.find_one(
            {"_id": job_id},
            {"failed": 1},
        )

        remaining_failures = (
            final_job.get("failed", 0) if final_job else 0
        )

        await jobs.update_one(
            {"_id": job_id},
            {
                "$set": {
                    "status": (
                        "completed_with_errors"
                        if remaining_failures > 0
                        else "completed"
                    ),
                    "completed_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        logger.info(
            "Bulk import %s finished. Remaining failures: %s",
            job_id,
            remaining_failures,
        )

    except Exception as exc:
        logger.exception(
            "Bulk import job %s stopped unexpectedly.",
            job_id,
        )

        await jobs.update_one(
            {"_id": job_id},
            {
                "$set": {
                    "status": "interrupted",
                    "last_error": f"{type(exc).__name__}: {exc}"[:1000],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )


# ---------------------------------------------------------
# Retry failed PDFs
# ---------------------------------------------------------

async def retry_failed_bulk_import(job_id: str) -> None:
    """Retry only the PDFs recorded as failed in an existing import job."""

    db = get_database()
    jobs = db["bulk_import_jobs"]
    resumes = db["resumes"]

    settings = get_settings()
    parser = get_resume_parser()
    embedder = get_embedding_service()

    job = await jobs.find_one({"_id": job_id})

    if not job:
        logger.error("Bulk import job %s was not found.", job_id)
        return

    files = job.get("files", [])
    errors = job.get("errors", [])

    # Match failed error records to their original file entries.
    failed_items = []
    used_indices = set()

    for error in errors:
        for index, item in enumerate(files):
            if index in used_indices:
                continue

            if (
                item.get("file_name") == error.get("file_name")
                and item.get("source_folder") == error.get("source_folder")
            ):
                failed_items.append((index, item))
                used_indices.add(index)
                break

    if not failed_items:
        logger.info("No failed PDFs to retry for job %s.", job_id)
        return

    await jobs.update_one(
        {"_id": job_id},
        {
            "$set": {
                "status": "processing",
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    storage_dir = Path(settings.STORAGE_DIR)
    storage_dir.mkdir(parents=True, exist_ok=True)

    for index, item in failed_items:
        source_path = Path(item["path"])

        try:
            outcome = await _process_resume(
                item=item,
                job_id=job_id,
                parser=parser,
                embedder=embedder,
                resumes=resumes,
                storage_dir=storage_dir,
                settings=settings,
            )

            # Resolve the previous failed attempt.
            await jobs.update_one(
                {"_id": job_id},
                {
                    "$inc": {
                        "failed": -1,
                        "imported": 1 if outcome == "imported" else 0,
                        "skipped_duplicates": (
                            1 if outcome == "skipped_duplicate" else 0
                        ),
                    },
                    "$pull": {
                        "errors": {
                            "file_name": item["file_name"],
                            "source_folder": item["source_folder"],
                        }
                    },
                    "$set": {
                        "updated_at": datetime.now(timezone.utc)
                    },
                },
            )

            logger.info(
                "Retry succeeded for %s: %s",
                source_path,
                outcome,
            )

        except Exception as exc:
            logger.exception(
                "Retry failed for %s",
                source_path,
            )

            # Keep the failed count unchanged. Replace the old error
            # with the latest error message.
            await jobs.update_one(
                {"_id": job_id},
                {
                    "$pull": {
                        "errors": {
                            "file_name": item["file_name"],
                            "source_folder": item["source_folder"],
                        }
                    }
                },
            )

            await jobs.update_one(
                {"_id": job_id},
                {
                    "$push": {
                        "errors": {
                            "file_name": item["file_name"],
                            "source_folder": item["source_folder"],
                            "error": f"{type(exc).__name__}: {exc}"[:1000],
                        }
                    },
                    "$set": {
                        "updated_at": datetime.now(timezone.utc)
                    },
                },
            )

    remaining = await jobs.find_one(
        {"_id": job_id},
        {"failed": 1},
    )

    remaining_failures = (
        remaining.get("failed", 0) if remaining else 0
    )

    await jobs.update_one(
        {"_id": job_id},
        {
            "$set": {
                "status": (
                    "completed_with_errors"
                    if remaining_failures > 0
                    else "completed"
                ),
                "completed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    logger.info(
        "Retry finished for job %s. Remaining failures: %s",
        job_id,
        remaining_failures,
    )

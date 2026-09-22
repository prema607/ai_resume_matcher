"""
Local filesystem storage driver for raw resume PDFs.

Kept behind a small interface (`save`, `delete`, `read`) so it can be
swapped for an S3/GCS-backed implementation later without touching the
endpoint or service layer that calls it.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import UploadFile

logger = logging.getLogger(__name__)

_ALLOWED_EXTENSION = ".pdf"


class LocalStorageDriver:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, upload_file: UploadFile, max_size_bytes: int) -> str:
        """
        Streams an UploadFile to disk under a UUID-prefixed filename to
        avoid collisions/path traversal from user-supplied filenames.
        Returns the relative file path that should be persisted in Mongo.

        Raises ValueError if the file exceeds max_size_bytes or isn't a PDF.
        """
        original_name = upload_file.filename or "resume.pdf"
        suffix = Path(original_name).suffix.lower()
        if suffix != _ALLOWED_EXTENSION:
            raise ValueError(f"Unsupported file type '{suffix}'. Only PDF files are accepted.")

        safe_name = f"{uuid.uuid4().hex}{_ALLOWED_EXTENSION}"
        destination = self.base_dir / safe_name

        size_written = 0
        chunk_size = 1024 * 1024  # 1 MB

        try:
            with destination.open("wb") as out_file:
                while True:
                    chunk = await upload_file.read(chunk_size)
                    if not chunk:
                        break
                    size_written += len(chunk)
                    if size_written > max_size_bytes:
                        out_file.close()
                        destination.unlink(missing_ok=True)
                        raise ValueError(
                            f"File exceeds maximum allowed size of {max_size_bytes // (1024 * 1024)} MB."
                        )
                    out_file.write(chunk)
        finally:
            await upload_file.close()

        if size_written == 0:
            destination.unlink(missing_ok=True)
            raise ValueError("Uploaded file is empty.")

        logger.info("Stored resume PDF at %s (%d bytes)", destination, size_written)
        return str(destination)

    def delete(self, file_path: str) -> bool:
        path = Path(file_path)
        try:
            path.unlink(missing_ok=True)
            return True
        except OSError as exc:
            logger.warning("Failed to delete file %s: %s", file_path, exc)
            return False

    def read_bytes(self, file_path: str) -> bytes:
        return Path(file_path).read_bytes()

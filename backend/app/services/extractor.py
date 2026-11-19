
"""
Extract text from resume PDFs using PyMuPDF.
Uses Gemini Vision OCR for scanned/image-based pages when needed.
"""
from __future__ import annotations

import logging
from typing import Callable

import fitz

logger = logging.getLogger(__name__)


class PDFExtractionError(Exception):
    """Raised when a PDF cannot be opened or yields no usable text."""


def extract_text_from_pdf_bytes(
    pdf_bytes: bytes,
    ocr_callback: Callable[[bytes], str] | None = None,
) -> str:
    """
    Extract text page by page.

    Pages with little/no selectable text are rendered as PNG images
    and passed to the supplied OCR callback.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise PDFExtractionError(f"Could not open PDF: {exc}") from exc

    if doc.page_count == 0:
        doc.close()
        raise PDFExtractionError("PDF has zero pages.")

    all_text_parts: list[str] = []

    try:
        for page_index in range(doc.page_count):
            page = doc[page_index]

            blocks = page.get_text("blocks")
            sorted_blocks = sorted(
                blocks,
                key=lambda b: (round(b[1] / 10) * 10, b[0]),
            )

            page_text_parts = [
                b[4].strip()
                for b in sorted_blocks
                if isinstance(b[4], str) and b[4].strip()
            ]
            page_text = "\n".join(page_text_parts).strip()

            # Use OCR for scanned pages or pages with very little
            # selectable text but embedded images.
            has_images = bool(page.get_images(full=True))
            needs_ocr = (
                len(page_text) < 80
                and (not page_text or has_images)
            )

            if needs_ocr and ocr_callback is not None:
                logger.info(
                    "Running OCR on PDF page %d.",
                    page_index + 1,
                )

                try:
                    pixmap = page.get_pixmap(
                        matrix=fitz.Matrix(2, 2),
                        alpha=False,
                    )
                    image_bytes = pixmap.tobytes("png")
                    ocr_text = ocr_callback(image_bytes).strip()

                    if ocr_text:
                        page_text = ocr_text
                except Exception as exc:
                    raise PDFExtractionError(
                        f"OCR failed on PDF page {page_index + 1}: {exc}"
                    ) from exc

            if page_text:
                all_text_parts.append(page_text)

    finally:
        doc.close()

    full_text = "\n\n".join(all_text_parts).strip()

    if not full_text:
        raise PDFExtractionError(
            "No usable text could be extracted from this PDF. "
            "Please check that the document contains readable text or images."
        )

    return _normalize_whitespace(full_text)


def _normalize_whitespace(text: str) -> str:
    """Collapse excessive blank lines and surrounding whitespace."""
    lines = [line.strip() for line in text.splitlines()]
    normalized_lines: list[str] = []
    blank_streak = 0

    for line in lines:
        if line == "":
            blank_streak += 1
            if blank_streak > 1:
                continue
        else:
            blank_streak = 0

        normalized_lines.append(line)

    return "\n".join(normalized_lines).strip()

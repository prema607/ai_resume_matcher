"""
Raw text extraction from resume PDFs using PyMuPDF (fitz).

PyMuPDF is preferred over pdfminer/PyPDF2 here for speed and because it
handles multi-column resume layouts (common in real-world resumes)
noticeably better via its block-based text extraction mode.
"""
from __future__ import annotations

import logging

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


class PDFExtractionError(Exception):
    """Raised when a PDF cannot be opened or yields no usable text."""


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """
    Extracts and returns cleaned plain text from PDF file bytes.

    Text is pulled per-page using the "blocks" extraction mode, which
    groups text by layout block (paragraph/column) rather than raw
    left-to-right reading order. Blocks are sorted top-to-bottom,
    left-to-right within each page, which handles two-column resumes
    much better than naive `page.get_text()`.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:  # fitz raises its own RuntimeError subclasses
        raise PDFExtractionError(f"Could not open PDF: {exc}") from exc

    if doc.page_count == 0:
        doc.close()
        raise PDFExtractionError("PDF has zero pages.")

    all_text_parts: list[str] = []

    try:
        for page_index in range(doc.page_count):
            page = doc[page_index]
            blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)

            # Sort blocks reading-order style: top-to-bottom, then left-to-right.
            # Round y0 to bucket blocks that are roughly on the same visual line.
            sorted_blocks = sorted(blocks, key=lambda b: (round(b[1] / 10) * 10, b[0]))

            page_text_parts = [
                b[4].strip() for b in sorted_blocks if isinstance(b[4], str) and b[4].strip()
            ]
            if page_text_parts:
                all_text_parts.append("\n".join(page_text_parts))
    finally:
        doc.close()

    full_text = "\n\n".join(all_text_parts).strip()

    if not full_text:
        raise PDFExtractionError(
            "No extractable text found in PDF. It may be a scanned/image-only document "
            "requiring OCR, which this pipeline does not currently support."
        )

    return _normalize_whitespace(full_text)


def _normalize_whitespace(text: str) -> str:
    """Collapses excessive blank lines/spaces left over from PDF layout artifacts."""
    lines = [line.strip() for line in text.splitlines()]
    # Collapse 3+ consecutive blank lines down to a single blank line.
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

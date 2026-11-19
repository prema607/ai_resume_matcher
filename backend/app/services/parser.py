
"""
Converts resume text into ParsedResumeData using Google Gemini.
Also provides Gemini Vision OCR for scanned PDF pages.
"""
from __future__ import annotations

import json
import logging

from google import genai
from google.genai import types
from pydantic import ValidationError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings
from app.schemas.parsed_data import ParsedResumeData

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """
You are a precise resume parsing engine.

You will receive raw text extracted from a resume.

Rules:
1. Extract information exactly from the resume.
2. Do NOT invent information.
3. If information is missing, use null or empty lists.
4. Return ONLY valid JSON.
5. The JSON must strictly follow the provided schema.
6. Do not wrap JSON inside markdown code blocks.
"""


_OCR_PROMPT = """
You are an accurate OCR engine for resume documents.

Extract ALL readable text from this resume page.
Preserve names, email addresses, phone numbers, dates, skills,
education, work experience, headings, and project details.

Rules:
1. Do not summarize or interpret the resume.
2. Do not invent missing or unclear words.
3. Preserve the original wording as closely as possible.
4. Return only the extracted text.
5. If a word is unreadable, mark it as [unreadable].
"""


class ResumeParsingError(Exception):
    """Raised when Gemini fails to produce valid output."""


class ResumeParser:
    def __init__(self, api_key: str, model: str):
        self._client = genai.Client(api_key=api_key)
        self._model = model

    def extract_text_from_image(self, image_bytes: bytes) -> str:
        """
        Extract readable text from a rendered PDF page using Gemini Vision.
        """
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=[
                    _OCR_PROMPT,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type="image/png",
                    ),
                ],
            )

            if not response.text:
                raise ResumeParsingError(
                    "Gemini Vision returned empty OCR output."
                )

            return response.text.strip()

        except Exception as exc:
            logger.exception("Gemini Vision OCR failed.")
            raise ResumeParsingError(
                f"Could not extract text from scanned PDF page: {exc}"
            ) from exc

    @retry(
        retry=retry_if_exception_type((ResumeParsingError, Exception)),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def parse(self, raw_text: str) -> ParsedResumeData:
        """Parse resume text into validated structured data."""

        truncated_text = _truncate_for_context(raw_text)
        schema = ParsedResumeData.model_json_schema()

        prompt = f"""
{_SYSTEM_PROMPT}

JSON Schema:

{json.dumps(schema, indent=2)}

Resume Text:

{truncated_text}
"""

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=prompt,
            )

            if not response.text:
                raise ResumeParsingError(
                    "Gemini returned an empty response."
                )

            json_text = response.text.strip()

            if json_text.startswith("```json"):
                json_text = json_text.replace("```json", "", 1)

            if json_text.startswith("```"):
                json_text = json_text.replace("```", "", 1)

            if json_text.endswith("```"):
                json_text = json_text[:-3]

            data = json.loads(json_text.strip())

            return ParsedResumeData.model_validate(data)

        except ValidationError as exc:
            logger.warning(
                "Gemini output failed schema validation: %s",
                exc,
            )
            raise ResumeParsingError(
                f"Schema validation failed: {exc}"
            ) from exc

        except json.JSONDecodeError as exc:
            logger.warning(
                "Gemini returned invalid JSON: %s",
                exc,
            )
            raise ResumeParsingError(
                f"Invalid JSON returned by Gemini: {exc}"
            ) from exc

        except ResumeParsingError:
            raise

        except Exception:
            logger.exception("Resume parsing failed.")
            raise


def _truncate_for_context(
    text: str,
    max_chars: int = 15000,
) -> str:
    """Prevent extremely large resumes from exceeding token limits."""

    if len(text) <= max_chars:
        return text

    logger.info(
        "Truncating resume text from %d to %d chars.",
        len(text),
        max_chars,
    )

    return text[:max_chars]


_parser_singleton: ResumeParser | None = None


def get_resume_parser() -> ResumeParser:
    """FastAPI dependency accessor."""

    global _parser_singleton

    if _parser_singleton is None:
        settings = get_settings()
        _parser_singleton = ResumeParser(
            api_key=settings.GEMINI_API_KEY,
            model=settings.LLM_MODEL,
        )

    return _parser_singleton

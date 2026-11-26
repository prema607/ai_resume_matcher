
"""
Resume parser using Gemini with a local fallback.

Gemini is the primary parser. If the API is unavailable or its quota
is exhausted, a deterministic local parser extracts basic information.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from google import genai
from google.genai import types
from pydantic import ValidationError
from tenacity import (
    retry,
    retry_if_exception,
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


def _is_transient_error(exc: Exception) -> bool:
    """
    Retry temporary API/server errors only.

    In particular, HTTP 429 quota errors are NOT retried.
    """
    current = exc

    while current is not None:
        code = getattr(current, "code", None)
        status_code = getattr(current, "status_code", None)

        try:
            code = int(code)
        except (TypeError, ValueError):
            code = None

        try:
            status_code = int(status_code)
        except (TypeError, ValueError):
            status_code = None

        status = status_code or code

        if status in (408, 500, 502, 503, 504):
            return True

        if status == 429:
            return False

        current = current.__cause__ or current.__context__

    return False


class ResumeParser:
    def __init__(self, api_key: str, model: str):
        self._client = genai.Client(api_key=api_key)
        self._model = model

    @retry(
        retry=retry_if_exception(_is_transient_error),
        wait=wait_exponential(multiplier=2, min=2, max=16),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def extract_text_from_image(self, image_bytes: bytes) -> str:
        """Extract text from a rendered PDF page using Gemini Vision."""
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
            logger.warning("Gemini Vision OCR failed: %s", exc)
            raise ResumeParsingError(
                f"Could not extract text from scanned PDF page: {exc}"
            ) from exc

    def parse(self, raw_text: str) -> ParsedResumeData:
        """
        Parse resume text with Gemini.

        If Gemini fails for any reason, use the local parser instead.
        """
        if not raw_text or not raw_text.strip():
            return _local_parse("")

        try:
            truncated_text = _truncate_for_context(raw_text)
            schema = ParsedResumeData.model_json_schema()

            prompt = f"""
{_SYSTEM_PROMPT}

JSON Schema:

{json.dumps(schema, indent=2)}

Resume Text:

{truncated_text}
"""

            response = self._client.models.generate_content(
                model=self._model,
                contents=prompt,
            )

            if not response.text:
                raise ResumeParsingError(
                    "Gemini returned an empty response."
                )

            json_text = response.text.strip()

            if json_text.startswith("```"):
                json_text = re.sub(
                    r"^```(?:json)?\s*",
                    "",
                    json_text,
                    count=1,
                    flags=re.IGNORECASE,
                )
                json_text = re.sub(r"\s*```$", "", json_text)

            data = json.loads(json_text.strip())
            return ParsedResumeData.model_validate(data)

        except (ValidationError, json.JSONDecodeError) as exc:
            logger.warning(
                "Gemini returned invalid resume data. "
                "Using local parser: %s",
                exc,
            )

        except Exception as exc:
            logger.warning(
                "Gemini parsing unavailable. Using local parser: %s",
                exc,
            )

        return _local_parse(raw_text)


def _local_parse(raw_text: str) -> ParsedResumeData:
    """
    Extract basic resume information without an external API.

    This intentionally avoids guessing education and experience entries.
    """
    text = raw_text or ""
    full_name = _extract_name(text)
    email = _extract_email(text)
    phone = _extract_phone(text)
    skills = _extract_skills(text)
    summary = _build_local_summary(text, skills)

    logger.info(
        "Local parsing completed. Name: %s, skills found: %d",
        full_name,
        len(skills),
    )

    return ParsedResumeData(
        full_name=full_name,
        email=email,
        phone=phone,
        skills=skills,
        education=[],
        experience=[],
        summary=summary,
        total_experience_years=None,
    )


def _extract_name(text: str) -> str:
    """Try to identify a candidate name from the beginning of the resume."""
    excluded = {
        "resume",
        "curriculum vitae",
        "professional resume",
        "profile",
        "summary",
        "objective",
        "contact",
        "contact details",
        "education",
        "experience",
        "work experience",
        "skills",
        "technical skills",
        "projects",
        "certifications",
    }

    for line in text.splitlines()[:15]:
        candidate = line.strip().strip("|•- \t")

        if not candidate or candidate.lower() in excluded:
            continue

        if "@" in candidate or "://" in candidate:
            continue

        if re.search(r"\d", candidate):
            continue

        words = candidate.split()

        if not 2 <= len(words) <= 4:
            continue

        if not re.fullmatch(
            r"[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){1,3}",
            candidate,
        ):
            continue

        return candidate

    return "Unknown Candidate"


def _extract_email(text: str) -> Optional[str]:
    match = re.search(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        text,
    )
    return match.group(0) if match else None


def _extract_phone(text: str) -> Optional[str]:
    matches = re.findall(r"\+?\d[\d\s().-]{7,}\d", text)

    for match in matches:
        digits = re.sub(r"\D", "", match)

        if 8 <= len(digits) <= 15:
            return match.strip()

    return None


def _extract_skills(text: str) -> list[str]:
    """
    Find recognizable technical and professional skills.

    Results are returned in the order in which they appear in the resume.
    """
    known_skills = [
        "Python",
        "Java",
        "JavaScript",
        "TypeScript",
        "C",
        "C++",
        "C#",
        ".NET",
        "PHP",
        "Ruby",
        "Go",
        "Rust",
        "Kotlin",
        "Swift",
        "Dart",
        "SQL",
        "MySQL",
        "PostgreSQL",
        "MongoDB",
        "SQLite",
        "Oracle",
        "HTML",
        "CSS",
        "React",
        "Angular",
        "Vue.js",
        "Node.js",
        "Express.js",
        "Django",
        "Flask",
        "FastAPI",
        "Spring Boot",
        "ASP.NET",
        "REST API",
        "RESTful API",
        "GraphQL",
        "Machine Learning",
        "Deep Learning",
        "Artificial Intelligence",
        "Natural Language Processing",
        "Data Science",
        "Data Analysis",
        "Data Visualization",
        "Pandas",
        "NumPy",
        "Scikit-learn",
        "TensorFlow",
        "PyTorch",
        "OpenCV",
        "Power BI",
        "Tableau",
        "Excel",
        "AWS",
        "Azure",
        "Google Cloud",
        "Docker",
        "Kubernetes",
        "Git",
        "GitHub",
        "Linux",
        "Jenkins",
        "CI/CD",
        "Agile",
        "Scrum",
        "OOP",
        "Data Structures",
        "Algorithms",
        "Communication",
        "Leadership",
        "Problem Solving",
        "Teamwork",
        "Time Management",
    ]

    found = []

    for skill in known_skills:
        pattern = r"(?<!\w)" + re.escape(skill) + r"(?!\w)"

        match = re.search(pattern, text, flags=re.IGNORECASE)

        if match:
            found.append((match.start(), skill))

    found.sort(key=lambda item: item[0])

    # Remove case-insensitive duplicates while preserving document order.
    results = []
    seen = set()

    for _, skill in found:
        key = skill.lower()

        if key not in seen:
            seen.add(key)
            results.append(skill)

    return results


def _build_local_summary(text: str, skills: list[str]) -> str:
    """Build a basic summary from text actually present in the resume."""
    useful_lines = []

    ignored_headings = {
        "resume",
        "curriculum vitae",
        "profile",
        "professional summary",
        "summary",
        "objective",
        "education",
        "experience",
        "work experience",
        "skills",
        "technical skills",
        "projects",
        "certifications",
        "personal details",
        "declaration",
    }

    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip(" \t|•-")

        if not line or line.lower().rstrip(":") in ignored_headings:
            continue

        if "@" in line or "://" in line:
            continue

        if len(line) < 20:
            continue

        useful_lines.append(line)

        if len(useful_lines) == 3:
            break

    parts = []

    if useful_lines:
        parts.append(" ".join(useful_lines))

    if skills:
        parts.append("Skills identified in the resume include "
                     + ", ".join(skills[:20])
                     + ".")

    if not parts:
        return "Resume text was unavailable or could not be read."

    return " ".join(parts)


def _truncate_for_context(
    text: str,
    max_chars: int = 15000,
) -> str:
    """Prevent extremely large resumes from exceeding token limits."""
    if len(text) <= max_chars:
        return text

    logger.info(
        "Truncating resume text from %d to %d characters.",
        len(text),
        max_chars,
    )

    return text[:max_chars]


_parser_singleton: Optional[ResumeParser] = None


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

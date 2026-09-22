"""
Strict schema for the structured data extracted from a resume by the LLM.

This model doubles as the JSON Schema handed to the LLM as a tool
definition (see services/parser.py), so field descriptions here directly
shape what the model returns.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class EducationEntry(BaseModel):
    institution: str = Field(..., description="Name of the school or university.")
    degree: str = Field(..., description="Degree or qualification obtained, e.g. 'B.Tech Computer Science'.")
    start_year: Optional[str] = Field(None, description="Start year, e.g. '2019'. Null if unknown.")
    end_year: Optional[str] = Field(None, description="End year or 'Present'. Null if unknown.")
    grade: Optional[str] = Field(None, description="GPA / percentage / grade if mentioned.")


class ExperienceEntry(BaseModel):
    company: str = Field(..., description="Employer or organization name.")
    role: str = Field(..., description="Job title / role held.")
    start_date: Optional[str] = Field(None, description="Start date as written in the resume.")
    end_date: Optional[str] = Field(None, description="End date as written, or 'Present'.")
    description: Optional[str] = Field(
        None, description="Short description of responsibilities/achievements in this role."
    )


class ParsedResumeData(BaseModel):
    """
    Canonical structured representation of a candidate resume, produced by
    the LLM from raw extracted PDF text and persisted under
    `resumes.parsed_json` in MongoDB.
    """

    full_name: str = Field(..., description="Candidate's full name.")
    email: Optional[str] = Field(None, description="Primary email address, if present.")
    phone: Optional[str] = Field(None, description="Primary phone number, if present.")
    skills: List[str] = Field(default_factory=list, description="Flat list of technical and soft skills.")
    education: List[EducationEntry] = Field(default_factory=list)
    experience: List[ExperienceEntry] = Field(default_factory=list)
    summary: str = Field(
        ...,
        description=(
            "A concise (3-5 sentence) professional summary of the candidate, "
            "synthesized from the whole resume. This text is what gets "
            "embedded for vector search, so it should be information-dense."
        ),
    )
    total_experience_years: Optional[float] = Field(
        None, description="Estimated total years of professional experience, if derivable."
    )

    @field_validator("skills")
    @classmethod
    def _dedupe_skills(cls, v: List[str]) -> List[str]:
        # Preserve order while removing case-insensitive duplicates.
        seen = set()
        deduped = []
        for skill in v:
            key = skill.strip().lower()
            if key and key not in seen:
                seen.add(key)
                deduped.append(skill.strip())
        return deduped

    @classmethod
    def json_schema_for_tool(cls) -> dict:
        """
        Returns a JSON Schema suitable for use as an Anthropic tool
        `input_schema`, stripped of pydantic-specific keys the API doesn't
        need (title/$defs are fine to leave, but we simplify $refs here).
        """
        schema = cls.model_json_schema()
        # Anthropic's tool schema wants a flat "object" schema; pydantic's
        # nested models already resolve into $defs/$ref which the API
        # supports natively, so we return it as-is.
        return schema

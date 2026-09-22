from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SearchByJobRequest(BaseModel):
    """Rank existing resumes against an already-stored job description."""

    job_id: str = Field(
        ...,
        description="ObjectId of a stored job_descriptions document.",
    )

    limit: int = Field(10, ge=1, le=100)

    num_candidates: int = Field(
        100,
        ge=1,
        le=10000,
        description="ANN candidates examined before ranking (Atlas $vectorSearch tuning knob).",
    )

    min_score: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Optional semantic similarity floor to filter weak matches.",
    )


class SearchByTextRequest(BaseModel):
    """Rank existing resumes against ad-hoc free-text."""

    query_text: str = Field(
        ...,
        min_length=10,
        description="Free-text job description or requirement blurb.",
    )

    limit: int = Field(10, ge=1, le=100)

    num_candidates: int = Field(
        100,
        ge=1,
        le=10000,
    )

    min_score: Optional[float] = Field(
        None,
        ge=0,
        le=1,
    )


class MatchResult(BaseModel):
    id: str
    candidate_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    file_path: str
    parsed_json: Dict[str, Any]

    # Final score = combination of semantic similarity
    # and required-skill matching.
    score: float = Field(
        ...,
        description="Final resume-job match score in [0, 1].",
    )

    # Original Atlas Vector Search score.
    semantic_score: float = Field(
        ...,
        description="Semantic similarity score returned by Atlas Vector Search, in [0, 1].",
    )

    # Required-skill coverage.
    skill_match_score: Optional[float] = Field(
        None,
        description="Fraction of required skills found in the resume, in [0, 1].",
    )

    # Skills from the job description that were found in the resume.
    matched_skills: List[str] = Field(
        default_factory=list,
        description="Required skills found in the candidate resume.",
    )

    # Skills from the job description that were not found.
    missing_skills: List[str] = Field(
        default_factory=list,
        description="Required skills missing from the candidate resume.",
    )


class SearchResponse(BaseModel):
    total_matches: int
    results: List[MatchResult]
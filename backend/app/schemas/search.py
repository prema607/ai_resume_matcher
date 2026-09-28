
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SearchByJobRequest(BaseModel):
    """Rank existing resumes against an already-stored job description."""

    job_id: str = Field(
        ...,
        description="ObjectId of a stored job_descriptions document.",
    )

    limit: int = Field(
        10,
        ge=1,
        le=100,
        description="Maximum number of matching resumes to return.",
    )

    num_candidates: int = Field(
        100,
        ge=1,
        le=10000,
        description=(
            "ANN candidates examined before ranking "
            "(Atlas $vectorSearch tuning knob)."
        ),
    )

    min_score: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description=(
            "Optional semantic similarity floor used by "
            "MongoDB Atlas Vector Search."
        ),
    )

    threshold: float = Field(
        0.40,
        ge=0,
        le=1,
        description=(
            "Minimum final match score required for a resume "
            "to appear in the results."
        ),
    )


class SearchByTextRequest(BaseModel):
    """Rank existing resumes against ad-hoc free-text."""

    query_text: str = Field(
        ...,
        min_length=10,
        description="Free-text job description or requirement blurb.",
    )

    limit: int = Field(
        10,
        ge=1,
        le=100,
        description="Maximum number of matching resumes to return.",
    )

    num_candidates: int = Field(
        100,
        ge=1,
        le=10000,
        description=(
            "ANN candidates examined before ranking "
            "(Atlas $vectorSearch tuning knob)."
        ),
    )

    min_score: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description=(
            "Optional semantic similarity floor used by "
            "MongoDB Atlas Vector Search."
        ),
    )

    threshold: float = Field(
        0.40,
        ge=0,
        le=1,
        description=(
            "Minimum final match score required for a resume "
            "to appear in the results."
        ),
    )


class MatchResult(BaseModel):
    """
    A single resume-to-job match result.

    The final score combines semantic similarity and
    explicit required-skill matching.
    """

    id: str

    candidate_name: str

    email: Optional[str] = None

    phone: Optional[str] = None

    file_path: str

    parsed_json: Dict[str, Any]

    # Final blended score.
    score: float = Field(
        ...,
        ge=0,
        le=1,
        description=(
            "Final blended resume-job match score in the range [0, 1]."
        ),
    )

    # Original MongoDB Atlas Vector Search score.
    semantic_score: float = Field(
        ...,
        ge=0,
        le=1,
        description=(
            "Semantic similarity score returned by Atlas Vector Search."
        ),
    )

    # Explicit required-skill coverage.
    skill_match_score: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description=(
            "Fraction of required skills found in the candidate resume."
        ),
    )

    # Required skills found in the resume.
    matched_skills: List[str] = Field(
        default_factory=list,
        description="Required skills found in the candidate resume.",
    )

    # Required skills not found in the resume.
    missing_skills: List[str] = Field(
        default_factory=list,
        description="Required skills missing from the candidate resume.",
    )

    # Position after final-score ranking.
    rank: int = Field(
        ...,
        ge=1,
        description="Candidate ranking position after final score calculation.",
    )

    # Human-readable match category.
    match_quality: str = Field(
        ...,
        description=(
            "Match category such as Top Tier, Moderate Fit, "
            "Low Fit, or Poor Fit."
        ),
    )

    # Suggested recruiter workflow action.
    recommended_action: str = Field(
        ...,
        description=(
            "Suggested action based on the final match score."
        ),
    )


class SearchResponse(BaseModel):
    """Response returned by resume search endpoints."""

    total_matches: int = Field(
        ...,
        ge=0,
        description="Number of resumes remaining after threshold filtering.",
    )

    results: List[MatchResult]


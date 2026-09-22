from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JobDescriptionCreate(BaseModel):
    """Payload for POST /jobs."""

    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=20, description="Full job description text.")
    required_skills: List[str] = Field(default_factory=list)

    @field_validator("required_skills")
    @classmethod
    def _clean_skills(cls, v: List[str]) -> List[str]:
        return [s.strip() for s in v if s.strip()]


class JobDescriptionUpdate(BaseModel):
    """Payload for PATCH /jobs/{id}. All fields optional."""

    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, min_length=20)
    required_skills: Optional[List[str]] = None


class JobDescriptionResponse(BaseModel):
    id: str
    title: str
    description: str
    required_skills: List[str] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobListResponse(BaseModel):
    total: int
    items: List[JobDescriptionResponse]


class DeleteResponse(BaseModel):
    id: str
    deleted: bool

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class PyObjectId(str):
    """
    Thin wrapper so ObjectId values serialize to plain strings in API
    responses while still being validated as 24-char hex strings.
    """

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v: Any) -> str:
        return str(v)


class ResumeUploadResponse(BaseModel):
    """Returned immediately after a resume PDF is accepted and processed."""

    id: str = Field(..., description="MongoDB document id of the stored resume.")
    candidate_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    summary: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResumeDetail(BaseModel):
    """Full resume record returned by GET /resumes/{id}."""

    id: str
    candidate_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    file_path: str
    raw_text: str
    parsed_json: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResumeListItem(BaseModel):
    """Lightweight representation used in list views (no raw_text/embedding)."""

    id: str
    candidate_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResumeListResponse(BaseModel):
    total: int
    items: List[ResumeListItem]


class DeleteResponse(BaseModel):
    id: str
    deleted: bool

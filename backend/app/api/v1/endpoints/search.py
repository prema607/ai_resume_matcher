from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure

from app.api.deps import get_db, get_embedder
from app.schemas.search import (
    MatchResult,
    SearchByJobRequest,
    SearchByTextRequest,
    SearchResponse,
)
from app.services.embedder import EmbeddingService
from app.services.matcher import get_vector_matcher
from app.services.skill_matcher import calculate_skill_match

logger = logging.getLogger(__name__)
router = APIRouter()

_VECTOR_SEARCH_ERROR_DETAIL = (
    "Vector search failed. Ensure the Atlas Vector Search index "
    "('vector_index' by default) has been created on the 'resumes' "
    "collection's 'embedding' field."
)

# Final score weighting
SEMANTIC_WEIGHT = 0.30
SKILL_WEIGHT = 0.70


@router.post(
    "/by-job",
    response_model=SearchResponse,
    summary="Rank stored resumes against a previously-created job description",
)
async def search_by_job(
    payload: SearchByJobRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> SearchResponse:
    matcher = get_vector_matcher(db)

    try:
        job = await matcher.get_job(payload.job_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    query_embedding = job["embedding"]
    required_skills = job.get("required_skills", [])

    return await _run_search(
        matcher=matcher,
        query_embedding=query_embedding,
        limit=payload.limit,
        num_candidates=payload.num_candidates,
        min_score=payload.min_score,
        required_skills=required_skills,
    )


@router.post(
    "/by-text",
    response_model=SearchResponse,
    summary="Rank stored resumes against ad-hoc free-text requirements",
)
async def search_by_text(
    payload: SearchByTextRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    embedder: EmbeddingService = Depends(get_embedder),
) -> SearchResponse:
    matcher = get_vector_matcher(db)

    query_embedding = await embedder.embed_async(payload.query_text)

    return await _run_search(
        matcher=matcher,
        query_embedding=query_embedding,
        limit=payload.limit,
        num_candidates=payload.num_candidates,
        min_score=payload.min_score,
        required_skills=[],
    )


async def _run_search(
    matcher,
    query_embedding: List[float],
    limit: int,
    num_candidates: int,
    min_score: Optional[float],
    required_skills: List[str],
) -> SearchResponse:

    try:
        # Get more candidates before applying skill-based ranking.
        candidate_limit = max(limit, min(num_candidates, 100))

        raw_results = await matcher.find_matches(
            query_embedding=query_embedding,
            limit=candidate_limit,
            num_candidates=num_candidates,
            min_score=min_score,
        )

    except OperationFailure as exc:
        logger.error("Atlas $vectorSearch failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_VECTOR_SEARCH_ERROR_DETAIL,
        ) from exc

    scored_results: List[Dict[str, Any]] = []

    for doc in raw_results:
        semantic_score = float(doc.get("score", 0.0))

        parsed_json = doc.get("parsed_json") or {}
        resume_skills = parsed_json.get("skills", [])

        if not isinstance(resume_skills, list):
            resume_skills = []

        skill_data = calculate_skill_match(
            required_skills=required_skills,
            resume_skills=resume_skills,
        )

        skill_match_score = float(
            skill_data["skill_match_score"]
        )

        # Skills are given more importance than semantic similarity.
        final_score = (
            semantic_score * SEMANTIC_WEIGHT
            + skill_match_score * SKILL_WEIGHT
        )

        scored_results.append(
            {
                **doc,
                "semantic_score": semantic_score,
                "skill_match_score": skill_match_score,
                "matched_skills": skill_data["matched_skills"],
                "missing_skills": skill_data["missing_skills"],
                "score": final_score,
            }
        )

    # Re-rank using the new combined ATS score.
    scored_results.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    scored_results = scored_results[:limit]

    matches = [
        MatchResult(
            id=doc["_id"],
            candidate_name=doc.get("candidate_name", "Unknown"),
            email=doc.get("email"),
            phone=doc.get("phone"),
            file_path=doc.get("file_path", ""),
            parsed_json=doc.get("parsed_json", {}),
            score=round(float(doc["score"]), 4),
            semantic_score=round(float(doc["semantic_score"]), 4),
            skill_match_score=round(
                float(doc["skill_match_score"]), 4
            ),
            matched_skills=doc["matched_skills"],
            missing_skills=doc["missing_skills"],
        )
        for doc in scored_results
    ]

    return SearchResponse(
        total_matches=len(matches),
        results=matches,
    )

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


# ---------------------------------------------------------------------------
# Atlas Vector Search error message
# ---------------------------------------------------------------------------

_VECTOR_SEARCH_ERROR_DETAIL = (
    "Vector search failed. Ensure the Atlas Vector Search index "
    "('vector_index' by default) has been created on the 'resumes' "
    "collection's 'embedding' field."
)


# ---------------------------------------------------------------------------
# Final score weighting
# ---------------------------------------------------------------------------
#
# Final Score =
#       Semantic Score × 0.30
#     + Skill Match Score × 0.70
#
# Skills have more weight because explicit job-required skills
# are highly important in candidate matching.
# ---------------------------------------------------------------------------

SEMANTIC_WEIGHT = 0.30
SKILL_WEIGHT = 0.70


# ---------------------------------------------------------------------------
# Match quality thresholds
# ---------------------------------------------------------------------------

TOP_TIER_THRESHOLD = 0.75
MODERATE_THRESHOLD = 0.62
LOW_FIT_THRESHOLD = 0.40


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_match_quality(score: float) -> tuple[str, str]:
    """
    Convert the final blended score into a human-readable
    match quality and recruiter action.

    Score ranges:

        >= 0.75  -> Top Tier
        >= 0.62  -> Moderate Fit
        >= 0.40  -> Low Fit
        <  0.40  -> Poor Fit
    """

    if score >= TOP_TIER_THRESHOLD:
        return (
            "Top Tier",
            "Auto Shortlist for Interview",
        )

    if score >= MODERATE_THRESHOLD:
        return (
            "Moderate Fit",
            "Secondary Review Pool",
        )

    if score >= LOW_FIT_THRESHOLD:
        return (
            "Low Fit",
            "Manual Review if Needed",
        )

    return (
        "Poor Fit",
        "Filter Out",
    )


# ---------------------------------------------------------------------------
# Search by stored job
# ---------------------------------------------------------------------------

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

    required_skills = job.get(
        "required_skills",
        [],
    )

    if not isinstance(required_skills, list):
        required_skills = []

    return await _run_search(
        matcher=matcher,
        query_embedding=query_embedding,
        limit=payload.limit,
        num_candidates=payload.num_candidates,
        min_score=payload.min_score,
        threshold=payload.threshold,
        required_skills=required_skills,
    )


# ---------------------------------------------------------------------------
# Search by free text
# ---------------------------------------------------------------------------

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

    query_embedding = await embedder.embed_async(
        payload.query_text
    )

    return await _run_search(
        matcher=matcher,
        query_embedding=query_embedding,
        limit=payload.limit,
        num_candidates=payload.num_candidates,
        min_score=payload.min_score,
        threshold=payload.threshold,
        required_skills=[],
    )


# ---------------------------------------------------------------------------
# Main matching and ranking logic
# ---------------------------------------------------------------------------

async def _run_search(
    matcher,
    query_embedding: List[float],
    limit: int,
    num_candidates: int,
    min_score: Optional[float],
    threshold: float,
    required_skills: List[str],
) -> SearchResponse:

    try:
        # ---------------------------------------------------------------
        # Get more candidates than the final requested limit.
        # ---------------------------------------------------------------

        candidate_limit = max(
            limit,
            min(num_candidates, 100),
        )

        raw_results = await matcher.find_matches(
            query_embedding=query_embedding,
            limit=candidate_limit,
            num_candidates=num_candidates,
            min_score=min_score,
        )

    except OperationFailure as exc:
        logger.error(
            "Atlas $vectorSearch failed: %s",
            exc,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_VECTOR_SEARCH_ERROR_DETAIL,
        ) from exc

    scored_results: List[Dict[str, Any]] = []

    # -------------------------------------------------------------------
    # Calculate final score for every vector-search candidate.
    # -------------------------------------------------------------------

    for doc in raw_results:

        semantic_score = float(
            doc.get("score", 0.0)
        )

        # Keep the value inside the expected range.
        semantic_score = max(
            0.0,
            min(semantic_score, 1.0),
        )

        parsed_json = doc.get(
            "parsed_json"
        ) or {}

        if not isinstance(parsed_json, dict):
            parsed_json = {}

        # ---------------------------------------------------------------
        # Explicit skill matching
        #
        # IMPORTANT:
        # Pass the COMPLETE parsed resume instead of only
        # parsed_json["skills"].
        #
        # The skill matcher can now inspect:
        #   - skills
        #   - experience
        #   - projects
        #   - summary
        #   - other supported sections
        #
        # This allows skills such as HTML, CSS and Flask to be detected
        # when they appear inside an experience/project description.
        # ---------------------------------------------------------------

        skill_data = calculate_skill_match(
            required_skills=required_skills,
            resume_skills=parsed_json,
        )

        skill_match_score = float(
            skill_data["skill_match_score"]
        )

        # ---------------------------------------------------------------
        # Final blended score
        # ---------------------------------------------------------------
        #
        # When required skills are available:
        #
        #   30% semantic
        #   70% skills
        #
        # For free-text searches where required_skills=[]:
        # semantic similarity is used directly.
        # ---------------------------------------------------------------

        if required_skills:

            final_score = (
                semantic_score * SEMANTIC_WEIGHT
                + skill_match_score * SKILL_WEIGHT
            )

        else:

            final_score = semantic_score

        final_score = max(
            0.0,
            min(final_score, 1.0),
        )

        match_quality, recommended_action = (
            get_match_quality(final_score)
        )

        scored_results.append(
            {
                **doc,

                "semantic_score": semantic_score,

                "skill_match_score": skill_match_score,

                "matched_skills": skill_data[
                    "matched_skills"
                ],

                "missing_skills": skill_data[
                    "missing_skills"
                ],

                "score": final_score,

                "match_quality": match_quality,

                "recommended_action": recommended_action,
            }
        )

    # -------------------------------------------------------------------
    # Sort candidates using final blended score.
    # -------------------------------------------------------------------

    scored_results.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    # -------------------------------------------------------------------
    # Apply the user-selected threshold BEFORE limit.
    # -------------------------------------------------------------------

    filtered_results = [
        item
        for item in scored_results
        if item["score"] >= threshold
    ]

    # Only keep the requested number of qualifying candidates.
    filtered_results = filtered_results[:limit]

    # -------------------------------------------------------------------
    # Create API response objects.
    # -------------------------------------------------------------------

    matches: List[MatchResult] = []

    for index, doc in enumerate(
        filtered_results,
        start=1,
    ):

        matches.append(
            MatchResult(
                id=doc["_id"],

                candidate_name=doc.get(
                    "candidate_name",
                    "Unknown",
                ),

                email=doc.get("email"),

                phone=doc.get("phone"),

                file_path=doc.get(
                    "file_path",
                    "",
                ),

                parsed_json=doc.get(
                    "parsed_json",
                    {},
                ),

                score=round(
                    float(doc["score"]),
                    4,
                ),

                semantic_score=round(
                    float(doc["semantic_score"]),
                    4,
                ),

                skill_match_score=round(
                    float(doc["skill_match_score"]),
                    4,
                ),

                matched_skills=doc.get(
                    "matched_skills",
                    [],
                ),

                missing_skills=doc.get(
                    "missing_skills",
                    [],
                ),

                rank=index,

                match_quality=doc[
                    "match_quality"
                ],

                recommended_action=doc[
                    "recommended_action"
                ],
            )
        )

    # -------------------------------------------------------------------
    # Return final response.
    # -------------------------------------------------------------------

    return SearchResponse(
        total_matches=len(matches),
        results=matches,
    )


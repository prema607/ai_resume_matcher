
"""
MongoDB Atlas Vector Search utilities for retrieving resume candidates.

This service is responsible only for:
    1. Performing semantic/vector search.
    2. Retrieving stored job information.
    3. Returning resume information required by the search endpoint.

Final candidate scoring, skill matching, threshold filtering,
match quality, and ranking are handled by the search endpoint.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure

from app.core.config import get_settings


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# MongoDB Atlas Vector Search index definition
# ---------------------------------------------------------------------------

VECTOR_INDEX_DEFINITION: Dict[str, Any] = {
    "fields": [
        {
            "type": "vector",
            "path": "embedding",
            "numDimensions": 384,
            "similarity": "cosine",
        }
    ]
}


class VectorMatcher:
    """
    Handles semantic retrieval using MongoDB Atlas Vector Search.

    Important:
        This class does NOT calculate the final resume-job score.

        It only retrieves semantically relevant resumes.

        The search endpoint then performs:
            semantic score
            +
            skill matching
            =
            final blended score
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        index_name: str,
    ):
        self._db = db
        self._index_name = index_name
        self._resumes = db["resumes"]

    # -----------------------------------------------------------------------
    # Resume vector search
    # -----------------------------------------------------------------------

    async def find_matches(
        self,
        query_embedding: List[float],
        limit: int = 10,
        num_candidates: int = 100,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve semantically similar resumes using MongoDB Atlas
        Vector Search.

        Parameters
        ----------
        query_embedding:
            384-dimensional embedding of the job description.

        limit:
            Number of candidates to retrieve from Atlas.

        num_candidates:
            Number of approximate nearest-neighbor candidates
            considered by Atlas Vector Search.

        min_score:
            Optional semantic similarity floor.

        Returns
        -------
        List[Dict[str, Any]]
            Resume documents with their Atlas vector-search score.
        """

        if not query_embedding:
            raise ValueError(
                "Query embedding cannot be empty."
            )

        if limit < 1:
            raise ValueError(
                "Search limit must be at least 1."
            )

        if num_candidates < limit:
            num_candidates = limit

        # -------------------------------------------------------------------
        # Atlas Vector Search pipeline
        # -------------------------------------------------------------------

        pipeline: List[Dict[str, Any]] = [
            {
                "$vectorSearch": {
                    "index": self._index_name,
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": num_candidates,
                    "limit": limit,
                }
            },
            self._project_stage(),
        ]

        # -------------------------------------------------------------------
        # Optional semantic score filtering
        #
        # NOTE:
        # This is different from the final threshold.
        #
        # min_score filters based on Atlas semantic similarity.
        # threshold filters based on the final blended score.
        # -------------------------------------------------------------------

        if min_score is not None:
            pipeline.append(
                {
                    "$match": {
                        "score": {
                            "$gte": min_score,
                        }
                    }
                }
            )

        try:
            cursor = self._resumes.aggregate(
                pipeline
            )

            results = await cursor.to_list(
                length=limit
            )

        except OperationFailure as exc:
            logger.error(
                "MongoDB Atlas Vector Search aggregation failed: %s",
                exc,
            )
            raise

        # -------------------------------------------------------------------
        # Convert MongoDB ObjectIds into strings so that the API can
        # serialize them safely.
        # -------------------------------------------------------------------

        for document in results:
            document["_id"] = str(
                document["_id"]
            )

        return results

    # -----------------------------------------------------------------------
    # Projection
    # -----------------------------------------------------------------------

    @staticmethod
    def _project_stage() -> Dict[str, Any]:
        """
        Select only the resume fields required by the matching system.

        Keeping the projection focused reduces unnecessary data transfer.
        """

        return {
            "$project": {
                "_id": 1,

                "candidate_name": 1,

                "email": 1,

                "phone": 1,

                "file_path": 1,

                "parsed_json": 1,

                "raw_text": 1,

                "score": {
                    "$meta": "vectorSearchScore",
                },
            }
        }

    # -----------------------------------------------------------------------
    # Get stored job
    # -----------------------------------------------------------------------

    async def get_job(
        self,
        job_id: str,
    ) -> Dict[str, Any]:
        """
        Retrieve a complete stored job description.

        The job document should contain:

            embedding
            required_skills

        The embedding is used for semantic matching.

        The required_skills list is used by the search endpoint
        for explicit skill matching.
        """

        try:
            object_id = ObjectId(job_id)

        except (InvalidId, TypeError) as exc:
            raise ValueError(
                f"Invalid job id '{job_id}'."
            ) from exc

        job = await self._db[
            "job_descriptions"
        ].find_one(
            {
                "_id": object_id
            }
        )

        if job is None:
            raise ValueError(
                f"Job description with id "
                f"'{job_id}' not found."
            )

        # -------------------------------------------------------------------
        # A stored job must contain an embedding for vector search.
        # -------------------------------------------------------------------

        embedding = job.get(
            "embedding"
        )

        if not embedding:
            raise ValueError(
                f"Job description '{job_id}' "
                "has no stored embedding."
            )

        return job

    # -----------------------------------------------------------------------
    # Backward-compatible helper
    # -----------------------------------------------------------------------

    async def get_job_embedding(
        self,
        job_id: str,
    ) -> List[float]:
        """
        Return only the stored job embedding.

        Kept for compatibility with any existing code that
        uses this helper.
        """

        job = await self.get_job(
            job_id
        )

        return job["embedding"]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_vector_matcher(
    db: AsyncIOMotorDatabase,
) -> VectorMatcher:
    """
    Create a VectorMatcher using the configured Atlas
    Vector Search index name.
    """

    settings = get_settings()

    return VectorMatcher(
        db=db,
        index_name=settings.VECTOR_INDEX_NAME,
    )


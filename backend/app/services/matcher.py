"""
MongoDB Atlas Vector Search ($vectorSearch) queries for ranking resumes
against a job description embedding.

The matcher performs semantic/vector search only.

Skill-based matching is handled separately by the search endpoint so that
semantic similarity and explicit required-skill matching can be combined
into a final score.
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

# Reference definition for MongoDB Atlas Vector Search.
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
    def __init__(self, db: AsyncIOMotorDatabase, index_name: str):
        self._db = db
        self._index_name = index_name
        self._resumes = db["resumes"]

    async def find_matches(
        self,
        query_embedding: List[float],
        limit: int = 10,
        num_candidates: int = 100,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Runs MongoDB Atlas Vector Search.

        This returns candidates ranked by semantic similarity.
        The returned `score` is the original Atlas vector-search score.
        """

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

        if min_score is not None:
            pipeline.append(
                {
                    "$match": {
                        "score": {
                            "$gte": min_score
                        }
                    }
                }
            )

        try:
            cursor = self._resumes.aggregate(pipeline)
            results = await cursor.to_list(length=limit)

        except OperationFailure as exc:
            logger.error(
                "Vector search aggregation failed: %s",
                exc,
            )
            raise

        for doc in results:
            doc["_id"] = str(doc["_id"])

        return results

    @staticmethod
    def _project_stage() -> Dict[str, Any]:
        """
        Fields returned from each matched resume.
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
                    "$meta": "vectorSearchScore"
                },
            }
        }

    async def get_job(self, job_id: str) -> Dict[str, Any]:
        """
        Fetch the complete stored job description.

        We need both:
        - embedding -> semantic similarity
        - required_skills -> explicit skill matching
        """

        try:
            object_id = ObjectId(job_id)

        except (InvalidId, TypeError):
            raise ValueError(
                f"Invalid job id '{job_id}'."
            )

        job = await self._db["job_descriptions"].find_one(
            {"_id": object_id}
        )

        if job is None:
            raise ValueError(
                f"Job description with id '{job_id}' not found."
            )

        if "embedding" not in job:
            raise ValueError(
                f"Job description '{job_id}' has no stored embedding."
            )

        return job

    async def get_job_embedding(
        self,
        job_id: str,
    ) -> List[float]:
        """
        Backward-compatible helper that returns only the job embedding.
        """

        job = await self.get_job(job_id)

        return job["embedding"]


def get_vector_matcher(
    db: AsyncIOMotorDatabase,
) -> VectorMatcher:
    settings = get_settings()

    return VectorMatcher(
        db=db,
        index_name=settings.VECTOR_INDEX_NAME,
    )
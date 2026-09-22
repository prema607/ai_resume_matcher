from __future__ import annotations

import re
from typing import Dict, List


# Common variations of the same skill.
SKILL_ALIASES = {
    "mongo db": "mongodb",
    "mongo-db": "mongodb",
    "mongo database": "mongodb",
    "mongodb database": "mongodb",
    "node js": "nodejs",
    "node.js": "nodejs",
    "node-js": "nodejs",
    "react js": "react",
    "react.js": "react",
    "react-js": "react",
    "vue js": "vue",
    "vue.js": "vue",
    "next js": "nextjs",
    "next.js": "nextjs",
    "express js": "express",
    "express.js": "express",
    "spring boot": "springboot",
    "spring-boot": "springboot",
    "c sharp": "c#",
    "c-sharp": "c#",
    "dotnet": ".net",
    "dot net": ".net",
    "ms sql": "sql server",
    "mssql": "sql server",
    "postgres": "postgresql",
    "postgre sql": "postgresql",
    "machine learning": "machine learning",
    "deep learning": "deep learning",
}


def normalize_skill(skill: str) -> str:
    """Normalize a skill so common naming variations match."""

    skill = str(skill).lower().strip()

    # Remove unnecessary punctuation while preserving # and +.
    skill = re.sub(r"\s+", " ", skill)

    if skill in SKILL_ALIASES:
        return SKILL_ALIASES[skill]

    return skill


def calculate_skill_match(
    required_skills: List[str],
    resume_skills: List[str],
) -> Dict:
    """
    Calculate explicit required-skill coverage.

    Only skills explicitly present in the resume are considered matches.
    Semantic similarity is NOT used here.
    """

    required = {
        normalize_skill(skill)
        for skill in required_skills
        if str(skill).strip()
    }

    resume = {
        normalize_skill(skill)
        for skill in resume_skills
        if str(skill).strip()
    }

    if not required:
        return {
            "skill_match_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
        }

    matched = sorted(required.intersection(resume))
    missing = sorted(required - resume)

    score = len(matched) / len(required)

    return {
        "skill_match_score": score,
        "matched_skills": matched,
        "missing_skills": missing,
    }
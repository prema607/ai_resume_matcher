
from __future__ import annotations

import re
from typing import Any, Dict, List, Set


# ---------------------------------------------------------------------------
# Common variations of the same skill.
# ---------------------------------------------------------------------------
SKILL_ALIASES = {
    # Databases
    "mongo db": "mongodb",
    "mongo-db": "mongodb",
    "mongo database": "mongodb",
    "mongodb database": "mongodb",

    # JavaScript / frontend
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

    # Java / backend
    "spring boot": "springboot",
    "spring-boot": "springboot",

    # Microsoft
    "c sharp": "c#",
    "c-sharp": "c#",

    "dotnet": ".net",
    "dot net": ".net",

    "ms sql": "sql server",
    "mssql": "sql server",

    # PostgreSQL
    "postgres": "postgresql",
    "postgre sql": "postgresql",

    # AI / ML
    "machine learning": "machine learning",
    "deep learning": "deep learning",

    # Programming languages
    "python 3": "python",
    "python3": "python",

    "java programming": "java",

    "javascript": "javascript",
    "js": "javascript",

    "typescript": "typescript",
    "ts": "typescript",

    # Web technologies
    "html5": "html",
    "html 5": "html",

    "css3": "css",
    "css 3": "css",

    # APIs
    "rest api": "rest",
    "rest apis": "rest",
    "restful api": "rest",
    "restful apis": "rest",
}


# ---------------------------------------------------------------------------
# Closely related skills.
#
# These are intentionally limited. They prevent obvious naming differences
# from being treated as completely unrelated skills.
# ---------------------------------------------------------------------------
RELATED_SKILLS = {
    "javascript": {"javascript", "typescript"},
    "typescript": {"typescript", "javascript"},

    "html": {"html"},
    "css": {"css"},

    "mongodb": {"mongodb"},

    "sql": {
        "sql",
        "sql server",
        "mysql",
        "postgresql",
    },

    "python": {"python"},
    "java": {"java"},

    "react": {"react", "nextjs"},
    "nextjs": {"nextjs", "react"},

    "machine learning": {
        "machine learning",
        "deep learning",
    },

    "deep learning": {
        "deep learning",
        "machine learning",
    },
}


# ---------------------------------------------------------------------------
# Skills we explicitly recognize inside resume text.
#
# This allows the matcher to find a skill when it appears in an experience
# description, project description, summary, etc., even if the LLM did not
# place that skill in the main "skills" array.
# ---------------------------------------------------------------------------
KNOWN_SKILLS = {
    "python",
    "java",
    "c",
    "c++",
    "c#",
    "javascript",
    "typescript",
    "html",
    "css",
    "react",
    "nextjs",
    "vue",
    "nodejs",
    "express",
    "flask",
    "django",
    "springboot",
    ".net",
    "mongodb",
    "sql",
    "sql server",
    "mysql",
    "postgresql",
    "machine learning",
    "deep learning",
    "docker",
    "kubernetes",
    "git",
    "github",
    "rest",
    "fastapi",
    "angular",
    "php",
}


def normalize_skill(skill: str) -> str:
    """
    Normalize a skill so common naming variations match.

    Examples:
        Mongo DB     -> mongodb
        React.js     -> react
        Node JS      -> nodejs
        Python 3     -> python
        HTML5        -> html
    """

    skill = str(skill).lower().strip()

    # Normalize common separators.
    skill = skill.replace("_", " ")
    skill = re.sub(r"\s+", " ", skill)

    # Remove surrounding punctuation while preserving
    # meaningful characters such as # and +.
    skill = skill.strip(".,;:()[]{}")

    # Apply aliases.
    if skill in SKILL_ALIASES:
        return SKILL_ALIASES[skill]

    return skill


def _normalize_skill_set(skills: List[str]) -> Set[str]:
    """
    Convert a list of skills into a normalized set.
    Empty values are ignored.
    """

    normalized: Set[str] = set()

    for skill in skills:
        if skill is None:
            continue

        value = normalize_skill(skill)

        if value:
            normalized.add(value)

    return normalized


def _extract_skills_from_text(text: str) -> Set[str]:
    """
    Find known technical skills mentioned inside free-form resume text.

    This is deliberately limited to KNOWN_SKILLS so ordinary words such as
    "communication" or "leadership" are not accidentally treated as
    technical skills.
    """

    if not text:
        return set()

    normalized_text = str(text).lower()

    # Normalize common separators.
    normalized_text = normalized_text.replace("_", " ")
    normalized_text = re.sub(r"\s+", " ", normalized_text)

    found: Set[str] = set()

    # Check longer/multi-word skills first.
    for skill in sorted(KNOWN_SKILLS, key=len, reverse=True):
        normalized_skill = normalize_skill(skill)

        # Escape the skill so characters such as +, # and . are handled
        # safely inside the regular expression.
        pattern = re.escape(normalized_skill)

        # Word boundaries prevent partial matches.
        #
        # Example:
        # "java" should not match "javascript".
        if re.search(rf"(?<!\w){pattern}(?!\w)", normalized_text):
            found.add(normalized_skill)

    return found


def _collect_resume_skills(parsed_resume: Any) -> Set[str]:
    """
    Collect skills from the complete parsed resume structure.

    Sources:
        1. Explicit skills array
        2. Experience descriptions
        3. Project descriptions
        4. Resume summary
        5. Other text fields where appropriate

    This makes matching more robust when the parser mentions a technology
    in experience/project text but forgets to include it in the skills list.
    """

    collected: Set[str] = set()

    if not isinstance(parsed_resume, dict):
        return collected

    # ---------------------------------------------------------------
    # 1. Explicit skills array
    # ---------------------------------------------------------------
    skills = parsed_resume.get("skills", [])

    if isinstance(skills, list):
        collected.update(
            _normalize_skill_set(skills)
        )

    # ---------------------------------------------------------------
    # 2. Summary
    # ---------------------------------------------------------------
    summary = parsed_resume.get("summary")

    if isinstance(summary, str):
        collected.update(
            _extract_skills_from_text(summary)
        )

    # ---------------------------------------------------------------
    # 3. Experience
    # ---------------------------------------------------------------
    experience = parsed_resume.get("experience", [])

    if isinstance(experience, list):
        for item in experience:
            if not isinstance(item, dict):
                continue

            for key in (
                "role",
                "description",
                "company",
            ):
                value = item.get(key)

                if isinstance(value, str):
                    collected.update(
                        _extract_skills_from_text(value)
                    )

    # ---------------------------------------------------------------
    # 4. Projects
    # ---------------------------------------------------------------
    projects = parsed_resume.get("projects", [])

    if isinstance(projects, list):
        for item in projects:
            if isinstance(item, dict):
                for key in (
                    "name",
                    "title",
                    "description",
                    "technologies",
                    "tech_stack",
                ):
                    value = item.get(key)

                    if isinstance(value, str):
                        collected.update(
                            _extract_skills_from_text(value)
                        )

                    elif isinstance(value, list):
                        for entry in value:
                            if isinstance(entry, str):
                                collected.update(
                                    _normalize_skill_set([entry])
                                )

    # ---------------------------------------------------------------
    # 5. Other common structured sections
    # ---------------------------------------------------------------
    for section_name in (
        "certifications",
        "achievements",
    ):
        section = parsed_resume.get(section_name, [])

        if isinstance(section, list):
            for item in section:
                if isinstance(item, str):
                    collected.update(
                        _extract_skills_from_text(item)
                    )

                elif isinstance(item, dict):
                    for value in item.values():
                        if isinstance(value, str):
                            collected.update(
                                _extract_skills_from_text(value)
                            )

    return collected


def _skills_match(
    required_skill: str,
    resume_skills: Set[str],
) -> bool:
    """
    Determine whether a required skill is present in the resume.

    Exact normalized matching is preferred.

    A small set of explicitly defined related-skill relationships
    is also supported.
    """

    required_skill = normalize_skill(required_skill)

    # Exact match.
    if required_skill in resume_skills:
        return True

    # Related skills.
    related = RELATED_SKILLS.get(
        required_skill,
        set(),
    )

    if related.intersection(resume_skills):
        return True

    return False


def calculate_skill_match(
    required_skills: List[str],
    resume_skills: List[str] | Dict[str, Any],
) -> Dict:
    """
    Calculate explicit required-skill coverage.

    resume_skills can be either:

        1. A simple list of skills
        2. The complete parsed resume dictionary

    Score:
        matched required skills / total required skills

    Example:

        Required:
            Python, Flask, MongoDB, Docker

        Resume:
            Python, Flask, Mongo DB

        Result:
            matched = 3
            missing = 1
            score = 3 / 4 = 0.75

    Semantic similarity is NOT used here.
    """

    required = _normalize_skill_set(
        required_skills
    )

    # Support the complete parsed resume object.
    if isinstance(resume_skills, dict):
        resume = _collect_resume_skills(
            resume_skills
        )
    else:
        resume = _normalize_skill_set(
            resume_skills
        )

    # No required skills means there is no meaningful
    # explicit skill score.
    if not required:
        return {
            "skill_match_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
        }

    matched: Set[str] = set()
    missing: Set[str] = set()

    for required_skill in required:
        if _skills_match(
            required_skill,
            resume,
        ):
            matched.add(required_skill)
        else:
            missing.add(required_skill)

    score = len(matched) / len(required)

    return {
        "skill_match_score": round(
            score,
            4,
        ),
        "matched_skills": sorted(matched),
        "missing_skills": sorted(missing),
    }


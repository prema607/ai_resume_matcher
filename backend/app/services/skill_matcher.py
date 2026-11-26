
from __future__ import annotations

import re
from typing import Any, Dict, List, Set


# ============================================================
# 1. SKILL ALIASES
# ============================================================

SKILL_ALIASES = {
    "python 3": "python",
    "python3": "python",
    "java programming": "java",
    "c sharp": "c#",
    "c-sharp": "c#",
    "js": "javascript",
    "node js": "nodejs",
    "node.js": "nodejs",
    "react js": "react",
    "react.js": "react",
    "mongo db": "mongodb",
    "mongo database": "mongodb",
    "postgres": "postgresql",
    "postgre sql": "postgresql",
    "ms sql": "sql server",
    "mssql": "sql server",
    "ms excel": "excel",
    "microsoft excel": "excel",
    "excel spreadsheet": "excel",
    "html5": "html",
    "css3": "css",
    "rest api": "rest",
    "rest apis": "rest",
    "restful api": "rest",
    "restful apis": "rest",
    "dotnet": ".net",
    "dot net": ".net",

    # Accounting
    "gaap": "accounting principles",
    "generally accepted accounting principles": "accounting principles",
    "bookkeeper": "bookkeeping",
    "book keepers": "bookkeeping",
    "bank reconciliations": "bank reconciliation",
    "bank reconciliation statement": "bank reconciliation",
    "financial statements": "financial reporting",
    "financial statement preparation": "financial reporting",
    "financial reports": "financial reporting",
    "accounts receivable": "accounts receivable",
    "account receivable": "accounts receivable",
    "accounts payable": "accounts payable",
    "account payable": "accounts payable",
    "tally erp": "tally",
    "tally erp 9": "tally",
    "tally prime": "tally",
    "quickbooks pro": "quickbooks",
    "quick books": "quickbooks",
    "sap fi": "sap",
    "microsoft office excel": "excel",
}


# ============================================================
# 2. RELATED SKILLS
# ============================================================

RELATED_SKILLS = {
    "accounting principles": {
        "accounting",
        "financial accounting",
        "gaap",
    },
    "accounting software": {
        "quickbooks",
        "sap",
        "tally",
        "busy accounting",
    },
    "tally or accounting software": {
        "tally",
        "quickbooks",
        "sap",
        "busy accounting",
    },
    "bookkeeping": {
        "bookkeeper",
    },
    "financial reporting": {
        "financial statements",
        "financial reports",
    },
    "bank reconciliation": {
        "account reconciliation",
        "account reconciliation expert",
    },
    "ms excel": {
        "excel",
    },
    "microsoft excel": {
        "excel",
    },
}


# ============================================================
# 3. KNOWN SKILLS
# ============================================================

KNOWN_SKILLS = {
    "python", "java", "javascript", "typescript",
    "c", "c++", "c#", "html", "css",
    "react", "angular", "nodejs", "django",
    "flask", "fastapi", "sql", "mysql",
    "mongodb", "postgresql", "oracle",
    "machine learning", "deep learning",
    "data analysis", "excel", "power bi",
    "tableau", "artificial intelligence",
    "communication", "teamwork", "leadership",
    "time management", "problem solving",
    "decision making", "project management",

    # Accounting
    "accounting", "accounting principles",
    "financial accounting", "cost accounting",
    "management accounting", "bookkeeping",
    "bookkeeper", "tally", "gst", "taxation",
    "income tax", "accounts payable",
    "accounts receivable", "bank reconciliation",
    "account reconciliation", "financial reporting",
    "financial statements", "financial analysis",
    "balance sheet", "income statement",
    "cash flow statement", "auditing",
    "payroll", "invoice processing",
    "accounts management", "sap", "quickbooks",
    "busy accounting", "accounting software",
    "budgeting", "tax preparation",
    "gaap", "ms excel",

    # Other domains
    "agriculture", "agronomy", "soil science",
    "irrigation", "horticulture", "autocad",
    "revit", "sketchup", "graphic design",
    "photoshop", "illustrator", "photography",
    "video editing", "automobile engineering",
    "automotive engineering", "solidworks",
    "catia", "ansys", "aviation",
    "aircraft maintenance", "banking",
    "financial services", "risk management",
    "credit analysis", "loan processing",
    "kyc", "aml", "customer service",
    "blockchain", "ethereum", "solidity",
    "smart contracts", "web3",
}


# ============================================================
# 4. NORMALIZATION
# ============================================================

def normalize_skill(skill: str) -> str:
    skill = str(skill).lower().strip()
    skill = skill.replace("_", " ")
    skill = re.sub(r"\s+", " ", skill)
    skill = skill.strip(" ,;:()[]{}")
    return SKILL_ALIASES.get(skill, skill)


def _normalize_skill_set(skills: List[str]) -> Set[str]:
    result = set()

    for skill in skills:
        if isinstance(skill, str):
            value = normalize_skill(skill)
            if value:
                result.add(value)

    return result


# ============================================================
# 5. EXTRACT SKILLS FROM TEXT
# ============================================================

def _extract_skills_from_text(text: str) -> Set[str]:
    if not text:
        return set()

    normalized_text = str(text).lower()
    normalized_text = normalized_text.replace("_", " ")
    normalized_text = re.sub(r"\s+", " ", normalized_text)

    found = set()
    terms = KNOWN_SKILLS | set(SKILL_ALIASES.keys())

    for term in sorted(terms, key=len, reverse=True):
        canonical = normalize_skill(term)
        pattern = re.escape(term.lower())

        if term.lower() == "c":
            regex = r"(?<!\w)c(?![\w+#])"
        else:
            regex = rf"(?<!\w){pattern}(?!\w)"

        if re.search(regex, normalized_text):
            found.add(canonical)

    return found


# ============================================================
# 6. COLLECT RESUME SKILLS
# ============================================================

def _collect_resume_skills(
    parsed_resume: Any,
    raw_text: str = "",
) -> Set[str]:

    collected = set()

    if not isinstance(parsed_resume, dict):
        parsed_resume = {}

    # Explicit skills
    skills = parsed_resume.get("skills", [])

    if isinstance(skills, list):
        for skill in skills:
            if isinstance(skill, str):
                collected.add(normalize_skill(skill))
                collected.update(_extract_skills_from_text(skill))

    # Summary
    summary = parsed_resume.get("summary", "")

    if isinstance(summary, str):
        collected.update(_extract_skills_from_text(summary))

    # Experience
    experience = parsed_resume.get("experience", [])

    if isinstance(experience, list):
        for item in experience:
            if isinstance(item, dict):
                for key in ("role", "description", "company"):
                    value = item.get(key)

                    if isinstance(value, str):
                        collected.update(_extract_skills_from_text(value))

    # Projects, certifications and achievements
    for section in ("projects", "certifications", "achievements"):
        items = parsed_resume.get(section, [])

        if isinstance(items, list):
            for item in items:
                if isinstance(item, str):
                    collected.update(_extract_skills_from_text(item))
                elif isinstance(item, dict):
                    for value in item.values():
                        if isinstance(value, str):
                            collected.update(_extract_skills_from_text(value))

    # Original resume text
    if raw_text:
        collected.update(_extract_skills_from_text(raw_text))

    return collected


# ============================================================
# 7. SKILL MATCHING
# ============================================================

def _skills_match(
    required_skill: str,
    resume_skills: Set[str],
) -> bool:

    required_skill = normalize_skill(required_skill)

    if required_skill in resume_skills:
        return True

    related = RELATED_SKILLS.get(required_skill, set())

    if related.intersection(resume_skills):
        return True

    # Combined requirement:
    # Both AP and AR must be present for a full match.
    if required_skill in (
        "accounts payable and receivable",
        "accounts payable/receivable",
        "accounts payable & receivable",
    ):
        return (
            "accounts payable" in resume_skills
            and "accounts receivable" in resume_skills
        )

    return False


# ============================================================
# 8. CALCULATE SKILL MATCH SCORE
# ============================================================

def calculate_skill_match(
    required_skills: List[str],
    resume_skills: List[str] | Dict[str, Any],
    raw_text: str = "",
) -> Dict:

    required = _normalize_skill_set(required_skills)

    if isinstance(resume_skills, dict):
        resume = _collect_resume_skills(
            resume_skills,
            raw_text,
        )
    else:
        resume = _normalize_skill_set(resume_skills)
        resume.update(_extract_skills_from_text(raw_text))

    if not required:
        return {
            "skill_match_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
        }

    matched = set()
    missing = set()

    for skill in required:
        if _skills_match(skill, resume):
            matched.add(skill)
        else:
            missing.add(skill)

    score = len(matched) / len(required)

    return {
        "skill_match_score": round(score, 4),
        "matched_skills": sorted(matched),
        "missing_skills": sorted(missing),
    }

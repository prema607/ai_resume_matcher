
from __future__ import annotations

import json
import logging
import re
from typing import Optional
import io
from PIL import Image
import pytesseract
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.schemas.parsed_data import ParsedResumeData, EducationEntry, ExperienceEntry

logger = logging.getLogger(__name__)
class ResumeParsingError(Exception):
    """Raised when resume parsing fails."""
    pass

SYSTEM_PROMPT = """
You are an accurate resume parsing engine.

Extract information from the supplied resume text.

Rules:
1. Extract the candidate's actual name, email and phone.
2. Extract ALL explicitly listed skills and relevant skills demonstrated
   in the resume.
3. Extract EVERY employment entry from work history.
4. For each employment entry identify company, job title, dates and duties.
5. Extract EVERY education entry, including institution, qualification
   and dates.
6. Do not confuse professional summary paragraphs with work experience.
7. Do not treat skills as job titles or companies.
8. Do not invent missing details.
9. A resume can contain multiple jobs and education entries.
10. Return only valid JSON matching the supplied schema.
"""


# Skills used by the local fallback.
SKILL_KEYWORDS = [
    "python", "java", "javascript", "typescript", "c", "c++", "c#",
    "html", "css", "react", "angular", "node.js", "django", "flask",
    "fastapi", "sql", "mysql", "mongodb", "postgresql", "oracle",
    "machine learning", "deep learning", "data analysis", "excel",
    "power bi", "tableau", "artificial intelligence",
    "communication", "effective communication", "teamwork",
    "leadership", "time management", "problem solving",
    "decision making", "project management", "multitasking",
    "customer service", "customer relationship management",
    "relationship building", "financial planning",
    "strategic financial planning", "loan paperwork",
    "loan processing", "loan application preparation",
    "credit reporting", "credit reporting software",
    "lending software systems", "quickbooks", "accounting",
    "bookkeeping", "accounts payable", "accounts receivable",
    "financial reporting", "payroll", "budgeting",
    "reconciliation", "tax preparation", "auditing",
    "real estate", "sales", "marketing", "negotiation",
    "inventory management", "retail sales", "merchandising",
    "agricultural technology", "equipment maintenance",
    "quality control", "data entry", "administration",
    "organizational skills", "adaptability", "self-motivated",
    "flexible", "customer relations", "conflict resolution",
    "documentation", "recordkeeping", "contract management",
    "scheduling", "vendor management", "risk management",
        # Legal and IPR skills
    "trademark",
    "trademark search",
    "trademark application",
    "application drafting",
    "patent",
    "patent search",
    "prior-art search",
    "patent prior-art search",
    "espacenet",
    "inpass",
    "nda",
    "nda drafting",
    "licence drafting",
    "license drafting",
    "intellectual property law",
    "ipr",
    "technology contracts",
    "contract drafting",
    "legal research",
    "case analysis",
    "legal documentation",
    "scc online",

    # Office tools
    "ms office",
    "microsoft office",
    "google workspace",
        # ---------------- BLOCKCHAIN PROGRAMMING LANGUAGES ----------------
    "solidity",
    "javascript",
    "typescript",
    "python",
    "go",
    "golang",
    "sql",

    # ---------------- BLOCKCHAIN PLATFORMS AND NETWORKS ----------------
    "ethereum",
    "evm",
    "evm-compatible chains",
    "polygon",
    "bnb chain",
    "binance smart chain",
    "sepolia",
    "ethereum testnet",
    "testnet",
    "mainnet",
    "hyperledger fabric",
    "arbitrum",
    "optimism",
    "layer 2",

    # ---------------- BLOCKCHAIN CONCEPTS AND STANDARDS ----------------
    "blockchain",
    "blockchain fundamentals",
    "smart contracts",
    "smart contract development",
    "decentralized applications",
    "decentralised applications",
    "dapps",
    "web3",
    "blocks",
    "transactions",
    "wallets",
    "gas",
    "gas optimization",
    "gas efficiency",
    "consensus",
    "proof of work",
    "pow",
    "proof of stake",
    "pos",
    "solidity programming",
    "contract state",
    "smart contract events",
    "modifiers",
    "inheritance",
    "interfaces",
    "erc-20",
    "erc20",
    "erc-721",
    "erc721",
    "erc-1155",
    "erc1155",
    "erc-4626",
    "erc4626",
    "defi",
    "decentralized finance",
    "staking",
    "automated market makers",
    "amms",
    "lending protocols",
    "oracles",
    "price feeds",
    "proxy patterns",
    "upgradeable contracts",

    # ---------------- DEVELOPMENT FRAMEWORKS AND TOOLS ----------------
    "hardhat",
    "truffle",
    "remix ide",
    "remix",
    "metamask",
    "ganache",
    "foundry",
    "etherscan",
    "contract verification",
    "tenderly",
    "docker",
    "git",
    "github",

    # ---------------- LIBRARIES AND SDKs ----------------
    "ethers.js",
    "ethersjs",
    "web3.js",
    "web3js",
    "openzeppelin",
    "openzeppelin contracts",
    "web3.py",
    "web3py",
    "hyperledger fabric sdk",
    "fabric sdk",
    "the graph",

    # ---------------- DECENTRALIZED STORAGE ----------------
    "ipfs",
    "interplanetary file system",
    "pinata",
    "web3.storage",
    "nft metadata",
    "decentralized storage",

    # ---------------- CRYPTOGRAPHY AND SECURITY ----------------
    "cryptography",
    "hash functions",
    "sha-256",
    "sha256",
    "keccak-256",
    "keccak256",
    "digital signatures",
    "ecdsa",
    "public key cryptography",
    "private key cryptography",
    "reentrancy",
    "reentrancy protection",
    "access control",
    "input validation",
    "integer overflow",
    "integer underflow",
    "merkle trees",
    "merkle proofs",
    "slither",
    "echidna",
    "ethernaut",
    "smart contract security",
    "security auditing",
    "secure coding",

    # ---------------- FRONTEND AND BACKEND ----------------
    "html",
    "css",
    "node.js",
    "nodejs",
    "react",
    "next.js",
    "nextjs",
    "express.js",
    "express",
    "rest api",
    "rest apis",
    "api integration",
    "mongodb",
    "postgresql",
    "frontend development",
    "backend development",

    # ---------------- COMPUTER SCIENCE FUNDAMENTALS ----------------
    "data structures",
    "data structures and algorithms",
    "algorithms",
    "database management",
    "database fundamentals",
    "computer networks",
    "operating systems",

    # ---------------- TESTING AND QUALITY ----------------
    "unit testing",
    "integration testing",
    "smart contract testing",
    "hardhat testing",
    "truffle testing",
    "chai",
    "mocha",
    "debugging",
    "transaction debugging",
    "test coverage",
    "gas reports",
    "github actions",
    "ci/cd",
    "continuous integration",

    # ---------------- SOFT SKILLS ----------------
    "problem solving",
    "attention to detail",
    "communication",
    "written communication",
    "verbal communication",
    "teamwork",
    "time management",
    "quick learning",
    "adaptability",
    "independent working",
    "task management",
]


SECTION_PATTERNS = {
    "skills": r"^(skills|technical skills|core skills|key skills|competencies|sxills)\b",
    "experience": r"^(work history|work experience|professional experience|employment history|employment)\b",
    "education": r"^(education|academic background|educational qualifications|qualifications)\b",
    "summary": r"^(professional summary|summary|profile|objective|career objective)\b",
}


DATE_PATTERN = re.compile(
    r"\b(?:"
    r"(?:0?[1-9]|1[0-2])[/\-](?:19|20)?\d{2}"
    r"|(?:19|20)\d{2}"
    r")\s*(?:to|[-–—])\s*"
    r"(?:"
    r"(?:0?[1-9]|1[0-2])[/\-](?:19|20)?\d{2}"
    r"|(?:19|20)\d{2}"
    r"|current|present"
    r")\b",
    re.IGNORECASE,
)


def _clean_line(line: str) -> str:
    line = re.sub(r"^[\s•*©«¢+|]+", "", line)
    line = re.sub(r"\s+", " ", line)
    return line.strip(" -|")


def _is_section_heading(line: str) -> Optional[str]:
    cleaned = _clean_line(line).lower().strip(": ")
    for section, pattern in SECTION_PATTERNS.items():
        if re.match(pattern, cleaned, re.IGNORECASE):
            return section
    return None


def _get_sections(text: str) -> dict[str, list[str]]:
    sections = {
        "skills": [],
        "experience": [],
        "education": [],
        "summary": [],
    }

    current = None

    for original_line in text.splitlines():
        line = _clean_line(original_line)

        if not line:
            continue

        heading = _is_section_heading(line)

        if heading:
            current = heading
            continue

        # Stop collecting when another known section begins.
        if current:
            sections[current].append(line)

    return sections


def _extract_email(text: str) -> Optional[str]:
    match = re.search(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        text,
    )
    return match.group(0) if match else None


def _extract_phone(text: str) -> Optional[str]:
    # Look near the beginning to avoid picking unrelated numbers.
    first_lines = "\n".join(text.splitlines()[:12])

    patterns = [
        r"\(\d{3}\)\s*\d{3}[-.\s]\d{4}",
        r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b",
        r"\+\d{1,3}[\s.-]?\d{7,12}\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, first_lines)
        if match:
            return match.group(0).strip()

    return None


def _extract_name(text: str) -> str:
    excluded = {
        "resume", "curriculum vitae", "professional summary",
        "summary", "objective", "skills", "work history",
        "work experience", "education", "experience",
    }

    for line in text.splitlines()[:10]:
        line = _clean_line(line)

        if not line or "@" in line or re.search(r"\d", line):
            continue

        if line.lower().strip(": ") in excluded:
            continue

        words = re.findall(r"[A-Za-z][A-Za-z'-]*", line)

        if 2 <= len(words) <= 4 and len(line) < 55:
            return line

    return "Unknown"


def _extract_skills(text: str, skill_lines: list[str]) -> list[str]:
    found = []

    # First collect skills explicitly listed in the skills section.
    skill_text = " ".join(skill_lines).lower()

    for skill in SKILL_KEYWORDS:
        if re.search(
            r"(?<![a-z0-9])" + re.escape(skill) + r"(?![a-z0-9])",
            skill_text,
        ):
            found.append(skill)

    # Also identify skills mentioned elsewhere in the resume.
    full_text = text.lower()

    for skill in SKILL_KEYWORDS:
        if re.search(
            r"(?<![a-z0-9])" + re.escape(skill) + r"(?![a-z0-9])",
            full_text,
        ):
            found.append(skill)

    # Remove duplicates while preserving order.
    result = []
    seen = set()

    for skill in found:
        key = skill.lower()
        if key not in seen:
            seen.add(key)
            result.append(skill.title())

    return result


def _extract_experience(lines: list[str]) -> list[ExperienceEntry]:
    entries = []
    current = None
    pending_company = None

    for line in lines:
        line = _clean_line(line)

        if not line:
            continue

        date_match = DATE_PATTERN.search(line)

        if date_match:
            if current:
                entries.append(current)

            before_date = line[:date_match.start()].strip(" -|")
            after_date = line[date_match.end():].strip(" -|")

            # Handles both "Licensed Realtor 01/2023 to Current"
            # and "01/2023 to Current Licensed Realtor".
            if before_date and after_date:
                role = after_date
                dates = date_match.group(0)
            elif before_date:
                role = before_date
                dates = date_match.group(0)
            else:
                role = after_date
                dates = date_match.group(0)

            current = {
                "company": "Not specified",
                "role": role or "Not specified",
                "start_date": dates.split("to")[0].strip(),
                "end_date": (
                    dates.split("to")[-1].strip()
                    if re.search(r"\bto\b", dates, re.IGNORECASE)
                    else None
                ),
                "description": "",
            }
            pending_company = current
            continue

        if current is None:
            continue

        # First non-bullet line after a job title is often the company.
        if (
            current["company"] == "Not specified"
            and not line.startswith(("•", "*"))
            and len(line) < 100
            and not re.search(r"\b(worked|managed|assisted|developed|maintained)\b", line, re.I)
        ):
            current["company"] = line
            continue

        current["description"] += line + " "

    if current:
        entries.append(current)

    result = []

    for item in entries:
        if item["role"] and item["role"] != "Not specified":
            item["description"] = item["description"].strip() or None
            try:
                result.append(ExperienceEntry(**item))
            except Exception:
                logger.warning("Could not validate experience entry: %s", item)

    return result


def _extract_education(lines: list[str]) -> list[EducationEntry]:
    entries = []

    for index, line in enumerate(lines):
        line = _clean_line(line)

        # Typical education line:
        # 12/2018 Accounting & Business Management : Accounting ...
        match = re.match(
            r"((?:0?[1-9]|1[0-2])[/\-](?:19|20)?\d{2}|(?:19|20)\d{2})\s+(.+)",
            line,
        )

        if not match:
            continue

        date = match.group(1)
        qualification = match.group(2).strip(" :")

        institution = "Not specified"

        # Institution is commonly on the next line.
        if index + 1 < len(lines):
            possible_institution = _clean_line(lines[index + 1])
            if possible_institution and len(possible_institution) < 150:
                institution = possible_institution

        entries.append(
            EducationEntry(
                institution=institution,
                degree=qualification,
                start_year=None,
                end_year=date,
                grade=None,
            )
        )

    return entries


def _extract_summary(lines: list[str], skills: list[str]) -> str:
    # Use the first paragraph under Professional Summary.
    paragraphs = []
    current = []

    for line in lines:
        line = _clean_line(line)

        if not line:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue

        current.append(line)

    if current:
        paragraphs.append(" ".join(current))

    summary = paragraphs[0] if paragraphs else ""

    # Keep summaries concise.
    if len(summary) > 1200:
        summary = summary[:1200].rsplit(" ", 1)[0]

    if not summary:
        summary = (
            "Resume containing experience and skills in: "
            + ", ".join(skills[:12])
            if skills else "Professional resume."
        )

    return summary


class ResumeParser:
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash"):
        self.client = genai.Client(api_key=api_key) if api_key else None
        self.model = model
    def extract_text_from_image(self, image_bytes: bytes) -> str:
        

            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            return pytesseract.image_to_string(
            image,
            lang="eng",
            config="--oem 3 --psm 6"
            )    

    def parse(self, raw_text: str) -> ParsedResumeData:
        if not raw_text or not raw_text.strip():
            return self._local_parse("")

        raw_text = raw_text[:30000]

        if self.client:
            try:
                parsed = self._parse_with_gemini(raw_text)

                sections = _get_sections(raw_text)
                local_skills = _extract_skills(raw_text, sections["skills"])

                combined_skills = list(dict.fromkeys(
                parsed.skills + local_skills
        ))

                parsed.skills = combined_skills

                return parsed

            except Exception as exc:
                logger.warning(
            "Gemini parsing failed; using local parser. Reason: %s",
            exc,
            )


        return self._local_parse(raw_text)

    def _parse_with_gemini(self, raw_text: str) -> ParsedResumeData:
        schema = ParsedResumeData.model_json_schema()

        prompt = f"""
Parse this resume carefully.

Required JSON schema:
{json.dumps(schema)}

Resume text:
{raw_text}
"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
            ),
        )

        response_text = response.text or ""
        response_text = re.sub(r"^```(?:json)?\s*", "", response_text.strip())
        response_text = re.sub(r"\s*```$", "", response_text)

        data = json.loads(response_text)
        return ParsedResumeData.model_validate(data)

    def _local_parse(self, raw_text: str) -> ParsedResumeData:
        sections = _get_sections(raw_text)

        name = _extract_name(raw_text)
        email = _extract_email(raw_text)
        phone = _extract_phone(raw_text)

        skills = _extract_skills(
            raw_text,
            sections["skills"],
        )

        experience = _extract_experience(sections["experience"])
        education = _extract_education(sections["education"])
        summary = _extract_summary(sections["summary"], skills)

        return ParsedResumeData(
            full_name=name,
            email=email,
            phone=phone,
            skills=skills,
            experience=experience,
            education=education,
            summary=summary,
            total_experience_years=None,
        )


def get_resume_parser() -> ResumeParser:
    settings = get_settings()

    return ResumeParser(
        api_key=settings.GEMINI_API_KEY,
        model=settings.LLM_MODEL,
    )

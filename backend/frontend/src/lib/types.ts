// Mirrors app/schemas/*.py exactly so the frontend and backend never drift
// silently out of sync -- every field here has a 1:1 source field.

export interface EducationEntry {
  institution: string;
  degree: string;
  start_year: string | null;
  end_year: string | null;
  grade: string | null;
}

export interface ExperienceEntry {
  company: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export interface ParsedResumeData {
  full_name: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  summary: string;
  total_experience_years: number | null;
}

export interface ResumeUploadResponse {
  id: string;
  candidate_name: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  summary: string;
  created_at: string;
}

export interface ResumeListItem {
  id: string;
  candidate_name: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  created_at: string;
}

export interface ResumeListResponse {
  total: number;
  items: ResumeListItem[];
}

export interface ResumeDetail {
  id: string;
  candidate_name: string;
  email: string | null;
  phone: string | null;
  file_path: string;
  raw_text: string;
  parsed_json: ParsedResumeData;
  created_at: string;
}

export interface JobDescriptionResponse {
  id: string;
  title: string;
  description: string;
  required_skills: string[];
  created_at: string;
}

export interface JobListResponse {
  total: number;
  items: JobDescriptionResponse[];
}

export interface JobDescriptionCreate {
  title: string;
  description: string;
  required_skills: string[];
}

export interface JobDescriptionUpdate {
  title?: string;
  description?: string;
  required_skills?: string[];
}

export interface MatchResult {
  id: string;
  candidate_name: string;
  email: string | null;
  phone: string | null;
  file_path: string;
  parsed_json: ParsedResumeData;
  score: number;
}

export interface SearchResponse {
  total_matches: number;
  results: MatchResult[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  mongodb: "connected" | "unreachable";
}

export interface ApiErrorBody {
  detail?: string | { msg: string }[];
}

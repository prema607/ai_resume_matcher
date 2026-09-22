import type {
  HealthResponse,
  JobDescriptionCreate,
  JobDescriptionResponse,
  JobDescriptionUpdate,
  JobListResponse,
  ResumeDetail,
  ResumeListResponse,
  ResumeUploadResponse,
  SearchResponse,
  ApiErrorBody,
} from "./types";

// Relative base path: the Vite dev server proxies /api -> the FastAPI
// backend (see vite.config.ts), and in production this is served from the
// same origin behind a reverse proxy -- so no absolute host is ever needed.
const API_BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body: ApiErrorBody = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((d) => d.msg).join("; ");
    }
  } catch {
    // response wasn't JSON -- fall through to generic message
  }
  return `Request failed with status ${res.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers:
        init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json", ...init?.headers }
          : init?.headers,
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check that the backend is running and try again.",
      0
    );
  }

  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export const health = {
  check: () => request<HealthResponse>("/health"),
};

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------
export interface ListResumesParams {
  skip?: number;
  limit?: number;
  search?: string;
}

export const resumesApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("file", file);

    // Use XHR (not fetch) here so we can report upload progress -- resume
    // PDFs go through PDF extraction + LLM parsing + embedding server-side,
    // so the request can take a few seconds and users benefit from feedback.
    return new Promise<ResumeUploadResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/resumes`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          let detail = `Upload failed with status ${xhr.status}`;
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (typeof parsed.detail === "string") detail = parsed.detail;
            else if (Array.isArray(parsed.detail)) {
              detail = parsed.detail.map((d: { msg: string }) => d.msg).join("; ");
            }
          } catch {
            /* ignore parse failure, keep generic message */
          }
          reject(new ApiError(detail, xhr.status));
        }
      };

      xhr.onerror = () =>
        reject(new ApiError("Network error while uploading the resume.", 0));

      xhr.send(form);
    });
  },

  list: (params: ListResumesParams = {}) => {
    const qs = new URLSearchParams();
    if (params.skip !== undefined) qs.set("skip", String(params.skip));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<ResumeListResponse>(`/resumes${suffix}`);
  },

  get: (id: string) => request<ResumeDetail>(`/resumes/${id}`),

  remove: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/resumes/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export interface ListJobsParams {
  skip?: number;
  limit?: number;
  search?: string;
}

export const jobsApi = {
  create: (payload: JobDescriptionCreate) =>
    request<JobDescriptionResponse>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  list: (params: ListJobsParams = {}) => {
    const qs = new URLSearchParams();
    if (params.skip !== undefined) qs.set("skip", String(params.skip));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<JobListResponse>(`/jobs${suffix}`);
  },

  get: (id: string) => request<JobDescriptionResponse>(`/jobs/${id}`),

  update: (id: string, payload: JobDescriptionUpdate) =>
    request<JobDescriptionResponse>(`/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/jobs/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export interface SearchByJobPayload {
  job_id: string;
  limit?: number;
  num_candidates?: number;
  min_score?: number | null;
}

export interface SearchByTextPayload {
  query_text: string;
  limit?: number;
  num_candidates?: number;
  min_score?: number | null;
}

export const searchApi = {
  byJob: (payload: SearchByJobPayload) =>
    request<SearchResponse>("/search/by-job", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  byText: (payload: SearchByTextPayload) =>
    request<SearchResponse>("/search/by-text", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

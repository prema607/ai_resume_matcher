# Signal — AI Resume Matching (Backend + Frontend)

An end-to-end system that parses resumes into structured data, embeds them
as vectors, and ranks candidates against job descriptions using MongoDB
Atlas Vector Search.

```
backend/
├── app/                  FastAPI backend (see below)
├── frontend/             React + TypeScript + Tailwind UI
├── docker-compose.yml    Runs backend + frontend together
├── Dockerfile            Backend image
└── requirements.txt
```

---

## 1. Prerequisites

- **Python 3.11+**
- **Node.js 20+** (for the frontend)
- **A MongoDB Atlas cluster** (free tier works). `$vectorSearch` is an
  Atlas-managed feature — a self-hosted/community MongoDB server cannot
  run these queries, so `docker-compose.yml` intentionally does not
  bundle a local Mongo container.
- **An Anthropic API key** (for resume parsing).

---

## 2. One-time Atlas setup

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Grab your connection string (`MONGODB_URI`).
3. After you've uploaded at least one resume (so the `resumes` collection
   exists), create the vector index — this **cannot** be done through the
   app itself:

   **Atlas UI:** Database → your cluster → *Search* tab → *Create Search Index*
   → *Atlas Vector Search* → JSON Editor, on the `resumes` collection:

   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 384,
         "similarity": "cosine"
       }
     ]
   }
   ```

   Name it `vector_index` (or update `VECTOR_INDEX_NAME` in `.env` to match
   whatever you name it). This definition also lives in
   `app/services/matcher.py` as `VECTOR_INDEX_DEFINITION` for reference.

---

## 3. Backend setup

```bash
cd backend
cp .env.example .env
# edit .env: set MONGODB_URI and ANTHROPIC_API_KEY at minimum

python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload
```

The API is now live at `http://localhost:8000`. Interactive docs (Swagger)
are at `http://localhost:8000/docs`.

---

## 4. Frontend setup

```bash
cd backend/frontend
cp .env.example .env      # only needed if your backend isn't on :8000
npm install
npm run dev
```

The UI is now live at `http://localhost:5173`. The dev server proxies
`/api/*` requests straight to the backend (see `vite.config.ts`), so no
CORS configuration is needed in development.

**Build for production:**

```bash
npm run build     # outputs static files to frontend/dist/
npm run preview   # sanity-check the production build locally
```

---

## 5. Running everything with Docker

```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI + ANTHROPIC_API_KEY
docker compose up --build
```

- Frontend (nginx, serving the built SPA + proxying `/api`): `http://localhost:3000`
- Backend (FastAPI): `http://localhost:8000`

In this setup the frontend container proxies `/api/*` to the backend
container over the Docker network — the browser only ever talks to the
frontend's origin, so there's nothing to configure for CORS in production
either.

---

## 6. API surface

All routes are prefixed with `/api/v1` (see `app/api/v1/api.py`):

| Method | Path                    | Purpose                                       |
|--------|--------------------------|------------------------------------------------|
| GET    | `/health`                | Liveness + Mongo connectivity check            |
| POST   | `/resumes`                | Upload a resume PDF (parse + embed + store)    |
| GET    | `/resumes`                | List resumes (paginated, name search)          |
| GET    | `/resumes/{id}`           | Full resume detail incl. raw text              |
| DELETE | `/resumes/{id}`           | Delete a resume and its stored PDF             |
| POST   | `/jobs`                   | Create a job description (auto-embedded)       |
| GET    | `/jobs`                   | List job descriptions (paginated, title search)|
| GET    | `/jobs/{id}`              | Get a single job description                  |
| PATCH  | `/jobs/{id}`               | Update a job (re-embeds if content changed)    |
| DELETE | `/jobs/{id}`               | Delete a job description                       |
| POST   | `/search/by-job`           | Rank resumes against a saved job's embedding   |
| POST   | `/search/by-text`          | Rank resumes against ad-hoc free-text          |

Every one of these is wired up in `frontend/src/lib/api.ts` and consumed by
a corresponding page — nothing in the UI calls an endpoint that doesn't
exist, and nothing in the API is unreachable from the UI.

---

## 7. Frontend structure

```
frontend/src/
├── lib/
│   ├── api.ts        Typed fetch client — one function per backend route
│   ├── types.ts       TypeScript types mirroring the Pydantic schemas
│   └── utils.ts        Formatting helpers (dates, initials, score %)
├── components/
│   ├── layout/         Sidebar, mobile nav, top bar (with live health indicator)
│   ├── ui/              Button, Badge, Toast, Skeleton, EmptyState
│   ├── MatchRadar.tsx    The app's signature element — a radial gauge
│   │                      rendering a candidate's cosine-similarity score
│   ├── UploadDropzone.tsx
│   ├── ResumeCard.tsx / JobCard.tsx
│   └── ConfirmDialog.tsx
├── pages/
│   ├── DashboardPage.tsx    Counts + recent activity
│   ├── ResumesPage.tsx       Upload, list, search, delete candidates
│   ├── ResumeDetailPage.tsx   Full parsed profile + raw extracted text
│   ├── JobsPage.tsx           Create/list/delete roles
│   ├── JobDetailPage.tsx       Edit a role (re-embeds on save)
│   └── SearchPage.tsx          Rank candidates by saved role or free text
└── App.tsx              Routes, wrapped in a toast provider
```

Every mutating action (upload, create, update, delete) shows a toast on
success or failure. Every list has a loading skeleton, an empty state, and
pagination. Deletes always confirm first.

---

## 8. Known limitations

- Resume parsing (LLM call) and embedding happen synchronously inside the
  upload request. For a production system handling high upload volume,
  move this to a background task/queue (Celery, or FastAPI
  `BackgroundTasks` for lighter loads) and have the frontend poll a status
  endpoint instead of blocking on the request.
- Scanned/image-only PDFs aren't supported — text extraction requires a
  text layer (see `app/services/extractor.py`). OCR would need to be added
  as a fallback.
- No authentication layer is included. Add one (e.g. OAuth2 + JWT via
  FastAPI's security utilities) before exposing this beyond a trusted
  internal network.

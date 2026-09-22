# AI Resume Matcher (signal)

An end-to-end **AI-powered Resume Matching System** that parses resumes into structured information, generates vector embeddings, and ranks candidates against job descriptions using **semantic similarity and skill matching**.

This project is developed as a **college project** using a modern full-stack architecture with FastAPI, React, MongoDB Atlas Vector Search, Google Gemini, and Sentence Transformers.

---

## 1. Project Overview

The AI Resume Matcher helps users manage resumes and job descriptions and identify candidates whose profiles best match a particular job.

The system performs the following major operations:

1. Upload a resume in PDF format.
2. Extract text from the resume.
3. Parse the extracted content using the Gemini API.
4. Convert the resume information into structured data.
5. Generate a vector embedding using Sentence Transformers.
6. Store the resume and embedding in MongoDB Atlas.
7. Create and store job descriptions.
8. Generate embeddings for job descriptions.
9. Compare resumes with jobs using MongoDB Atlas Vector Search.
10. Perform skill-based matching.
11. Display matching candidates and their scores through a React web interface.

---

# 2. Main Features

### Resume Management

* Upload PDF resumes
* Extract resume text automatically
* Parse candidate information using Gemini
* Store structured resume information
* Generate resume embeddings
* View complete resume details
* Search resumes by candidate name
* Delete resumes

### Job Management

* Create job descriptions
* Add required skills
* Generate job embeddings automatically
* View saved jobs
* Search jobs
* Edit job descriptions
* Delete jobs

### AI Resume Matching

* Semantic resume-to-job matching
* Skill-based matching
* Matched skills identification
* Missing skills identification
* Candidate ranking
* Match percentage visualization

### Frontend

* Dashboard
* Resume management
* Job management
* Resume detail page
* Job detail page
* Candidate search
* Match visualization
* Loading states
* Empty states
* Success/error notifications
* Delete confirmation dialogs
* Responsive UI

---

# 3. Technology Stack

| Layer                | Technology                  |
| -------------------- | --------------------------- |
| Frontend             | React + TypeScript          |
| Styling              | Tailwind CSS                |
| Backend              | FastAPI                     |
| Programming Language | Python                      |
| Database             | MongoDB Atlas               |
| Vector Search        | MongoDB Atlas Vector Search |
| LLM                  | Google Gemini API           |
| Embeddings           | Sentence Transformers       |
| Embedding Model      | all-MiniLM-L6-v2            |
| PDF Extraction       | PyMuPDF                     |
| API Documentation    | Swagger / OpenAPI           |
| Development Server   | Uvicorn                     |
| Package Management   | npm / pip                   |
| Containerization     | Docker                      |

---

# 4. Project Structure

```text
resume_matcher_fullstack/
│
├── .gitignore
│
└── backend/
    │
    ├── app/
    │   ├── api/
    │   │   └── v1/
    │   │       ├── endpoints/
    │   │       └── api.py
    │   │
    │   ├── schemas/
    │   ├── services/
    │   │   ├── extractor.py
    │   │   ├── parser.py
    │   │   ├── embedder.py
    │   │   ├── matcher.py
    │   │   └── skill_matcher.py
    │   │
    │   └── main.py
    │
    ├── frontend/
    │   ├── src/
    │   │   ├── components/
    │   │   ├── pages/
    │   │   └── lib/
    │   │
    │   ├── package.json
    │   └── vite.config.ts
    │
    ├── storage_vaults/
    │
    ├── .env.example
    ├── requirements.txt
    ├── Dockerfile
    ├── docker-compose.yml
    └── README.md
```

---

# 5. Prerequisites

Before running the project, install:

* **Python 3.11 or later**
* **Node.js 20 or later**
* **npm**
* **MongoDB Atlas account**
* **Google Gemini API key**
* **Git** (optional, for cloning the repository)

MongoDB Atlas is required because the application uses **MongoDB Atlas Vector Search**.

A normal local MongoDB Community Server does not provide the Atlas Vector Search functionality used by this project.

---

# 6. MongoDB Atlas Setup

### Step 1 — Create a MongoDB Atlas cluster

Create a MongoDB Atlas account and create a cluster.

Create a database user and allow your development IP address in the Atlas network access settings.

### Step 2 — Get the connection string

Copy the MongoDB connection string and use it as:

```env
MONGODB_URI=your_mongodb_connection_string
```

### Step 3 — Configure Vector Search

After at least one resume has been uploaded, the `resumes` collection will exist.

In MongoDB Atlas:

```text
Database
    ↓
Your Cluster
    ↓
Search
    ↓
Create Search Index
    ↓
Atlas Vector Search
    ↓
JSON Editor
```

Use the following vector index definition:

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

Use:

```text
vector_index
```

as the index name, unless `VECTOR_INDEX_NAME` in `.env` is configured with another name.

The vector index definition is also documented in:

```text
app/services/matcher.py
```

---

# 7. Gemini API Setup

The project uses the **Google Gemini API** for AI-based resume parsing.

Create a Gemini API key and add it to the backend `.env` file.

Example:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do **not** commit the real `.env` file to GitHub.

The repository contains:

```text
.env.example
```

as a template.

---

# 8. Backend Setup

Open Command Prompt or PowerShell.

Navigate to the backend:

```cmd
cd C:\Users\PREMA JYOTHI\OneDrive\Desktop\resume_matcher_fullstack\backend
```

Create a virtual environment if one does not already exist:

```cmd
python -m venv .venv
```

Activate it:

```cmd
.venv\Scripts\activate
```

Install the required Python packages:

```cmd
pip install -r requirements.txt
```

Create:

```text
backend/.env
```

using `.env.example` as a reference.

Configure the required values, including:

```env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
```

Then start the backend:

```cmd
uvicorn app.main:app --reload
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/api/v1/health
```

---

# 9. Frontend Setup

Open a **new terminal**.

Navigate to:

```cmd
cd C:\Users\PREMA JYOTHI\OneDrive\Desktop\resume_matcher_fullstack\backend\frontend
```

Install the frontend dependencies:

```cmd
npm install
```

Start the Vite development server:

```cmd
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

The Vite development server proxies `/api/*` requests to the FastAPI backend.

Therefore, both servers should be running during development:

```text
Frontend
http://localhost:5173
        |
        | /api/*
        ↓
Backend
http://127.0.0.1:8000
        |
        ↓
MongoDB Atlas
```

---

# 10. Running the Application

Two terminals are recommended.

### Terminal 1 — Backend

```cmd
cd C:\Users\PREMA JYOTHI\OneDrive\Desktop\resume_matcher_fullstack\backend
.venv\Scripts\activate
uvicorn app.main:app --reload
```

### Terminal 2 — Frontend

```cmd
cd C:\Users\PREMA JYOTHI\OneDrive\Desktop\resume_matcher_fullstack\backend\frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# 11. Application Workflow

The overall workflow is:

```text
                 ┌─────────────────┐
                 │   User Uploads  │
                 │     Resume      │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │  PDF Text       │
                 │  Extraction     │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │ Gemini AI       │
                 │ Resume Parsing  │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │ Structured      │
                 │ Resume Data     │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │ Sentence        │
                 │ Transformer     │
                 │ Embedding       │
                 └────────┬────────┘
                          ↓
                 ┌─────────────────┐
                 │ MongoDB Atlas   │
                 │ + Vector Search │
                 └─────────────────┘


Job Description
       │
       ↓
Job Embedding
       │
       ↓
MongoDB Atlas Vector Search
       │
       ↓
Semantic Matching
       │
       ↓
Skill Matching
       │
       ↓
Candidate Ranking
       │
       ↓
Frontend Results
```

---

# 12. Resume Matching Process

The system uses two major matching signals.

### 12.1 Semantic Matching

Resume and job description text are converted into vector embeddings using:

```text
all-MiniLM-L6-v2
```

Each embedding contains:

```text
384 dimensions
```

MongoDB Atlas Vector Search uses cosine similarity to identify semantically similar resumes.

---

### 12.2 Skill Matching

The system also compares required job skills with skills identified from the candidate's resume.

The result includes:

```text
Matched Skills
Missing Skills
Skill Match Score
```

This helps provide a more meaningful candidate comparison than semantic similarity alone.

---

# 13. Matching Result

The search result can contain information such as:

```text
Candidate: Prema Jyothi

Overall Match: 72%

Semantic Score: 68%

Skill Match Score: 74%

Matched Skills:
- Python
- MongoDB
- Communication

Missing Skills:
- React
- Node.js
```

The frontend displays the matching information visually.

---

# 14. API Endpoints

All API routes are prefixed with:

```text
/api/v1
```

| Method | Endpoint          | Purpose                                         |
| ------ | ----------------- | ----------------------------------------------- |
| GET    | `/health`         | Check API and MongoDB health                    |
| POST   | `/resumes`        | Upload and process a resume                     |
| GET    | `/resumes`        | List resumes                                    |
| GET    | `/resumes/{id}`   | View resume details                             |
| DELETE | `/resumes/{id}`   | Delete a resume                                 |
| POST   | `/jobs`           | Create a job description                        |
| GET    | `/jobs`           | List job descriptions                           |
| GET    | `/jobs/{id}`      | View job details                                |
| PATCH  | `/jobs/{id}`      | Update a job                                    |
| DELETE | `/jobs/{id}`      | Delete a job                                    |
| POST   | `/search/by-job`  | Match resumes against a saved job               |
| POST   | `/search/by-text` | Match resumes against free-text job information |

Interactive API documentation is available through Swagger:

```text
http://127.0.0.1:8000/docs
```

---

# 15. Frontend Structure

```text
frontend/src/
│
├── lib/
│   ├── api.ts
│   ├── types.ts
│   └── utils.ts
│
├── components/
│   ├── layout/
│   ├── ui/
│   ├── MatchRadar.tsx
│   ├── UploadDropzone.tsx
│   ├── ResumeCard.tsx
│   ├── JobCard.tsx
│   └── ConfirmDialog.tsx
│
├── pages/
│   ├── DashboardPage.tsx
│   ├── ResumesPage.tsx
│   ├── ResumeDetailPage.tsx
│   ├── JobsPage.tsx
│   ├── JobDetailPage.tsx
│   └── SearchPage.tsx
│
└── App.tsx
```

---

# 16. Frontend Pages

### Dashboard

Displays:

* Resume count
* Job count
* Recent activity
* System status

### Resumes

Allows users to:

* Upload resumes
* Search candidates
* View resumes
* Delete resumes

### Resume Details

Displays:

* Candidate information
* Education
* Experience
* Projects
* Skills
* Extracted resume information
* Raw extracted text

### Jobs

Allows users to:

* Create jobs
* Search jobs
* View jobs
* Delete jobs

### Job Details

Allows users to:

* View job information
* Edit job descriptions
* Update required skills

### Search

Allows users to:

* Select a saved job
* Search candidates
* Use free-text job descriptions
* View candidate ranking
* Compare matched and missing skills

---

# 17. Production Build

To create a production frontend build:

```cmd
cd backend\frontend
npm run build
```

The production files are generated in:

```text
frontend/dist/
```

To preview the production build:

```cmd
npm run preview
```

---

# 18. Docker Setup

The project also includes Docker configuration.

From the backend directory:

```cmd
docker compose up --build
```

The services provide:

```text
Frontend:
http://localhost:3000

Backend:
http://localhost:8000
```

MongoDB is not included as a local Docker service because the project requires MongoDB Atlas Vector Search.

---

# 19. Known Limitations

### 1. Synchronous Resume Processing

Resume parsing and embedding are currently performed during the upload request.

For a large-scale production system, these operations could be moved to background workers or a task queue such as Celery.

### 2. Scanned PDFs

The current PDF extraction process requires a text layer.

Scanned/image-only PDFs are not automatically processed.

OCR could be added in the future.

### 3. Authentication

The current version does not include a complete authentication and authorization system.

Authentication such as OAuth2/JWT could be added before deploying the system for unrestricted public use.

### 4. AI Parsing Dependency

Resume parsing depends on the Gemini API and therefore requires a valid API key and network connection.

### 5. Vector Search Dependency

Candidate semantic search depends on MongoDB Atlas Vector Search.

---

# 20. Future Enhancements

Possible future improvements include:

* OCR support for scanned resumes
* Authentication and role-based access
* Background resume processing
* Email notifications
* Advanced candidate filtering
* More sophisticated skill extraction
* Candidate comparison
* Recruiter dashboard
* Interview scheduling
* Resume recommendations
* Analytics and reporting
* Deployment to a cloud platform

---

# 21. Security

Sensitive configuration values should be stored in:

```text
backend/.env
```

The following should **never be committed to GitHub**:

```text
GEMINI_API_KEY
MONGODB_URI
```

The project uses:

```text
.env.example
```

to document the required environment variables without exposing their values.

Local uploaded resume files are also excluded from version control.

---

# 22. GitHub

The project source code is maintained in a Git repository.

Before pushing changes:

```cmd
git status
```

Then:

```cmd
git add .
git commit -m "Update AI Resume Matcher"
git push
```

Make sure that secret files such as `.env` are ignored before committing.

---

# 23. Academic Project Objective

The primary objective of this project is to demonstrate how **Artificial Intelligence, Natural Language Processing, vector embeddings, semantic search, and full-stack web development** can be combined to build an automated resume matching system.

The system reduces the need for purely manual resume screening by providing structured candidate information and similarity-based matching against job requirements.

---

# 24. Conclusion

The AI Resume Matcher demonstrates an end-to-end AI application in which resumes are processed, converted into structured information and vector representations, stored in MongoDB Atlas, and matched against job descriptions.

By combining **Gemini-based resume parsing, Sentence Transformer embeddings, MongoDB Atlas Vector Search, skill matching, FastAPI, and React**, the project provides a complete full-stack implementation of an AI-assisted candidate matching workflow.

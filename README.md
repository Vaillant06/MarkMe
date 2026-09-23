# MarkMe — College Attendance Marking System

MarkMe is an automated, web-based College Attendance Marking System designed for faculty at **Sri Sivasubramaniya Nadar College of Engineering (SSN)**. It allows authorized faculty members to mark period-wise attendance directly into existing Excel workbooks stored on **Google Drive** without disrupting formulas, merged cells, or summary sheets.

---

## 🚀 Key Features

1. **Google OAuth 2.0 with Strict Domain Enforcement**:
   - Only authenticated Google accounts belonging to `@ssn.edu.in` are permitted.
   - Any external domain (`@gmail.com`, `@othercollege.edu.in`) is rejected server-side.
2. **Absent-List Input Model (3-Digit Suffixes)**:
   - Faculty enters only the last 3 digits of absent students' register numbers (e.g. `067, 080, 114, 129`).
   - Suffix entered $\rightarrow$ marked **Absent (`A`)**; all other students $\rightarrow$ marked **Present (`P`)**.
3. **Mandatory Preview**:
   - Computes proposed attendance changes and presents a full review table (Total Enrolled, Present, Absent) before writing to Google Drive.
4. **Formula & Formatting Preservation**:
   - Utilizes pre-allocated column slots in the existing college attendance template.
   - Preserves all formula ranges (`=COUNTA(...)`, `=COUNTIF(...)`, `=SUM(...)`) and cross-sheet references in `STUDENT WISE SUMMARY SHEET` without shifting columns.
5. **Duplicate Session Protection**:
   - Scans Row 12 for existing date and period combinations.
   - Alerts faculty with an interactive modal and blocks silent overwrites unless explicitly confirmed.
6. **Optimistic Concurrency Protection**:
   - Tracks Google Drive file revisions to prevent overwriting updates made concurrently by another faculty member.
7. **Production Decoupled Cloud Architecture**:
   - Frontend deployed on Vercel with SPA routing.
   - High-performance FastAPI backend deployed on Render with Gunicorn and Uvicorn workers.

---

## 🛠️ Architecture & Tech Stack

- **Backend**:
  - Python 3.11+
  - [FastAPI](https://fastapi.tiangolo.com/) (RESTful API & async handlers)
  - [openpyxl](https://openpyxl.readthedocs.io/) (Non-destructive Excel reading & writing with `data_only=False`)
  - [google-api-python-client](https://github.com/googleapis/google-api-python-client) & `google-auth`
  - Signed session tokens via `itsdangerous`
- **Frontend**:
  - React 18 with TypeScript
  - [Vite](https://vitejs.dev/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [Lucide Icons](https://lucide.dev/)

---

## 📦 Project Structure

```text
MarkMe/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app entry point & CORS
│   │   ├── config.py                   # App configuration & environment settings
│   │   ├── auth/
│   │   │   ├── google_oauth.py         # Google OAuth token exchange & domain validation
│   │   │   ├── session.py              # Secure session management
│   │   │   └── dependencies.py         # FastAPI auth dependencies
│   │   ├── drive/
│   │   │   └── service.py              # Google Drive API wrapper & file revision updater
│   │   ├── excel/
│   │   │   ├── parser.py               # Workbook, sheet, and student roster parser
│   │   │   ├── session_matcher.py      # Session header parser & duplicate detection
│   │   │   └── updater.py              # Attendance writer & summary formula builder
│   │   ├── attendance/
│   │   │   ├── validator.py            # Absent 3-digit suffix validation
│   │   │   └── preview.py              # Student-by-student preview generator
│   │   ├── models/
│   │   │   └── schemas.py              # Pydantic data schemas
│   │   └── routes/
│   │       ├── auth.py                 # OAuth & login endpoints
│   │       ├── drive.py                # Drive folder & file selection endpoints
│   │       ├── workbooks.py            # Workbook inspection endpoint
│   │       └── attendance.py           # Preview and commit endpoints
│   ├── tests/                          # Pytest unit & integration test suite
│   ├── requirements.txt
│   ├── Dockerfile                      # Production container build
│   └── Procfile                        # Production WSGI/ASGI entrypoint
├── frontend/
│   ├── src/
│   │   ├── api/client.ts               # Typed fetch client
│   │   ├── components/
│   │   │   ├── Header.tsx              # SSN branded navigation header
│   │   │   ├── AttendancePreviewModal.tsx # Full student review modal
│   │   │   ├── DuplicateWarningModal.tsx  # Duplicate protection prompt
│   │   │   └── SuccessView.tsx         # Confirmation screen
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx           # Institutional sign-in page
│   │   │   ├── DriveSetupPage.tsx      # Google Drive folder setup
│   │   │   ├── FileSelectionPage.tsx   # Excel file selector
│   │   │   └── AttendanceMarkingPage.tsx # Core attendance marking form
│   │   ├── types/index.ts              # TypeScript interfaces
│   │   ├── App.tsx                     # Main flow coordinator
│   │   └── main.tsx
│   ├── vercel.json                     # Vercel SPA routing rewrites
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── .env.example
├── Procfile                            # Render entrypoint
└── README.md
```

---

## ⚙️ Quickstart Guide

### 1. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Configure your credentials from the [Google Cloud Console](https://console.cloud.google.com/):
```ini
AUTHORIZED_DOMAIN=ssn.edu.in
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/google/callback
SESSION_SECRET=a-secure-random-secret-key
SESSION_EXPIRE_DAYS=30
SESSION_EXPIRE_HOURS=720
SESSION_COOKIE_SECURE=True
FRONTEND_URL=https://your-frontend.vercel.app
```

---

### 2. Backend Setup & Run

The backend uses a Python virtual environment located in `backend/venv`:

```bash
cd backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies (already installed)
pip install -r requirements.txt

# Run the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 3. Frontend Setup & Run

In a separate terminal:

```bash
cd frontend

# Install dependencies (already installed)
npm install

# Start the Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Tests

Run the complete test suite (unit tests for Excel parsing, suffix validation, formula preservation, and full API integration):

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

All 16 tests verify:
- Accurate student extraction (71 students, suffixes `067` through `310`)
- Suffix validation (duplicates, non-3-digit tokens, invalid suffixes)
- Duplicate session detection
- Non-destructive workbook updates and bottom formula injection (`COUNTIF`, `SUM`)
- Full authenticated API flow and domain protection

---

## 🔒 Security & Concurrency

- **Domain Restriction**: Enforced on the verified Google ID token payload (`hd == "ssn.edu.in"` and email regex). Client-provided emails are never trusted.
- **Session Security**: Signed, HTTP-only, SameSite cookies with 1-month (30-day) persistent session retention (SQLite-backed) across server restarts and browser sessions.
- **Drive Version Locking**: Verifies `headRevisionId` before updating to prevent race conditions when multiple faculty update sheets concurrently.

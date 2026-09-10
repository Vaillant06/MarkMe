# College Attendance Marking System — Agent Context

## Project Goal
Build a web-based College Attendance Marking System that allows authorized college users to mark attendance in the existing Excel attendance workbook stored in Google Drive.

The application must NOT replace the college's existing Excel format. It should automate selecting the workbook, entering attendance through a web form, previewing changes, and finally updating the workbook and saving it back to Google Drive.

Reference workbook:
`/mnt/data/V Sem B Attendance sheet.xlsx`

Inspect this workbook programmatically before implementing Excel-processing logic. Do not assume its structure.

## Complete User Flow

```text
Login Page
  ↓
Sign in with Google
  ↓
Google OAuth authentication
  ↓
Verify authenticated email
  ↓
Check @ssn.edu.in
  ↓
Invalid → reject
Valid → authenticated session
  ↓
Connect Google Drive
  ↓
Select attendance folder
  ↓
Show Excel files in folder
  ↓
Select attendance workbook
  ↓
Attendance marking form
  ↓
Select class / section / subject / date / period
  ↓
Enter last 3 digits of absent students' register numbers
  ↓
Validate input
  ↓
Generate preview
  ↓
Faculty reviews
  ↓
Edit OR Confirm & Save
  ↓
Update Excel workbook
  ↓
Save updated workbook to Google Drive
  ↓
Success
```

Unauthenticated users must never access the attendance-marking page.

## 1. Authentication

Use **Google OAuth 2.0**. Do not build username/password authentication.

Login page:

```text
COLLEGE ATTENDANCE SYSTEM

Faculty Attendance Portal

[ Sign in with Google ]

Only @ssn.edu.in accounts are permitted.
```

Only authenticated Google accounts belonging to `@ssn.edu.in` are allowed.

Examples:

```text
faculty@ssn.edu.in       → ALLOW
student@ssn.edu.in       → ALLOW initially
user@gmail.com           → REJECT
user@ssn.edu             → REJECT
user@othercollege.edu.in → REJECT
```

The backend must enforce the domain restriction using the verified Google OAuth identity. Never trust a client-supplied email address.

If Google authentication succeeds but the email is outside `@ssn.edu.in`, deny access and do not expose the attendance dashboard.

## 2. Google Drive Authorization

Treat authentication and Drive authorization as separate logical stages.

After successful authentication, show:

```text
CONNECT ATTENDANCE FOLDER

Your Google account:
faculty@ssn.edu.in

Select the Google Drive folder containing
the attendance Excel files.

[ Select Google Drive Folder ]
```

Use Google Drive API and the required OAuth scopes.

Store the selected Google Drive **folder ID**, not merely its name.

If a user has already configured a folder, reuse it on later sessions and provide:

```text
[ Change Attendance Folder ]
```

Request only the permissions required by the application.

## 3. Google Drive File Selection

List Excel files in the selected folder. Initially support `.xlsx`.

Example:

```text
Attendance Folder

📊 V Sem A Attendance.xlsx
📊 V Sem B Attendance.xlsx
📊 VI Sem A Attendance.xlsx

[ Select ]
```

Retrieve/access the selected workbook through the backend. Do not unnecessarily retain permanent copies of student data.

## 4. Reference Excel Workbook

Reference file:

`/mnt/data/V Sem B Attendance sheet.xlsx`

The workbook contains multiple subject worksheets, including examples such as:

```text
UIT3561
UIT3562
UIT3563
UIT3501
UIT3515
UIT3519
UIT3517
```

It also contains:

```text
SUBJECT SUMMARY SHEET
STUDENT WISE SUMMARY SHEET
```

Subject sheets contain student information such as:

```text
S.No
Digital ID
Register Number
Student Name
SSN Email ID
```

followed by attendance columns.

Attendance values:

```text
P = Present
A = Absent
```

The workbook contains formatting, formulas, merged cells, headers and summary information. Modify the existing workbook rather than recreating it.

Preserve existing worksheets, formulas, formatting, merged cells, borders, widths and unrelated content as much as possible.

## 5. Mandatory Workbook Analysis

Before writing the final Excel update logic, inspect the workbook programmatically and determine:

- all worksheet names
- subject-sheet structure
- header rows
- student table location
- student start/end rows
- register-number column
- student-name column
- subject code/name
- attendance columns
- date representation
- period/hour representation
- how attendance sessions are identified
- summary-sheet formulas
- formula ranges
- merged cells
- formatting patterns

Do not hard-code row/column positions unless analysis confirms they are stable.

## 6. Attendance Form

After selecting the workbook, show:

```text
ATTENDANCE

Excel File:
[V Sem B Attendance sheet.xlsx]

Class:
[ V SEM ]

Section:
[ B ]

Subject:
[ UIT3562 - Principles of Operating Systems ]

Date:
[ 10/09/2026 ]

Period:
[ 3 ]

Absent Students:
┌──────────────────────────────────────┐
│ 067, 080, 114, 129                   │
└──────────────────────────────────────┘

[ Generate Preview ]
```

Subject options should preferably be derived from workbook subject sheets.

## 7. Attendance Input Model

Faculty should NOT manually select every student.

Use an **absent-list model**. The faculty enters only the last three digits of the register numbers of absent students.

Example:

```text
067, 080, 114, 129
```

The system reads all students from the selected subject sheet and matches the last three digits of their full register numbers.

Example:

```text
Full Register No       Suffix       Attendance

3122245002067             067          A
3122245002068             068          P
3122245002080             080          A
3122245002081             081          P
```

Rule:

```text
Suffix entered → A
Suffix not entered → P
```

The full register number remains the real student identifier. The three-digit suffix is only an input shortcut.

## 8. Input Validation

Validate before preview.

Examples:

```text
067, 080, 080
```
→ duplicate `080`

```text
067, abc, 080
```
→ invalid `abc`

```text
067, 999
```
→ `999` not found if no matching student exists

Show clear errors and block preview/commit until resolved.

Reasonable normalization may support:

```text
067,080,114
067 080 114
067, 080, 114
```

but every final value must be exactly three numeric digits.

## 9. Preview Is Mandatory

Never modify the Google Drive workbook when the form is initially submitted.

Use:

```text
Workbook
  ↓
Calculate proposed attendance
  ↓
Preview
  ↓
Faculty review
  ↓
Confirm
  ↓
Modify workbook
  ↓
Save to Drive
```

Preview:

```text
ATTENDANCE PREVIEW

Class: V SEM B
Subject: UIT3562 - Principles of Operating Systems
Date: 10/09/2026
Period: 3

Total Students: 64
Present: 60
Absent: 4
```

Then show student-level results:

| Register No | Student | Attendance |
|---|---|---|
| ...067 | Student A | ABSENT |
| ...068 | Student B | PRESENT |
| ...080 | Student C | ABSENT |

Buttons:

```text
[ Edit Attendance ]
[ Confirm & Save ]
```

Preview must represent exactly what will be committed. Prefer using the same normalized attendance-change object for preview and commit.

## 10. Excel Update Algorithm

On `Confirm & Save`:

1. Retrieve/open the selected workbook.
2. Verify it has not changed since loading, where practical.
3. Identify the selected subject worksheet.
4. Identify the student table.
5. Build a mapping:
   `last_3_digits → Excel row`
6. Locate the attendance column for selected date + period.
7. If the session already exists, do not silently overwrite it.
8. If it does not exist, create the attendance column in the correct location.
9. Write `A` for supplied suffixes.
10. Write `P` for all other students.
11. Preserve unrelated workbook content.
12. Preserve formulas and formatting as far as possible.
13. Save a temporary updated workbook.
14. Update/upload it to Google Drive only after confirmation.
15. Return a clear success/failure result.

## 11. Duplicate Session Protection

If attendance already exists for the selected subject/date/period, show:

```text
Attendance already exists for:

UIT3562
10/09/2026
Period 3

[ Cancel ]
[ Review Existing Attendance ]
```

Never silently overwrite.

## 12. Summary Sheets

Inspect:

```text
SUBJECT SUMMARY SHEET
STUDENT WISE SUMMARY SHEET
```

Determine:

- formula dependencies
- whether summary values update automatically
- whether formulas use fixed ranges
- whether adding an attendance column requires extending formula ranges
- how to preserve summary calculations

Test with the supplied workbook.

## 13. Concurrency Protection

Handle:

```text
Faculty A loads workbook
      ↓
Faculty B modifies workbook
      ↓
Faculty A clicks Save
```

Do not blindly overwrite newer changes.

Use Google Drive metadata/version information where practical.

If changed:

```text
The attendance workbook has been modified
since you opened it.

Please reload the latest version before saving.
```

## 14. Recommended Technology Stack

Frontend:
- React
- TypeScript
- Tailwind CSS

Backend:
- Python
- FastAPI

Excel:
- openpyxl

Google:
- Google OAuth 2.0
- Google Drive API

Database:
- PostgreSQL if persistent application state is needed.

Do not unnecessarily duplicate the entire Excel attendance dataset in the database.

Database may store:

```text
Users
Drive folder configuration
Application settings
Audit logs
Attendance operations
```

## 15. Backend Structure

Suggested:

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── auth/
│   │   ├── google_oauth.py
│   │   ├── session.py
│   │   └── dependencies.py
│   ├── drive/
│   │   ├── service.py
│   │   ├── files.py
│   │   └── folders.py
│   ├── attendance/
│   │   ├── parser.py
│   │   ├── validator.py
│   │   ├── preview.py
│   │   └── updater.py
│   ├── models/
│   ├── schemas/
│   └── routes/
├── tests/
└── requirements.txt
```

Keep Google Drive, authentication, Excel processing and attendance logic modular.

## 16. Frontend Structure

Suggested:

```text
frontend/
├── src/
│   ├── pages/
│   │   ├── Login/
│   │   ├── DriveSetup/
│   │   ├── FileSelection/
│   │   ├── Attendance/
│   │   └── Preview/
│   ├── components/
│   │   ├── GoogleLoginButton
│   │   ├── DriveFolderPicker
│   │   ├── ExcelFileList
│   │   ├── AttendanceForm
│   │   ├── ValidationErrors
│   │   └── AttendancePreview
│   ├── services/
│   ├── hooks/
│   └── types/
```

## 17. Suggested API

Approximately:

```text
GET  /auth/google/login
GET  /auth/google/callback
POST /auth/logout
GET  /auth/me

GET  /drive/folders
POST /drive/folders/select
GET  /drive/files

GET  /workbooks/{file_id}/subjects
GET  /workbooks/{file_id}/subjects/{subject}/students

POST /attendance/preview
POST /attendance/commit

GET  /operations/{operation_id}
```

Adjust as needed for a better architecture.

## 18. Protected Routes

Require an authenticated session for:

```text
/drive/files
/workbooks/...
/attendance/preview
/attendance/commit
```

Unauthenticated requests should receive `401`. Authenticated but unauthorized requests should receive `403` where appropriate.

## 19. Session and Logout

After successful OAuth:
- create an authenticated application session
- protect attendance routes
- protect backend APIs
- provide Logout
- invalidate the application session on logout

Example:

```text
faculty@ssn.edu.in
[ Logout ]
```

Handle OAuth tokens securely and do not unnecessarily expose them to the browser.

## 20. Security

Implement at minimum:

- Google OAuth 2.0
- backend `@ssn.edu.in` enforcement
- secure session handling
- HTTPS in production
- CSRF protection where applicable
- secure OAuth token handling
- environment variables for secrets
- no Google client secrets in Git
- no access tokens hard-coded in frontend
- server-side attendance validation
- authorization checks on protected APIs
- audit logging
- minimum required Google scopes

Environment variables:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
DATABASE_URL=
SESSION_SECRET=
```

Provide `.env.example` and add `.env` to `.gitignore`.

## 21. Audit Logging

Record:

```text
User
Google account
Workbook
Subject
Date
Period
Number of students
Number present
Number absent
Timestamp
Operation status
```

Do not log OAuth secrets.

## 22. UX Requirements

The application should be fast and simple enough for faculty to mark attendance in under a minute.

Ideal flow:

```text
Login
 ↓
Drive folder
 ↓
Excel file
 ↓
Attendance form
 ↓
Preview
 ↓
Save
```

Use clear loading states:

```text
Connecting to Google...
Loading Drive files...
Reading attendance workbook...
Generating preview...
Saving attendance...
```

Success example:

```text
✓ Attendance saved successfully.

UIT3562
10 September 2026
Period 3

60 Present
4 Absent
```

## 23. Main Screens

### Login

```text
COLLEGE ATTENDANCE SYSTEM

Faculty Attendance Portal

[ Sign in with Google ]

Only @ssn.edu.in accounts are permitted.
```

### Drive Setup

```text
CONNECT ATTENDANCE FOLDER

Google account:
faculty@ssn.edu.in

[ Select Google Drive Folder ]
```

### Excel Selection

```text
Attendance Folder

📊 V Sem A Attendance.xlsx
📊 V Sem B Attendance.xlsx
📊 VI Sem A Attendance.xlsx

[ Select ]
```

### Attendance

```text
Class
Section
Subject
Date
Period

Absent Students:
067, 080, 114, 129

[ Generate Preview ]
```

### Preview

```text
Total Students: 64
Present: 60
Absent: 4

Student attendance table

[ Edit Attendance ]
[ Confirm & Save ]
```

### Success

```text
✓ Attendance saved successfully.

The updated workbook has been saved to Google Drive.
```

## 24. Error Handling

Handle clearly:

- Google authentication failure
- unauthorized domain
- expired session
- Drive permission denial
- unavailable folder
- workbook not found
- workbook retrieval failure
- unsupported file
- corrupted workbook
- missing subject sheet
- missing student table
- invalid suffix
- duplicate suffix
- unmatched suffix
- existing attendance session
- stale workbook/version conflict
- Excel processing failure
- Drive upload/update failure

Never expose raw stack traces to users. Log technical details server-side.

## 25. Testing

### Authentication

```text
@ssn.edu.in → allowed
@gmail.com → rejected
@other.edu.in → rejected
```

### Suffix matching

```text
067 → correct student
080 → correct student
```

### Invalid input

```text
abc
12
1234
duplicate values
nonexistent suffix
```

### Attendance generation

Input:

```text
067,080
```

Expected:

```text
067 → A
080 → A
all other students → P
```

### Excel update

Verify:
- correct subject sheet modified
- correct rows modified
- correct date/period column found or created
- existing attendance protected
- formulas preserved
- formatting preserved
- other sheets unchanged

### Google Drive

Test:
- OAuth
- folder selection
- file listing
- file retrieval
- file update
- permission failures
- stale version conflict

## 26. Development Order

Do not build everything at once.

### Step 1 — Analyze workbook
Inspect `/mnt/data/V Sem B Attendance sheet.xlsx` and document the exact structure.

### Step 2 — Build Excel parser
Implement detection of:
- subjects
- students
- register numbers
- student rows
- attendance sessions
- attendance columns
- class/section
- subject metadata

### Step 3 — Build attendance engine
Input:

```text
Workbook
Subject
Date
Period
Absent suffix list
```

Output:

```text
Student → P/A
```

### Step 4 — Build preview
Use the same attendance-change representation as commit.

### Step 5 — Implement Google OAuth
Configure:
- Google Cloud project
- OAuth client
- callback
- verified identity
- `@ssn.edu.in` enforcement
- secure session

### Step 6 — Implement Google Drive
Implement:
- Drive authorization
- folder selection
- saved folder configuration
- Excel file listing
- workbook retrieval
- workbook update

### Step 7 — Build frontend
Implement all screens and connect to backend.

### Step 8 — Integration
Connect OAuth + Drive + Excel parser + attendance engine + preview + commit.

### Step 9 — Test
Run complete workflow using the supplied workbook.

### Step 10 — Production hardening
Add security, logging, audit trail, concurrency protection and deployment configuration.

## 27. Engineering Rules

1. Inspect the real workbook before coding Excel manipulation.
2. Do not assume fixed row/column positions unless confirmed.
3. Do not recreate the workbook from scratch.
4. Do not silently overwrite existing attendance.
5. Do not modify Drive until preview is confirmed.
6. Preview and commit must use the same attendance calculation logic.
7. Validate everything on the backend.
8. Do not trust client-supplied email as proof of identity.
9. Do not expose attendance pages to unauthenticated users.
10. Never commit OAuth secrets or `.env`.
11. Do not unnecessarily duplicate the Excel dataset in a database.
12. Preserve formulas and formatting.
13. Handle Drive version/concurrency conflicts.
14. Keep modules separated and testable.
15. Prefer maintainable, tested code over a quick prototype.

## 28. Definition of Done

A faculty member must be able to:

```text
1. Open the application.
2. Click "Sign in with Google".
3. Authenticate using an @ssn.edu.in account.
4. Be rejected if outside @ssn.edu.in.
5. Reach Drive setup after authentication.
6. Authorize Google Drive.
7. Select the attendance folder.
8. See Excel files in that folder.
9. Select V Sem B Attendance sheet.xlsx.
10. Select class, section, subject, date and period.
11. Enter 067, 080, 114, 129.
12. Validate the suffixes.
13. Match suffixes to students.
14. Generate a complete P/A preview.
15. Review the preview.
16. Click Confirm & Save.
17. Update the correct subject sheet.
18. Preserve workbook structure and formatting.
19. Save the updated workbook back to Google Drive.
20. Receive a success message.
```

## 29. First Task for the Agent

Do NOT immediately build the complete application.

First:

1. Inspect `/mnt/data/V Sem B Attendance sheet.xlsx`.
2. Analyze every relevant worksheet.
3. Determine the exact attendance structure.
4. Determine how date and period are represented.
5. Determine how student rows are identified.
6. Determine how summary formulas work.
7. Identify risks in modifying the workbook.
8. Propose the final technical architecture.
9. Propose the Excel parser/update algorithm.
10. Propose the Google OAuth + Drive authorization flow.
11. Propose frontend/backend structure.
12. List assumptions that should be configurable.

After this analysis, wait for approval before making major implementation changes.

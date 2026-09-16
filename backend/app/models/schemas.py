from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    hd: Optional[str] = None
    is_authorized: bool = False

class DriveFolder(BaseModel):
    id: str
    name: str
    mime_type: str = "application/vnd.google-apps.folder"

class DriveFile(BaseModel):
    id: str
    name: str
    mime_type: str
    modified_time: Optional[str] = None
    size: Optional[str] = None
    head_revision_id: Optional[str] = None

class FolderSelectRequest(BaseModel):
    folder_id: str
    folder_name: str

class FolderResolveRequest(BaseModel):
    input: str

class FolderRemoveRequest(BaseModel):
    folder_id: str

class WorkbookSelectRequest(BaseModel):
    file_id: str
    file_name: Optional[str] = None

class StudentInfo(BaseModel):
    sno: int
    digital_id: str
    register_number: str
    suffix: str
    name: str
    email: str
    row: int

class ExistingSession(BaseModel):
    col_idx: int
    col_letter: str
    header_raw: str
    date_normalized: Optional[str] = None
    period_normalized: Optional[str] = None

class SubjectInfo(BaseModel):
    code: str
    name: str
    sheet_name: str
    faculty_name: str
    class_section: str
    academic_year: str
    student_count: int
    existing_sessions: List[ExistingSession] = []
    next_available_col: int
    next_available_col_letter: str

class WorkbookDetails(BaseModel):
    file_id: str
    file_name: str
    class_name: str
    section: str
    academic_year: str
    subjects: List[SubjectInfo]

class AttendancePreviewItem(BaseModel):
    sno: int
    register_number: str
    suffix: str
    name: str
    status: Literal["PRESENT", "ABSENT"]

class AttendancePreviewRequest(BaseModel):
    file_id: str
    sheet_name: str
    date: str              # e.g., "10/09/2026" or "2026-09-10"
    period: str            # e.g., "3"
    absent_input: Optional[str] = ""      # kept for backward compatibility
    student_input: Optional[str] = None   # input containing 3-digit student suffixes
    entry_mode: Literal["ABSENT", "PRESENT"] = "ABSENT"

class AttendancePreviewResponse(BaseModel):
    class_name: str
    section: str
    subject_code: str
    subject_name: str
    date: str
    period: str
    total_students: int
    present_count: int
    absent_count: int
    students: List[AttendancePreviewItem]
    absent_suffixes: List[str]
    entry_mode: Literal["ABSENT", "PRESENT"] = "ABSENT"
    duplicate_warning: bool = False
    existing_session_col: Optional[int] = None
    existing_session_col_letter: Optional[str] = None

class AttendanceCommitRequest(BaseModel):
    file_id: str
    sheet_name: str
    date: str
    period: str
    absent_suffixes: List[str]
    allow_overwrite: bool = False
    target_col_idx: Optional[int] = None
    head_revision_id: Optional[str] = None

class AttendanceCommitResponse(BaseModel):
    success: bool
    message: str
    sheet_name: str
    subject_code: str
    date: str
    period: str
    total_students: int
    present_count: int
    absent_count: int
    target_col_letter: str
    new_revision_id: Optional[str] = None

class SessionStatisticsItem(BaseModel):
    col_idx: int
    col_letter: str
    header_raw: str
    date: str
    period: str
    session_label: str
    present_count: int
    absent_count: int
    unrecorded_count: int
    attendance_percentage: float

class SubjectStatisticsResponse(BaseModel):
    file_id: str
    file_name: str
    sheet_name: str
    subject_code: str
    subject_name: str
    faculty_name: str
    class_section: str
    academic_year: str
    threshold: float = 75.0
    has_sessions: bool = True
    message: Optional[str] = None
    total_students: int
    total_sessions: int
    average_attendance: float
    average_attendance_raw: float
    total_present: int
    total_absent: int
    total_unrecorded: int
    unexpected_values_count: int = 0
    below_threshold_count: int
    present_percentage: float
    absent_percentage: float
    distribution_90_100: int
    distribution_80_89: int
    distribution_75_79: int
    distribution_below_75: int
    sessions: List[SessionStatisticsItem] = []

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  hd?: string;
  is_authorized: boolean;
}

export interface DriveFolder {
  id: string;
  name: string;
  mime_type: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mime_type: string;
  modified_time?: string;
  size?: string;
  head_revision_id?: string;
}

export interface ExistingSession {
  col_idx: number;
  col_letter: string;
  header_raw: string;
  date_normalized?: string;
  period_normalized?: string;
}

export interface SubjectInfo {
  code: string;
  name: string;
  sheet_name: string;
  faculty_name: string;
  class_section: string;
  academic_year: string;
  student_count: number;
  existing_sessions: ExistingSession[];
  next_available_col: number;
  next_available_col_letter: string;
}

export interface WorkbookDetails {
  file_id: string;
  file_name: string;
  class_name: string;
  section: string;
  academic_year: string;
  subjects: SubjectInfo[];
}

export interface AttendancePreviewItem {
  sno: number;
  register_number: string;
  suffix: string;
  name: string;
  status: 'PRESENT' | 'ABSENT';
}

export interface AttendancePreviewResponse {
  class_name: string;
  section: string;
  subject_code: string;
  subject_name: string;
  date: string;
  period: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  students: AttendancePreviewItem[];
  absent_suffixes: string[];
  entry_mode?: 'ABSENT' | 'PRESENT';
  duplicate_warning: boolean;
  existing_session_col?: number;
  existing_session_col_letter?: string;
}

export interface AttendanceCommitResponse {
  success: boolean;
  message: string;
  sheet_name: string;
  subject_code: string;
  date: string;
  period: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  target_col_letter: string;
  new_revision_id?: string;
}

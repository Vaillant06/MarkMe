from typing import List, Optional
import openpyxl
from app.models.schemas import (
    StudentInfo,
    SubjectInfo,
    AttendancePreviewItem,
    AttendancePreviewResponse
)
from app.excel.parser import extract_students, parse_header_metadata, find_summary_col, extract_existing_sessions
from app.attendance.validator import parse_and_validate_suffixes
from app.excel.session_matcher import is_duplicate_session

def generate_attendance_preview(
    ws: openpyxl.worksheet.worksheet.Worksheet,
    sheet_name: str,
    date: str,
    period: str,
    student_input: Optional[str] = None,
    absent_input: Optional[str] = None,
    entry_mode: str = "ABSENT"
) -> AttendancePreviewResponse:
    """
    Validates input, checks for existing sessions, and computes complete P/A preview.
    Supports entry_mode="ABSENT" (input lists absentees) or "PRESENT" (input lists presentees).
    """
    students = extract_students(ws)
    metadata = parse_header_metadata(ws)
    
    raw_input = student_input if student_input is not None else (absent_input or "")
    
    # Validate suffixes against class roster
    mode_label = "present" if entry_mode == "PRESENT" else "absent"
    entered_suffixes = parse_and_validate_suffixes(raw_input, students, mode_label=mode_label)
    
    if entry_mode == "PRESENT":
        present_set = set(entered_suffixes)
        absent_suffixes = [st.suffix for st in students if st.suffix not in present_set]
        absent_set = set(absent_suffixes)
    else:
        absent_suffixes = entered_suffixes
        absent_set = set(absent_suffixes)
        present_set = {st.suffix for st in students if st.suffix not in absent_set}
    
    # Class & Section parsing
    class_section = metadata["class_section"] or "V SEM IT B"
    parts = class_section.split()
    section = parts[-1] if parts else "B"
    class_name = " ".join(parts[:-1]) if len(parts) > 1 else class_section
    
    # Build student preview items
    preview_items: List[AttendancePreviewItem] = []
    present_count = 0
    absent_count = 0
    
    for st in students:
        is_absent = st.suffix in absent_set
        status = "ABSENT" if is_absent else "PRESENT"
        if is_absent:
            absent_count += 1
        else:
            present_count += 1
            
        preview_items.append(AttendancePreviewItem(
            sno=st.sno,
            register_number=st.register_number,
            suffix=st.suffix,
            name=st.name,
            status=status
        ))
        
    # Check for duplicate session in existing columns
    summary_col = find_summary_col(ws)
    existing_sessions, _ = extract_existing_sessions(ws, summary_col)
    
    duplicate_warning = False
    dup_col_idx: Optional[int] = None
    dup_col_letter: Optional[str] = None
    
    for s in existing_sessions:
        if is_duplicate_session(s.header_raw, date, period):
            duplicate_warning = True
            dup_col_idx = s.col_idx
            dup_col_letter = s.col_letter
            break
            
    return AttendancePreviewResponse(
        class_name=class_name,
        section=section,
        subject_code=metadata["sub_code"] or sheet_name,
        subject_name=metadata["sub_name"] or sheet_name,
        date=date,
        period=period,
        total_students=len(students),
        present_count=present_count,
        absent_count=absent_count,
        students=preview_items,
        absent_suffixes=absent_suffixes,
        entry_mode=entry_mode,
        duplicate_warning=duplicate_warning,
        existing_session_col=dup_col_idx,
        existing_session_col_letter=dup_col_letter
    )

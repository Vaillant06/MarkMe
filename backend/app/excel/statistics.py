import openpyxl
from typing import List, Optional
from app.models.schemas import SubjectStatisticsResponse, SessionStatisticsItem
from app.excel.parser import (
    extract_students,
    find_summary_col,
    extract_existing_sessions,
    parse_header_metadata,
    is_subject_sheet,
)

def calculate_subject_statistics(
    wb: openpyxl.Workbook,
    sheet_name: str,
    threshold: float = 75.0,
    file_id: str = "",
    file_name: str = ""
) -> SubjectStatisticsResponse:
    """
    Calculates Level 1 Subject Statistics from an openpyxl Workbook.
    Reuses existing parser functions to identify student rows and session columns.
    Does NOT modify the workbook.
    """
    if sheet_name not in wb.sheetnames:
        raise ValueError(f"Subject sheet '{sheet_name}' not found in workbook.")

    ws = wb[sheet_name]
    if not is_subject_sheet(sheet_name, ws):
        raise ValueError(f"Worksheet '{sheet_name}' is not an active subject attendance sheet.")

    meta = parse_header_metadata(ws)
    subject_code = meta["sub_code"] or sheet_name
    subject_name = meta["sub_name"] or sheet_name
    faculty_name = meta["faculty_name"]
    class_section = meta["class_section"]
    academic_year = meta["academic_year"]

    students = extract_students(ws)
    summary_col = find_summary_col(ws)
    sessions, _ = extract_existing_sessions(ws, summary_col)

    total_students = len(students)
    total_sessions = len(sessions)

    # Handle edge case: no recorded sessions
    if total_sessions == 0 or total_students == 0:
        return SubjectStatisticsResponse(
            file_id=file_id,
            file_name=file_name,
            sheet_name=sheet_name,
            subject_code=subject_code,
            subject_name=subject_name,
            faculty_name=faculty_name,
            class_section=class_section,
            academic_year=academic_year,
            threshold=threshold,
            has_sessions=False,
            message="No attendance sessions have been recorded for this subject.",
            total_students=total_students,
            total_sessions=0,
            average_attendance=0.0,
            average_attendance_raw=0.0,
            total_present=0,
            total_absent=0,
            total_unrecorded=0,
            unexpected_values_count=0,
            below_threshold_count=0,
            present_percentage=0.0,
            absent_percentage=0.0,
            distribution_90_100=0,
            distribution_80_89=0,
            distribution_75_79=0,
            distribution_below_75=0,
            sessions=[]
        )

    # Process each student's attendance records
    total_present = 0
    total_absent = 0
    total_unrecorded = 0
    unexpected_values_count = 0
    student_percentages: List[float] = []

    for student in students:
        p_count = 0
        a_count = 0
        unrec_count = 0

        for session in sessions:
            val = ws.cell(student.row, session.col_idx).value
            if val is None or str(val).strip() == "":
                unrec_count += 1
            else:
                norm_val = str(val).strip().upper()
                if norm_val == "P":
                    p_count += 1
                elif norm_val == "A":
                    a_count += 1
                else:
                    # Unexpected value (neither blank nor standard P/A)
                    unexpected_values_count += 1
                    unrec_count += 1

        total_present += p_count
        total_absent += a_count
        total_unrecorded += unrec_count

        recorded_sessions_for_student = p_count + a_count
        if recorded_sessions_for_student > 0:
            student_pct = (p_count / recorded_sessions_for_student) * 100.0
        else:
            student_pct = 0.0

        student_percentages.append(student_pct)

    # Core summary metrics
    avg_attendance_raw = (
        sum(student_percentages) / len(student_percentages)
        if student_percentages
        else 0.0
    )
    avg_attendance = round(avg_attendance_raw, 1)

    # Students below threshold
    below_threshold_count = sum(1 for p in student_percentages if p < threshold)

    # Attendance distribution groups:
    # 90–100%, 80–89%, 75–79%, Below 75%
    # "Students exactly at 75% belong to the 75–79% group, not Below 75%."
    dist_90_100 = sum(1 for p in student_percentages if p >= 90.0)
    dist_80_89 = sum(1 for p in student_percentages if 80.0 <= p < 90.0)
    dist_75_79 = sum(1 for p in student_percentages if 75.0 <= p < 80.0)
    dist_below_75 = sum(1 for p in student_percentages if p < 75.0)

    # Overall attendance part-to-whole
    total_valid_entries = total_present + total_absent
    if total_valid_entries > 0:
        present_percentage = round((total_present / total_valid_entries) * 100.0, 1)
        absent_percentage = round((total_absent / total_valid_entries) * 100.0, 1)
    else:
        present_percentage = 0.0
        absent_percentage = 0.0

    # Session-by-session trend and summary items
    session_items: List[SessionStatisticsItem] = []
    for session in sessions:
        sess_p = 0
        sess_a = 0
        sess_unrec = 0

        for student in students:
            val = ws.cell(student.row, session.col_idx).value
            if val is None or str(val).strip() == "":
                sess_unrec += 1
            else:
                norm_val = str(val).strip().upper()
                if norm_val == "P":
                    sess_p += 1
                elif norm_val == "A":
                    sess_a += 1
                else:
                    sess_unrec += 1

        sess_recorded = sess_p + sess_a
        if sess_recorded > 0:
            sess_pct = round((sess_p / sess_recorded) * 100.0, 1)
        else:
            sess_pct = 0.0

        # Format date nicely
        date_str = session.date_normalized or ""
        if date_str and "-" in date_str:
            parts = date_str.split("-")
            if len(parts) == 3:
                date_str = f"{parts[2]}/{parts[1]}/{parts[0]}"
        elif not date_str and "/" in session.header_raw:
            date_str = session.header_raw.split()[0]

        period_str = session.period_normalized or "1"
        session_label = f"{date_str[:5]} P{period_str}" if date_str else f"Col {session.col_letter}"

        session_items.append(SessionStatisticsItem(
            col_idx=session.col_idx,
            col_letter=session.col_letter,
            header_raw=session.header_raw,
            date=date_str,
            period=period_str,
            session_label=session_label,
            present_count=sess_p,
            absent_count=sess_a,
            unrecorded_count=sess_unrec,
            attendance_percentage=sess_pct
        ))

    return SubjectStatisticsResponse(
        file_id=file_id,
        file_name=file_name,
        sheet_name=sheet_name,
        subject_code=subject_code,
        subject_name=subject_name,
        faculty_name=faculty_name,
        class_section=class_section,
        academic_year=academic_year,
        threshold=threshold,
        has_sessions=True,
        total_students=total_students,
        total_sessions=total_sessions,
        average_attendance=avg_attendance,
        average_attendance_raw=avg_attendance_raw,
        total_present=total_present,
        total_absent=total_absent,
        total_unrecorded=total_unrecorded,
        unexpected_values_count=unexpected_values_count,
        below_threshold_count=below_threshold_count,
        present_percentage=present_percentage,
        absent_percentage=absent_percentage,
        distribution_90_100=dist_90_100,
        distribution_80_89=dist_80_89,
        distribution_75_79=dist_75_79,
        distribution_below_75=dist_below_75,
        sessions=session_items
    )

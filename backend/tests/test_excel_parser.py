import os
import openpyxl
import pytest
from app.excel.parser import parse_workbook, extract_students, is_subject_sheet, find_summary_col
from app.excel.session_matcher import parse_session_header, is_duplicate_session, format_session_header

REFERENCE_FILE = "/home/sreenath/Sree/Projects/MarkMe/V Sem B Attendance sheet.xlsx"

def test_workbook_parsing():
    assert os.path.exists(REFERENCE_FILE), "Reference workbook must exist."
    wb = openpyxl.load_workbook(REFERENCE_FILE, data_only=False)
    details = parse_workbook(wb, file_id="test_id", file_name="V Sem B Attendance sheet.xlsx")
    
    assert details.class_name == "V SEM"
    assert details.section == "B"
    assert len(details.subjects) == 7
    
    # Check subject UIT3562
    os_sub = next(s for s in details.subjects if s.sheet_name == "UIT3562")
    assert os_sub.code == "UIT3562"
    assert "Operating Systems" in os_sub.name
    assert os_sub.student_count == 71
    assert len(os_sub.existing_sessions) == 19
    assert os_sub.next_available_col == 25  # Col Y
    assert os_sub.next_available_col_letter == "Y"
    
    wb.close()

def test_student_extraction():
    wb = openpyxl.load_workbook(REFERENCE_FILE, data_only=True)
    ws = wb["UIT3562"]
    students = extract_students(ws)
    
    assert len(students) == 71
    # Check first student
    assert students[0].sno == 1
    assert students[0].suffix == "067"
    assert students[0].name == "Pragalya T"
    assert students[0].register_number == "3122245002067"
    
    # Check test suffixes from doc
    suffixes = {s.suffix: s for s in students}
    assert "067" in suffixes
    assert "080" in suffixes
    assert "114" in suffixes
    assert "129" in suffixes
    
    wb.close()

def test_session_matcher():
    raw = "29/06/26           1st Hour"
    d, p = parse_session_header(raw)
    assert d == "2026-06-29"
    assert p == "1"
    
    assert is_duplicate_session(raw, "29/06/2026", "1") is True
    assert is_duplicate_session(raw, "2026-06-29", "1st Hour") is True
    assert is_duplicate_session(raw, "30/06/2026", "1") is False
    assert is_duplicate_session(raw, "29/06/2026", "2") is False

def test_format_session_header():
    header = format_session_header("10/09/2026", "3")
    assert "10/09/26" in header
    assert "3rd Hour" in header

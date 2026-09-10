import re
import openpyxl
from typing import List, Tuple, Optional, Dict
from app.models.schemas import StudentInfo, SubjectInfo, ExistingSession, WorkbookDetails
from app.excel.session_matcher import parse_session_header

def is_subject_sheet(sheet_name: str, ws: openpyxl.worksheet.worksheet.Worksheet) -> bool:
    """
    Determines if worksheet is an active subject attendance sheet.
    Excludes summary sheets and auxiliary/archive name lists.
    """
    upper = sheet_name.upper()
    if "SUMMARY" in upper or "HGHG" in upper or "ELECTIVE" in upper:
        return False
        
    # Check if header in row 11 has Register Number
    col3_val = ws.cell(11, 3).value
    col4_val = ws.cell(11, 4).value
    if col3_val and "Register Number" in str(col3_val):
        return True
    if col4_val and "Name" in str(col4_val):
        return True
        
    return False

def parse_header_metadata(ws: openpyxl.worksheet.worksheet.Worksheet) -> Dict[str, str]:
    """
    Parses metadata from rows 1 to 9:
    - class_section (e.g., 'V SEM IT B')
    - academic_year (e.g., '2026-2027')
    - sub_code (e.g., 'UIT3562')
    - sub_name (e.g., 'Principles of Operating Systems')
    - faculty_name (e.g., 'Dr. I. Joe Louis Paul')
    """
    meta = {
        "class_section": "",
        "academic_year": "",
        "sub_code": "",
        "sub_name": "",
        "faculty_name": ""
    }
    
    # Row 4: Class & Section : V SEM  IT B
    row4_val = ws.cell(4, 1).value or ""
    if ":" in str(row4_val):
        meta["class_section"] = str(row4_val).split(":", 1)[1].strip()
    else:
        meta["class_section"] = str(row4_val).strip()
        
    # Row 5: Academic Year: 2026-2027
    row5_val = ws.cell(5, 1).value or ""
    if ":" in str(row5_val):
        meta["academic_year"] = str(row5_val).split(":", 1)[1].strip()
    else:
        meta["academic_year"] = str(row5_val).strip()
        
    # Row 7: Sub Code & Sub Name : UIT3562 - Principles of Operating Systems
    row7_val = ws.cell(7, 1).value or ""
    if ":" in str(row7_val):
        sub_raw = str(row7_val).split(":", 1)[1].strip()
        if "-" in sub_raw:
            parts = sub_raw.split("-", 1)
            meta["sub_code"] = parts[0].strip()
            meta["sub_name"] = parts[1].strip()
        else:
            meta["sub_code"] = sub_raw
            meta["sub_name"] = sub_raw
            
    # Row 8: Staff Name : Dr. I. Joe Louis Paul
    row8_val = ws.cell(8, 1).value or ""
    if ":" in str(row8_val):
        meta["faculty_name"] = str(row8_val).split(":", 1)[1].strip()
    else:
        meta["faculty_name"] = str(row8_val).strip()
        
    return meta

def extract_students(ws: openpyxl.worksheet.worksheet.Worksheet) -> List[StudentInfo]:
    """
    Extracts student records from student rows (Row 13 down).
    Stops when student rows end (Row 91 or empty S.No/Register Number).
    """
    students: List[StudentInfo] = []
    
    # Locate header row (usually 11)
    start_row = 13
    
    for r in range(start_row, ws.max_row + 1):
        sno_val = ws.cell(r, 1).value
        reg_val = ws.cell(r, 3).value
        name_val = ws.cell(r, 4).value
        
        # Stop condition: bottom summary row or empty student row
        if reg_val is None and name_val is None:
            break
        if str(sno_val).strip().lower().startswith("total") or str(reg_val).strip().lower().startswith("total"):
            break
            
        digital_id_val = ws.cell(r, 2).value or ""
        email_val = ws.cell(r, 5).value or ""
        
        # Format S.No
        try:
            sno = int(float(sno_val))
        except (ValueError, TypeError):
            sno = len(students) + 1
            
        # Format Digital ID
        if isinstance(digital_id_val, (int, float)):
            digital_id = str(int(digital_id_val))
        else:
            digital_id = str(digital_id_val).strip()
            
        # Format Register Number
        if isinstance(reg_val, (int, float)):
            reg_num = str(int(reg_val))
        else:
            reg_num = str(reg_val).strip()
            
        suffix = reg_num[-3:] if len(reg_num) >= 3 else reg_num.zfill(3)
        name = str(name_val).strip() if name_val is not None else ""
        email = str(email_val).strip() if email_val is not None else ""
        
        students.append(StudentInfo(
            sno=sno,
            digital_id=digital_id,
            register_number=reg_num,
            suffix=suffix,
            name=name,
            email=email,
            row=r
        ))
        
    return students

def find_summary_col(ws: openpyxl.worksheet.worksheet.Worksheet) -> int:
    """
    Finds the summary column index where Row 12 has a formula starting with =COUNTA.
    Defaults to 61 (BI) if not found.
    """
    for c in range(6, ws.max_column + 1):
        val = ws.cell(12, c).value
        if val is not None and str(val).startswith("="):
            return c
    return 61

def extract_existing_sessions(ws: openpyxl.worksheet.worksheet.Worksheet, summary_col: int) -> Tuple[List[ExistingSession], int]:
    """
    Scans columns F (6) to summary_col - 1 for existing sessions.
    Returns:
    - List of ExistingSession
    - next_available_col index
    """
    sessions: List[ExistingSession] = []
    last_filled_col = 5
    
    for c in range(6, summary_col):
        v12 = ws.cell(12, c).value
        if v12 is not None and str(v12).strip() != "":
            raw = str(v12).strip()
            norm_date, norm_period = parse_session_header(raw)
            col_letter = openpyxl.utils.get_column_letter(c)
            sessions.append(ExistingSession(
                col_idx=c,
                col_letter=col_letter,
                header_raw=raw,
                date_normalized=norm_date,
                period_normalized=norm_period
            ))
            last_filled_col = c
            
    next_col = last_filled_col + 1
    if next_col >= summary_col:
        # No empty slot before summary column
        next_col = summary_col
        
    return sessions, next_col

def parse_workbook(wb: openpyxl.Workbook, file_id: str = "local", file_name: str = "Attendance.xlsx") -> WorkbookDetails:
    """
    Parses complete openpyxl workbook and returns WorkbookDetails schema.
    """
    subjects: List[SubjectInfo] = []
    class_name = ""
    section = ""
    academic_year = ""
    
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        if not is_subject_sheet(sheet_name, ws):
            continue
            
        meta = parse_header_metadata(ws)
        if not class_name and meta["class_section"]:
            # Example: 'V SEM  IT B' -> class: 'V SEM', section: 'B'
            parts = meta["class_section"].split()
            if len(parts) >= 2:
                section = parts[-1]
                if len(parts) >= 3 and parts[-2].upper() in ["IT", "CSE", "ECE", "EEE", "MECH", "CIVIL", "BME"]:
                    class_name = " ".join(parts[:-2])
                else:
                    class_name = " ".join(parts[:-1])
            else:
                class_name = meta["class_section"]
                section = ""
                
        if not academic_year and meta["academic_year"]:
            academic_year = meta["academic_year"]
            
        students = extract_students(ws)
        summary_col = find_summary_col(ws)
        sessions, next_col = extract_existing_sessions(ws, summary_col)
        
        subjects.append(SubjectInfo(
            code=meta["sub_code"] or sheet_name,
            name=meta["sub_name"] or sheet_name,
            sheet_name=sheet_name,
            faculty_name=meta["faculty_name"],
            class_section=meta["class_section"],
            academic_year=meta["academic_year"],
            student_count=len(students),
            existing_sessions=sessions,
            next_available_col=next_col,
            next_available_col_letter=openpyxl.utils.get_column_letter(next_col)
        ))
        
    return WorkbookDetails(
        file_id=file_id,
        file_name=file_name,
        class_name=class_name or "V SEM",
        section=section or "B",
        academic_year=academic_year or "2026-2027",
        subjects=subjects
    )

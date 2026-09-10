import openpyxl
import pytest
from app.excel.parser import extract_students
from app.attendance.validator import parse_and_validate_suffixes, SuffixValidationError
from app.attendance.preview import generate_attendance_preview

REFERENCE_FILE = "/home/sreenath/Sree/Projects/MarkMe/V Sem B Attendance sheet.xlsx"

@pytest.fixture
def students():
    wb = openpyxl.load_workbook(REFERENCE_FILE, data_only=True)
    ws = wb["UIT3562"]
    res = extract_students(ws)
    wb.close()
    return res

def test_valid_suffixes(students):
    input_str = "067, 080, 114, 129"
    result = parse_and_validate_suffixes(input_str, students)
    assert result == ["067", "080", "114", "129"]

def test_space_and_mixed_delimiters(students):
    input_str = "067 080\n114,129"
    result = parse_and_validate_suffixes(input_str, students)
    assert result == ["067", "080", "114", "129"]

def test_duplicate_suffix_error(students):
    with pytest.raises(SuffixValidationError) as exc:
        parse_and_validate_suffixes("067, 080, 080", students)
    assert any("Duplicate" in err for err in exc.value.errors)

def test_invalid_suffix_characters(students):
    with pytest.raises(SuffixValidationError) as exc:
        parse_and_validate_suffixes("067, abc, 080", students)
    assert any("not a 3-digit" in err for err in exc.value.errors)

def test_invalid_suffix_length(students):
    with pytest.raises(SuffixValidationError) as exc:
        parse_and_validate_suffixes("067, 1144, 9999", students)
    assert len(exc.value.errors) == 2

def test_two_digit_and_three_digit_suffixes(students):
    # Both 2-digit (67, 80) and 3-digit (067, 080) are accepted and normalized to 3 digits
    res1 = parse_and_validate_suffixes("67, 80, 114, 129", students)
    assert res1 == ["067", "080", "114", "129"]

    res2 = parse_and_validate_suffixes("067, 80, 114, 129", students)
    assert res2 == ["067", "080", "114", "129"]

    # 67 and 067 together are flagged as duplicate because they refer to the same student
    with pytest.raises(SuffixValidationError) as exc:
        parse_and_validate_suffixes("067, 67", students)
    assert any("Duplicate" in err for err in exc.value.errors)

def test_nonexistent_student_suffix(students):
    with pytest.raises(SuffixValidationError) as exc:
        parse_and_validate_suffixes("067, 999", students)
    assert any("does not match any student" in err for err in exc.value.errors)

def test_preview_generation():
    wb = openpyxl.load_workbook(REFERENCE_FILE, data_only=False)
    ws = wb["UIT3562"]
    
    # Test valid preview
    res = generate_attendance_preview(
        ws=ws,
        sheet_name="UIT3562",
        date="10/09/2026",
        period="3",
        absent_input="067, 080, 114, 129"
    )
    
    assert res.total_students == 71
    assert res.present_count == 67
    assert res.absent_count == 4
    assert res.duplicate_warning is False
    
    # Check individual students
    student_map = {s.suffix: s.status for s in res.students}
    assert student_map["067"] == "ABSENT"
    assert student_map["080"] == "ABSENT"
    assert student_map["114"] == "ABSENT"
    assert student_map["129"] == "ABSENT"
    assert student_map["068"] == "PRESENT"
    
    # Test duplicate warning detection on existing session
    res_dup = generate_attendance_preview(
        ws=ws,
        sheet_name="UIT3562",
        date="29/06/2026",
        period="1",
        absent_input="067"
    )
    assert res_dup.duplicate_warning is True
    assert res_dup.existing_session_col == 6  # Col F
    
    # Test PRESENT mode (entering presentees instead of absentees)
    res_present = generate_attendance_preview(
        ws=ws,
        sheet_name="UIT3562",
        date="11/09/2026",
        period="4",
        student_input="067, 080",
        entry_mode="PRESENT"
    )
    assert res_present.total_students == 71
    assert res_present.present_count == 2
    assert res_present.absent_count == 69
    assert res_present.entry_mode == "PRESENT"
    p_map = {s.suffix: s.status for s in res_present.students}
    assert p_map["067"] == "PRESENT"
    assert p_map["080"] == "PRESENT"
    assert p_map["068"] == "ABSENT"
    assert "068" in res_present.absent_suffixes
    assert "067" not in res_present.absent_suffixes
    assert "080" not in res_present.absent_suffixes
    assert len(res_present.absent_suffixes) == 69
    
    wb.close()

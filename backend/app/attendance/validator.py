import re
from typing import List, Set, Tuple, Dict, Optional
from app.models.schemas import StudentInfo

class SuffixValidationError(Exception):
    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.message = message
        self.errors = errors

def parse_and_validate_suffixes(
    input_str: str,
    valid_students: List[StudentInfo],
    mode_label: str = "absent"
) -> List[str]:
    """
    Parses comma-, space-, or newline-separated input string.
    Validates:
    1. Each entry is exactly 3 numeric digits.
    2. No duplicate entries in input.
    3. Each suffix exists in the provided student roster.
    
    Returns clean list of 3-digit strings, or raises SuffixValidationError.
    """
    if not input_str or not input_str.strip():
        return []
        
    # Split by commas, whitespace, or newlines
    raw_tokens = re.split(r"[, \t\r\n]+", input_str.strip())
    tokens = [t.strip() for t in raw_tokens if t.strip()]
    
    errors: List[str] = []
    seen: Set[str] = set()
    cleaned_suffixes: List[str] = []
    
    # Map valid suffixes to students
    valid_suffix_map: Dict[str, StudentInfo] = {
        s.suffix: s for s in valid_students
    }
    
    for token in tokens:
        # Check if exactly 3 numeric digits
        if not re.match(r"^\d{3}$", token):
            errors.append(f"Invalid format: '{token}' is not a 3-digit number.")
            continue
            
        # Check duplicates
        if token in seen:
            errors.append(f"Duplicate suffix entered: '{token}'.")
            continue
        seen.add(token)
        
        # Check existence in roster
        if token not in valid_suffix_map:
            errors.append(f"Student not found: Suffix '{token}' does not match any student in this class.")
            continue
            
        cleaned_suffixes.append(token)
        
    if errors:
        raise SuffixValidationError(f"Validation failed for {mode_label} students list.", errors)
        
    return cleaned_suffixes

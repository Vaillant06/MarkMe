import re
from datetime import datetime
from typing import Optional, Tuple

ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8
}

def normalize_date(date_str: str) -> Optional[str]:
    """
    Normalizes diverse date representations (DD/MM/YYYY, DD/MM/YY, DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD)
    into standard ISO 'YYYY-MM-DD' and returns it.
    If year is omitted (e.g. '20/07'), assume default current academic year (2026).
    """
    if not date_str:
        return None
    
    cleaned = date_str.strip()
    
    # Try ISO YYYY-MM-DD
    iso_match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", cleaned)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        return f"{y:04d}-{m:02d}-{d:02d}"
        
    # Match DD/MM/YYYY or DD/MM/YY or DD.MM.YYYY or DD.MM.YY or DD-MM-YYYY
    dm_match = re.search(r"\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b", cleaned)
    if dm_match:
        d = int(dm_match.group(1))
        m = int(dm_match.group(2))
        y_raw = dm_match.group(3)
        if y_raw:
            y = int(y_raw)
            if y < 100:
                y += 2000
        else:
            y = 2026  # default year from academic year context
        return f"{y:04d}-{m:02d}-{d:02d}"
        
    return None

def normalize_period(period_str: str) -> Optional[str]:
    """
    Extracts canonical period number (e.g. '1', '2', '3') from strings like:
    '1st Hour', '3rd Hour', 'IIhr', 'Ihr & II hr', '3'
    """
    if not period_str:
        return None
        
    cleaned = period_str.strip()
    
    # Check for simple digit
    digit_match = re.search(r"\b([1-8])(?:st|nd|rd|th)?\b", cleaned, re.IGNORECASE)
    if digit_match:
        return str(digit_match.group(1))
        
    # Check for Roman numerals like 'IIhr', 'Ihr'
    roman_match = re.search(r"\b(VIII|VII|VI|V|IV|III|II|I)\s*(?:hr|hour)?\b", cleaned, re.IGNORECASE)
    if roman_match:
        roman = roman_match.group(1).upper()
        if roman in ROMAN_TO_INT:
            return str(ROMAN_TO_INT[roman])
            
    return None

def parse_session_header(header_raw: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts normalized (date, period) from raw session header text in Row 12.
    Example: '29/06/26           1st Hour' -> ('2026-06-29', '1')
    """
    if not header_raw:
        return None, None
        
    norm_date = normalize_date(header_raw)
    norm_period = normalize_period(header_raw)
    
    return norm_date, norm_period

def is_duplicate_session(existing_raw: str, target_date: str, target_period: str) -> bool:
    """
    Checks if existing_raw session cell represents the same date and period.
    target_date can be '10/09/2026' or '2026-09-10'.
    target_period can be '3' or '3rd Hour'.
    """
    ex_date, ex_period = parse_session_header(existing_raw)
    norm_target_date = normalize_date(target_date)
    norm_target_period = normalize_period(target_period)
    
    if not norm_target_date:
        return False
        
    if ex_date == norm_target_date:
        # If both specify period, both must match
        if ex_period and norm_target_period:
            return ex_period == norm_target_period
        # If existing didn't record period, match on date
        return True
        
    return False

def format_session_header(date_str: str, period_str: str) -> str:
    """
    Generates standard session header for Row 12.
    Format matching UIT3562 style:
    '10/09/26           3rd Hour'
    """
    norm_date = normalize_date(date_str)
    if norm_date:
        dt = datetime.strptime(norm_date, "%Y-%m-%d")
        d_str = dt.strftime("%d/%m/%y")
    else:
        d_str = date_str
        
    norm_p = normalize_period(period_str) or period_str.strip()
    
    # Ordinal suffix
    ordinal_map = {"1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th", "6": "6th", "7": "7th", "8": "8th"}
    ord_p = ordinal_map.get(norm_p, f"{norm_p}th")
    
    return f"{d_str}           {ord_p} Hour"

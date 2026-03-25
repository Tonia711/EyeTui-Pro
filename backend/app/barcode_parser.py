"""
Barcode parsing utilities for extracting model, power, and sn from barcode data.
"""
from typing import Dict, Optional, Any

# Model to Company mapping - used to auto-detect company from model number
MODEL_TO_COMPANY = {
    # Alcon models
    'CNA0T3': 'Alcon',  # Clareon TORIC
    'CNA0V3': 'Alcon',  # Clareon TORIC variant
    'CNA0T4': 'Alcon',  # Clareon TORIC
    'CNA0T5': 'Alcon',  # Clareon TORIC
    'AN6VMT3': 'Alcon',
    'SN6CWS': 'Alcon',
    'SN6AT': 'Alcon',
    'SA60AT': 'Alcon',
    'MA60MA': 'Alcon',
    'CLAREON': 'Alcon',
    'ACRYSOF': 'Alcon',
    
    # Johnson & Johnson (AMO)
    'TECNIS': 'AMO',
    'ZCB00': 'AMO',
    'DCB00': 'AMO',
    'DIB00': 'AMO',
    'DENOV': 'AMO',
    'ZXT': 'AMO',
    
    # ZEISS
    'CT ASPHINA': 'ZEISS',
    'CT LUCIA': 'ZEISS',
    'AT LISA': 'ZEISS',
}

def parse_barcode(raw_data: str) -> Dict[str, Optional[str]]:
    """
    Parse barcode data to extract model, power (sphere), and sn (serial number).
    
    For lens labels, barcodes may contain:
    - Model: Brand/model like "YGOOD", "TECNIS", "DCB", "DENOV"
    - Power: Sphere/power like "+22.50D", "D+22", "+23.5D"
    - SN: Serial numbers (long numeric strings)
    - Multiple barcodes on same label with different data
    
    Returns:
        dict with keys: model, power, sn, company, original
    """
    import re
    
    result = {"model": None, "power": None, "sn": None, "company": None, "original": raw_data}
    
    if not raw_data:
        return result
    
    print(f"[DEBUG] Parsing barcode: {raw_data}")
    
    # Try GS1 format parsing first (both with and without parentheses)
    # GS1 barcodes typically start with AI codes like 01, 17, 21, 10
    if raw_data.startswith("(") or "]" in raw_data or (raw_data.startswith("01") and len(raw_data) > 16):
        gs1_result = _parse_gs1_barcode(raw_data)
        if gs1_result["sn"]:
            result.update(gs1_result)
            # Auto-detect company from model if available
            if result["model"] and result["model"] in MODEL_TO_COMPANY:
                result["company"] = MODEL_TO_COMPANY[result["model"]]
            print(f"[DEBUG] GS1 parsing result: {result}")
            return result
    
    # Check if this is a simple serial-number-only barcode (like Alcon from QR)
    # Pattern: mostly numeric, 11 digits (like 50483779011), possibly with prefix/suffix
    # Example: 524537504837790111027 contains SN 50483779011
    # Note: For Alcon QR codes, SN is usually embedded in the middle, not at start or end
    # Also handle pure 11-digit serial numbers (like 24116011069, 24116011078)
    if raw_data.isdigit():
        # If it's exactly 11 digits, use it directly as SN
        if len(raw_data) == 11:
            result["sn"] = raw_data
            print(f"[DEBUG] Extracted 11-digit SN from pure numeric barcode: {result['sn']}")
            return result
        # If it's 10 digits, also use it directly
        elif len(raw_data) == 10:
            result["sn"] = raw_data
            print(f"[DEBUG] Extracted 10-digit SN from pure numeric barcode: {result['sn']}")
            return result
        # For longer numeric strings (15-25 digits), extract 11-digit SN from middle
        elif 15 <= len(raw_data) <= 25:
            # Find all possible 11-digit sequences (including overlapping ones)
            # For example: 524537504837790111027
            # - Position 0-10: 52453750483 (likely prefix)
            # - Position 5-15: 50483779011 (this is the actual SN)
            # - Position 10-20: 790111027 (too short, only 10 digits)
            sn_11_candidates = []
            for i in range(len(raw_data) - 10):
                candidate = raw_data[i:i+11]
                # Only consider if it starts with non-zero (more likely to be SN)
                if candidate[0] != '0':
                    sn_11_candidates.append((candidate, i))
            
            if sn_11_candidates:
                # For Alcon QR codes, SN is usually in the middle-third of the string
                # Exclude first 30% and last 20% of positions
                if len(sn_11_candidates) > 1:
                    exclude_start = int(len(raw_data) * 0.3)
                    exclude_end = int(len(raw_data) * 0.8)
                    # Filter candidates in the middle range
                    middle_candidates = [
                        c for c in sn_11_candidates 
                        if exclude_start <= c[1] < exclude_end
                    ]
                    
                    if middle_candidates:
                        # If we have middle candidates, prefer the one closest to center
                        middle_pos = len(raw_data) // 2
                        best_candidate = min(middle_candidates, key=lambda x: abs(x[1] + 5 - middle_pos))
                        result["sn"] = best_candidate[0]
                        print(f"[DEBUG] Extracted 11-digit SN from QR code (chose from middle range, position {best_candidate[1]}): {result['sn']}")
                    else:
                        # Fallback: use the one closest to middle of all candidates
                        middle_pos = len(raw_data) // 2
                        best_candidate = min(sn_11_candidates, key=lambda x: abs(x[1] + 5 - middle_pos))
                        result["sn"] = best_candidate[0]
                        print(f"[DEBUG] Extracted 11-digit SN from QR code (fallback, position {best_candidate[1]}): {result['sn']}")
                else:
                    result["sn"] = sn_11_candidates[0][0]
                    print(f"[DEBUG] Extracted 11-digit SN from simple barcode: {result['sn']}")
                # Model and power need to be read from label (OCR or manual)
                return result
    
    # Special handling for long numeric strings that contain embedded product info
    # Pattern: starts with digits, contains model code (e.g., DCB00), ends with digits
    # Example: 010505047463615620121728061611250616212082052525240DCB0000235
    if len(raw_data) > 30 and any(model_prefix in raw_data for model_prefix in ['DCB', 'DIB', 'DEN', 'DIU', 'TECNIS', 'ZCB']):
        # Find model code in the string
        model_match = re.search(r'(DCB00|DIB00|DEN00V|DENOOV|DIU150|DIU100|TECNIS|ZCB0)', raw_data)
        if model_match:
            result["model"] = model_match.group(1)
            print(f"[DEBUG] Found embedded model: {result['model']}")
            
            # Extract the last 3-4 digits after model as power encoding
            after_model = raw_data[model_match.end():]
            power_match = re.match(r'0*(\d{3,4})', after_model)
            if power_match:
                digits = power_match.group(1).lstrip("0") or power_match.group(1)
                if len(digits) >= 3:
                    value = digits[:-1] + "." + digits[-1]
                    result["power"] = f"+{value}D"
                    print(f"[DEBUG] Derived power from embedded digits: {result['power']}")
            
            # For SN, look for 10-digit sequence BEFORE the model code
            before_model = raw_data[:model_match.start()]
            sn_matches = re.findall(r'([1-9]\d{9})', before_model)
            if sn_matches:
                # Take the last match (closest to model)
                result["sn"] = sn_matches[-1]
                print(f"[DEBUG] Extracted SN from before model: {result['sn']}")
            
            if all([result["model"], result["power"], result["sn"]]):
                print(f"[DEBUG] Successfully parsed embedded format: {result}")
                return result
    
    # Helper to derive power from a numeric block (e.g., 00235 -> +23.5D)
    def _power_from_numeric_prefix(num_str: str) -> Optional[str]:
        import re
        if not num_str:
            return None
        match = re.match(r'0*(\d{3,4})', num_str)
        if not match:
            return None
        digits = match.group(1)
        digits_clean = digits.lstrip("0") or digits
        if len(digits_clean) >= 3:
            first_three = digits_clean[:3]
            value = first_three[:-1] + "." + first_three[-1]
            return f"+{value}D"
        return None

    # Check if data looks like lens label text patterns
    
    # Extract power first (power format with D and +/- sign)
    # Patterns: D+22, +22.50D, -3.25D, D-5, +23.5D
    # IMPORTANT: Normalize to +XX.XXD format (not D+XX.XX)
    power_match = re.search(r'([+-]?\d+\.?\d*D)|D[+-]?\d+\.?\d*', raw_data, re.IGNORECASE)
    if power_match:
        power_str = power_match.group().upper()
        # Normalize: if format is D+22.50, convert to +22.50D
        if power_str.startswith('D') and ('+' in power_str or '-' in power_str):
            # Extract the sign and number
            sign_num_match = re.search(r'([+-])(\d+\.?\d*)', power_str)
            if sign_num_match:
                sign = sign_num_match.group(1)
                num = sign_num_match.group(2)
                power_str = f"{sign}{num}D"
        result["power"] = power_str
        print(f"[DEBUG] Extracted power: {result['power']}")
    
    # Extract model (uppercase letters at the beginning or standalone)
    # Look for patterns like "DCB00", "TECNIS", "DEN00V" etc
    # Model is typically 3-6 characters: letters optionally followed by digits and optionally ending with a letter
    # Examples: DCB00, TECNIS, DENOV, ZCB0, DEN00V, DIB00
    # Try longer patterns first (up to 6 chars) to catch models like "DEN00V"
    # IMPORTANT: Allow models that end with a letter after digits (e.g., "DEN00V", "DIB00")
    # Pattern: letters + optional digits (0-2) + optional trailing letter
    # Try patterns in order: DEN00V, DIB00, DEN0, etc.
    model_patterns = [
        r'^(DEN00V|DENOOV|DIB00|DCB00|ZCB00|DIU150|DIU100|YG00D|YGOOD)',  # Full model names with specific J&J models
        r'^([A-Z]{2,}[0-9]{0,3}[A-Z]?)',  # General pattern: letters + up to 3 digits + optional letter
    ]
    for pattern in model_patterns:
        model_match = re.match(pattern, raw_data)
        if model_match:
            candidate = model_match.group(1)
            # Allow models up to 6 characters (e.g., DEN00V, DIB00)
            if 3 <= len(candidate) <= 6:
                result["model"] = candidate
                # Normalize common OCR/barcode errors: O->0, l->1, S->5
                result["model"] = result["model"].replace('O', '0').replace('l', '1').replace('S', '5')
                print(f"[DEBUG] Extracted model: {result['model']}")
                break
    
    # Extract SN (look for 10-digit sequence, which is common for lens serial numbers)
    # Prefer sequences that don't start with 0 (more likely to be actual serial numbers)
    remaining: Optional[str] = None
    if result["model"]:
        # Remove the model prefix and search in the remaining part
        remaining = raw_data[len(result["model"]):]
        print(f"[DEBUG] Remaining after model: {remaining}")

        # If power still missing, try derive from numeric prefix (e.g., 00235 -> +23.5D)
        # Also handle patterns like "VI125" where "125" means "+12.5D"
        power_extraction_method = None  # Track how power was extracted
        power_encoding_end_pos = 0  # Track where power encoding ends in remaining string
        if not result["power"]:
            # First try the standard numeric prefix method
            power_candidate = _power_from_numeric_prefix(remaining)
            if power_candidate:
                result["power"] = power_candidate
                power_extraction_method = "numeric_prefix"
                # Find the numeric prefix pattern (e.g., "00235", "0235")
                # Match exactly: 0* followed by 3 digits (power is always 3 digits: 125, 235, etc.)
                # The _power_from_numeric_prefix function extracts 3 digits, so we match the same
                power_match = re.match(r'(0*\d{3})', remaining)
                if power_match:
                    power_encoding_end_pos = power_match.end()
                    print(f"[DEBUG] Derived power from numeric prefix: {result['power']}, encoding ends at position {power_encoding_end_pos}")
                else:
                    # Fallback: try 4 digits if 3 doesn't match
                    power_match = re.match(r'(0*\d{4})', remaining)
                    if power_match:
                        power_encoding_end_pos = power_match.end()
                        print(f"[DEBUG] Derived power from numeric prefix (4 digits): {result['power']}, encoding ends at position {power_encoding_end_pos}")
            else:
                # Try pattern like "VI125" or "I125" or "I021" where digits encode power
                # Look for letter(s) followed by exactly 3 digits
                # Pattern: [A-Z]{0,2} followed by exactly 3 digits
                # We want to match "I125" even if followed by more digits (like "I1252261...")
                # So we match 3 digits and stop, not requiring that next char is non-digit
                # Special handling: "I021" should be "215" -> "+21.5D" (not "021" -> "+02.1D")
                power_encoded_match = re.search(r'[A-Z]{0,2}(\d{3})', remaining)
                if power_encoded_match:
                    digits = power_encoded_match.group(1)
                    # Handle power encoding: 3 digits represent XX.X format
                    # "125" -> "12.5", "235" -> "23.5", "195" -> "19.5"
                    # Special case: "021" -> "21.5" (leading 0 means skip first digit, use last 2 + 5)
                    # "021" = 0 (skip) + 2 (tens) + 1 (ones) + 5 (decimal) = 21.5
                    # "019" = 0 (skip) + 1 (tens) + 9 (ones) + 5 (decimal) = 19.5
                    if digits.startswith('0') and len(digits) == 3:
                        # Leading zero: use digits[1] and digits[2], then add 5 for decimal
                        # "021" -> "2" + "1" + "5" -> "21.5"
                        # "019" -> "1" + "9" + "5" -> "19.5"
                        value = digits[1] + digits[2] + ".5"
                    else:
                        # Normal case: "125" -> "12.5", "235" -> "23.5"
                        value = digits[0] + digits[1] + "." + digits[2]
                    result["power"] = f"+{value}D"
                    power_extraction_method = "letter_digits"
                    power_encoding_end_pos = power_encoded_match.end()
                    print(f"[DEBUG] Derived power from encoded pattern (3 digits): {result['power']}, encoding ends at position {power_encoding_end_pos}")
        
        # Look for 10-digit sequences that don't start with 0
        # Use non-overlapping matches to avoid selecting overlapping sequences
        # For "I12522618125230628", we want "2261812523" not "2618125230"
        # For "I23523801425220528", we want "2380142522" not "2352380142"
        
        # First, determine where power encoding ends
        power_end_pos = power_encoding_end_pos  # Use the position we tracked during extraction
        if result["power"] and power_end_pos == 0:
            # If we didn't track it during extraction, try to find it now
            # Power can be encoded in two ways:
            # 1. [A-Z]{0,2} followed by 3 digits (e.g., "I125", "VI235")
            # 2. 0* followed by 3-4 digits (e.g., "00235", "0235")
            # Try numeric prefix first (more common for patterns like "00235")
            # Match exactly 3 digits (power is always 3 digits: 125, 235, etc.)
            power_match = re.match(r'0*\d{3}', remaining)
            if power_match:
                digits = power_match.group(0).lstrip("0")
                if len(digits) >= 3:
                    power_end_pos = power_match.end()
                    print(f"[DEBUG] Power encoding (numeric prefix, fallback) ends at position {power_end_pos} in remaining string")
            else:
                # Try 4 digits as fallback
                power_match = re.match(r'0*\d{4}', remaining)
                if power_match:
                    digits = power_match.group(0).lstrip("0")
                    if len(digits) >= 3:
                        power_end_pos = power_match.end()
                        print(f"[DEBUG] Power encoding (numeric prefix 4 digits, fallback) ends at position {power_end_pos} in remaining string")
                else:
                    # Try letter+digits pattern
                    power_match = re.search(r'[A-Z]{0,2}\d{3}', remaining)
                    if power_match:
                        power_end_pos = power_match.end()
                        print(f"[DEBUG] Power encoding (letter+digits) ends at position {power_end_pos} in remaining string")
        
        non_zero_matches = []
        # Find all non-overlapping 10-11 digit sequences (support both 10 and 11 digit SNs)
        # Try 11 digits first (e.g., 24116011069, 24116011078)
        pattern_11 = r'([1-9]\d{10})'
        for match in re.finditer(pattern_11, remaining):
            start_pos = match.start()
            # Skip matches that start before or overlap with power encoding
            if start_pos < power_end_pos:
                print(f"[DEBUG] Skipping 11-digit SN match at position {start_pos} (before power encoding end at {power_end_pos})")
                continue
            
            # Check if this match overlaps with any previous match
            overlaps = False
            for prev_match, prev_pos in non_zero_matches:
                # Check if current match overlaps with previous
                if not (start_pos >= prev_pos + len(prev_match) or start_pos + 11 <= prev_pos):
                    overlaps = True
                    break
            if not overlaps:
                non_zero_matches.append((match.group(1), start_pos))
        
        # If no 11-digit matches found, try 10-digit sequences
        if not non_zero_matches:
            # Use lookahead pattern to find all overlapping matches
            # This is important for cases like "526816225120328" where both "5268162251" and "2681622512" are valid candidates
            pattern = r'(?=([1-9]\d{9}))'
            for match in re.finditer(pattern, remaining):
                start_pos = match.start()
                sn_candidate = match.group(1)
                # Skip matches that start before or overlap with power encoding
                if start_pos < power_end_pos:
                    print(f"[DEBUG] Skipping SN match at position {start_pos} (before power encoding end at {power_end_pos})")
                    continue
                
                # Add all matches (including overlapping ones) - we'll filter later
                non_zero_matches.append((sn_candidate, start_pos))
        
        if non_zero_matches:
            # If multiple matches, prefer the one that starts after power encoding
            if len(non_zero_matches) > 1:
                # Sort by position
                non_zero_matches.sort(key=lambda x: x[1])
                
                # Prefer matches that start after power encoding
                # If we know power encoding position, use it; otherwise use position >= 4
                min_pos = max(power_end_pos, 4) if power_end_pos > 0 else 4
                valid_matches = [(m, p) for m, p in non_zero_matches if p >= min_pos]
                if valid_matches:
                    # If we have multiple valid matches, prefer the one that doesn't start with "5"
                    # This handles cases like "526816225120328" where "5268162251" is wrong but "2681622512" is correct
                    # The "5" at the start might be a date or other prefix
                    # Also prefer matches that are not at the very start (position 0 or 1) after power encoding
                    preferred_matches = [(m, p) for m, p in valid_matches if not m.startswith('5')]
                    if preferred_matches:
                        # Use the first non-5 match
                        result["sn"] = preferred_matches[0][0]
                        print(f"[DEBUG] Selected SN at position {preferred_matches[0][1]} (preferred non-5 match, after power encoding at {power_end_pos}): {result['sn']}")
                    else:
                        # All matches start with 5, try to find one that's not at position 0 or 1
                        # This handles cases where the first character after power is a prefix
                        non_first_matches = [(m, p) for m, p in valid_matches if p > power_end_pos + 1]
                        if non_first_matches:
                            result["sn"] = non_first_matches[0][0]
                            print(f"[DEBUG] Selected SN at position {non_first_matches[0][1]} (skipped first position, after power encoding at {power_end_pos}): {result['sn']}")
                        else:
                            # All matches start with 5 and are at first positions, use the first one
                            result["sn"] = valid_matches[0][0]
                            print(f"[DEBUG] Selected SN at position {valid_matches[0][1]} (all matches start with 5, after power encoding at {power_end_pos}): {result['sn']}")
                else:
                    # Fallback: find first match that doesn't overlap with power
                    for match, pos in non_zero_matches:
                        if pos >= power_end_pos:
                            result["sn"] = match
                            print(f"[DEBUG] Selected SN at position {pos} (fallback, after power at {power_end_pos}): {result['sn']}")
                            break
                    else:
                        # Last resort: take first match
                        result["sn"] = non_zero_matches[0][0]
                        print(f"[DEBUG] Selected first SN (last resort): {result['sn']}")
            else:
                # Only one match - use it if it's after power encoding
                if power_end_pos > 0 and non_zero_matches[0][1] < power_end_pos:
                    print(f"[DEBUG] Only match at position {non_zero_matches[0][1]} is before power encoding at {power_end_pos}, but using it anyway")
                result["sn"] = non_zero_matches[0][0]
            
            print(f"[DEBUG] Extracted SN (10 digits, non-zero): {result['sn']}")
        else:
            # Fallback: take any 10-digit sequence, but prefer ones after power encoding
            ten_digit_matches = []
            for match in re.finditer(r'(?=(\d{10}))', remaining):
                start_pos = match.start()
                sn_candidate = match.group(1)
                # Skip if starts before power encoding
                if power_end_pos > 0 and start_pos < power_end_pos:
                    print(f"[DEBUG] Skipping fallback SN match at position {start_pos} (before power encoding end at {power_end_pos})")
                    continue
                ten_digit_matches.append((sn_candidate, start_pos))
            
            if ten_digit_matches:
                # Prefer matches after power encoding
                if power_end_pos > 0:
                    valid_matches = [(sn, pos) for sn, pos in ten_digit_matches if pos >= power_end_pos]
                    if valid_matches:
                        result["sn"] = valid_matches[0][0]
                        print(f"[DEBUG] Extracted SN (10 digits, after power at {power_end_pos}): {result['sn']}")
                    else:
                        result["sn"] = ten_digit_matches[0][0]
                        print(f"[DEBUG] Extracted SN (10 digits, fallback): {result['sn']}")
                else:
                    result["sn"] = ten_digit_matches[0][0]
                    print(f"[DEBUG] Extracted SN (10 digits): {result['sn']}")
    
    # Fallback: if no model-based extraction worked, search the whole string
    if not result["sn"]:
        # Prefer 11-digit sequences first (non-zero starting)
        non_zero_matches_11 = re.findall(r'(?=([1-9]\d{10}))', raw_data)
        if non_zero_matches_11:
            result["sn"] = non_zero_matches_11[0]
            print(f"[DEBUG] Extracted SN (11 digits, non-zero, fallback): {result['sn']}")
        else:
            # Then try 10-digit sequences (non-zero starting)
            non_zero_matches_10 = re.findall(r'(?=([1-9]\d{9}))', raw_data)
            if non_zero_matches_10:
                result["sn"] = non_zero_matches_10[0]
                print(f"[DEBUG] Extracted SN (10 digits, non-zero, fallback): {result['sn']}")
            else:
                # Try 11 digits with leading zero allowed
                eleven_digit_matches = re.findall(r'(?=(\d{11}))', raw_data)
                if eleven_digit_matches:
                    result["sn"] = eleven_digit_matches[0]
                    print(f"[DEBUG] Extracted SN (11 digits, fallback): {result['sn']}")
                else:
                    ten_digit_matches = re.findall(r'(?=(\d{10}))', raw_data)
                    if ten_digit_matches:
                        result["sn"] = ten_digit_matches[0]
                        print(f"[DEBUG] Extracted SN (10 digits, fallback): {result['sn']}")
                    else:
                        # Last resort: use longest numeric sequence
                        numeric_matches = re.findall(r'\d{8,}', raw_data)
                        if numeric_matches:
                            result["sn"] = max(numeric_matches, key=len)
                            print(f"[DEBUG] Extracted SN (fallback, longest): {result['sn']}")
    
    # If still no patterns matched and raw data is numeric, treat it as SN
    if not any([result["model"], result["power"], result["sn"]]):
        if raw_data.isdigit() and len(raw_data) >= 10:
            result["sn"] = raw_data
            print(f"[DEBUG] Treated raw data as SN: {raw_data}")
        else:
            result["sn"] = raw_data
    
    # Auto-detect company from model if available
    if result["model"] and result["model"] in MODEL_TO_COMPANY:
        result["company"] = MODEL_TO_COMPANY[result["model"]]
        print(f"[DEBUG] Auto-detected company: {result['company']}")
    
    print(f"[DEBUG] Final result: {result}")
    return result


def _parse_gs1_barcode(data: str) -> Dict[str, Optional[str]]:
    """
    Parse GS1 format barcode with Application Identifiers (AI).
    
    Supports both formats:
    - Parentheses format: (01)12345678901234(17)271031(21)50483779011
    - Compact format: 01123456789012341727103121504837790111
    
    Common AIs:
    - (01) GTIN (14 digits) - Product identifier, NOT model
    - (10) Batch/Lot (variable length) - Could contain model info
    - (17) Expiry Date (6 digits: YYMMDD) - NOT power
    - (21) Serial Number (variable length) - This is what we need
    
    Note: For brands like Alcon/Johnson & Johnson, GS1 barcodes typically only contain SN.
    Model and power information are usually printed elsewhere on the label (e.g., "DCB00", "+23.5D").
    """
    result = {"model": None, "power": None, "sn": None}
    
    # Remove FNC1 character if present (can appear as ]C1, ]d2, or \x1D)
    data = data.replace("]C1", "").replace("]d2", "").replace("\x1D", "")
    
    import re
    
    # Try parentheses format first
    ai_pattern = r'\((\d+)\)([^(]+)'
    matches = re.findall(ai_pattern, data)
    
    if matches:
        # Parentheses format found
        for ai_code, value in matches:
            value = value.strip()
            if ai_code == "21":  # Serial number - this is what we need
                result["sn"] = value
            # Note: We don't use GTIN (01) as model or expiry (17) as power
            # because for GS1 format, these are product identifiers, not lens specifications
            # Model and power should be read from label text (OCR) or entered manually
    else:
        # Try compact format without parentheses
        # Example: 0108719378245372172710312150483779011
        # Pattern: 01(14 digits)17(6 digits)21(variable)
        pos = 0
        
        # First, try to find the serial number AI (21) by looking for patterns
        # Medical device serial numbers can be:
        # - 10 digits (pure numeric): 50483779011
        # - 12 alphanumeric (ZEISS format): 3S2401680236, 6S2501800020
        # Find ALL matches and choose the one closest to the end (SN is usually last)
        # Try alphanumeric first (12 chars: 1 digit + 1 letter + 10 digits)
        sn_matches = list(re.finditer(r'21([0-9][A-Z][0-9]{10})', data))
        if not sn_matches:
            # Fallback to pure numeric (10 digits)
            sn_matches = list(re.finditer(r'21(\d{10})', data))
        if sn_matches:
            # Choose the match closest to the end of the data (SN is usually the last field)
            # But also check if it's followed by 240 (model code)
            best_match = None
            best_score = -1
            
            for match in sn_matches:
                sn = match.group(1)
                sn_start = match.start()
                sn_end = match.end()
                
                # Score: prioritize matches closest to the end of data
                # SN is usually the last or second-to-last field in GS1 barcodes
                distance_from_end = len(data) - sn_end
                score = 10000 - distance_from_end  # Closer to end = much higher score
                
                # Small bonus if followed by 240 (model), but distance is more important
                remaining_after_sn = data[sn_end:]
                if remaining_after_sn.startswith("240"):
                    score += 100  # Small bonus for having model code
                
                if score > best_score:
                    best_score = score
                    best_match = match
            
            if best_match:
                sn = best_match.group(1)
                sn_start = best_match.start()
                sn_end = best_match.end()
                print(f"[DEBUG] GS1: Found SN pattern 21{sn} at position {sn_start}")
                
                # Extract SN
                result["sn"] = sn
                
                # Check if there's 240 (model) after the SN
                remaining_after_sn = data[sn_end:]
                if remaining_after_sn.startswith("240"):
                    after_240 = remaining_after_sn[3:]  # Skip "240"
                    
                    # Extract model code (usually 3-6 alphanumeric characters like "DCB00", "DIB00", "DIU150")
                    # Model codes are typically: DCB00, DEN00V, DIB00, DIU150, etc.
                    # Model codes CAN contain digits (like "DCB00", "DIU150"), so we need to be careful
                    # Power encoding is typically 5 digits starting with "00" (like 00215, 00140, 00175, 00255)
                    # Strategy: Use known model patterns to extract model, then extract power
                    # This is more reliable than trying to detect power encoding while extracting model
                    
                    # Known model patterns for Johnson & Johnson
                    known_models = ["DIB00", "DIU150", "DIU100", "DCB00", "DEN00V", "DET", "DIU"]
                    model = ""
                    
                    # First, try to match known model patterns
                    matched_model = None
                    for known_model in sorted(known_models, key=len, reverse=True):  # Try longer patterns first
                        if after_240.startswith(known_model):
                            matched_model = known_model
                            break
                    
                    if matched_model:
                        model = matched_model
                        print(f"[DEBUG] GS1: Matched known model pattern: {model}")
                    else:
                        # Fallback: Extract model until we find a valid 5-digit power encoding
                        # But require at least 5 characters to avoid stopping too early
                        i = 0
                        while i < len(after_240):
                            char = after_240[i]
                            
                            # Check if remaining (from current position) starts with 5-digit power encoding
                            remaining = after_240[i:]
                            if len(remaining) >= 5 and remaining[:5].isdigit() and remaining[:2] == "00":
                                # Check if this is a valid power encoding
                                power_digits = remaining[2:5]  # Last 3 digits
                                if power_digits.isdigit():
                                    tens = int(power_digits[0])
                                    ones = int(power_digits[1])
                                    decimal = int(power_digits[2])
                                    power_val = tens * 10 + ones + decimal * 0.1
                                    if 10 <= power_val <= 30:  # Reasonable power range for lenses
                                        # Only stop if we have a complete model code (at least 5 characters)
                                        if len(model) >= 5:  # We have a complete model code
                                            break
                            
                            # Model codes can be letters or digits
                            if char.isalnum():
                                model += char
                                i += 1
                            else:
                                break
                    
                    if model:
                        result["model"] = model.strip()
                        print(f"[DEBUG] GS1: Model (240) = {result['model']}")
                        
                        # Extract power encoding after model (if present)
                        power_part = after_240[len(model):]
                        print(f"[DEBUG] GS1: Power part after model '{model}': '{power_part}' (length: {len(power_part)})")
                        
                        # Handle power encoding formats:
                        # 1. Standard 5-digit: 00215, 00140, 00175 (starts with 00)
                        # 2. With letter prefix: I0190, I230 (starts with I, followed by digits)
                        # 3. 3-digit: 215, 140, 175 (no leading zeros)
                        
                        # Check if it starts with 'I' (letter I) followed by digits
                        if len(power_part) > 0 and power_part[0] == 'I' and len(power_part) > 1:
                            # Format: I0190, I230 - skip the 'I' and parse the rest
                            digits_part = power_part[1:]
                            if len(digits_part) >= 4 and digits_part[:4].isdigit():
                                # Format: I0190 -> 0190 -> 19.0D
                                # 0190: first char is 0, rest is 190 -> 19.0
                                if digits_part[0] == "0":
                                    # Remove first 0, take last 3 digits: 190 -> 19.0
                                    power_digits = digits_part[-3:]  # 190
                                    power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                    result["power"] = f"+{power_value}D"
                                    print(f"[DEBUG] GS1: Power (from 240, I-prefix format) = {result['power']}")
                                elif digits_part[:2] == "00":
                                    # Format: I00255 -> 00255 -> 25.5D
                                    power_digits = digits_part[2:5]  # 255
                                    power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                    result["power"] = f"+{power_value}D"
                                    print(f"[DEBUG] GS1: Power (from 240, I-prefix 00 format) = {result['power']}")
                            elif len(digits_part) >= 3 and digits_part[:3].isdigit():
                                # Format: I230 -> 230 -> 23.0D
                                power_digits = digits_part[:3]
                                power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                result["power"] = f"+{power_value}D"
                                print(f"[DEBUG] GS1: Power (from 240, I-prefix 3-digit format) = {result['power']}")
                        elif len(power_part) >= 5 and power_part[:5].isdigit():
                            # 5-digit format: 00215, 00140, 00175
                            if power_part[:2] == "00":
                                power_digits = power_part[2:5]  # Skip first 2 zeros, get last 3
                                if len(power_digits) == 3:
                                    power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                    result["power"] = f"+{power_value}D"
                                    print(f"[DEBUG] GS1: Power (from 240, 5-digit format) = {result['power']}")
                            else:
                                # Non-standard 5-digit format: try parsing last 3 digits
                                try:
                                    power_digits = power_part[-3:]  # Last 3 digits
                                    tens = int(power_digits[0])
                                    ones = int(power_digits[1])
                                    decimal = int(power_digits[2])
                                    power_val = tens * 10 + ones + decimal * 0.1
                                    if 10 <= power_val <= 30:  # Reasonable power range
                                        power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                        result["power"] = f"+{power_value}D"
                                        print(f"[DEBUG] GS1: Power (from 240, non-standard 5-digit format) = {result['power']}")
                                except:
                                    pass
                        elif len(power_part) >= 3 and power_part[:3].isdigit():
                            # 3-digit format: 215, 140, 175 (no leading zeros)
                            power_digits = power_part[:3]
                            power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                            result["power"] = f"+{power_value}D"
                            print(f"[DEBUG] GS1: Power (from 240, 3-digit format) = {result['power']}")
                        else:
                            print(f"[DEBUG] GS1: Power part '{power_part}' doesn't match expected format")
                
                # Don't return early - continue to process GTIN and other AIs for model/power
                # We'll process them in the sequential parsing section below
                # Only return if we have all three (SN, model, power)
                if result["sn"] and result["model"] and result["power"]:
                    print(f"[DEBUG] GS1: Complete extraction: SN={result['sn']}, Model={result['model']}, Power={result['power']}")
                    return result
                # Otherwise, continue to sequential parsing to extract model/power from GTIN
        
        # Fallback to sequential parsing if pattern matching didn't work
        while pos < len(data) - 1:
            ai_code = data[pos:pos+2]
            pos += 2
            
            if ai_code == "01":  # GTIN (14 digits)
                if pos + 14 <= len(data):
                    gtin = data[pos:pos+14]
                    pos += 14
                    print(f"[DEBUG] GS1: GTIN = {gtin}")
                    
                    # For ZEISS products, try to extract model and power from GTIN
                    # ZEISS GTIN format: 0404933600XXXX (where XXXX may encode power)
                    # Product: MD CT LUCIA 621P
                    if gtin.startswith("0404933600"):
                        # This is a ZEISS MD CT LUCIA 621P product
                        if not result.get("model"):
                            result["model"] = "CT LUCIA 621P"
                            print(f"[DEBUG] GS1: Model (from GTIN prefix) = {result['model']}")
                        
                        # Try to extract power from GTIN using lookup table
                        # GTIN last 4 digits encode power for ZEISS LUCIA 621P
                        # Known mappings (will be expanded as more data is collected):
                        gtin_to_power = {
                            "1608": "+19.0D",  # GTIN ending in 08
                            "1639": "+20.5D",  # GTIN ending in 39
                            "1677": "+22.5D",  # GTIN ending in 77
                        }
                        
                        # Try last 4 digits first
                        last_4 = gtin[-4:]
                        if last_4 in gtin_to_power:
                            result["power"] = gtin_to_power[last_4]
                            print(f"[DEBUG] GS1: Power (from GTIN lookup) = {result['power']}")
                        else:
                            # Try last 2 digits as fallback (less reliable)
                            last_2 = gtin[-2:]
                            # For now, we can't derive power directly from last 2 digits
                            # This would require a more complete lookup table
                            print(f"[DEBUG] GS1: GTIN last 4 digits = {last_4}, last 2 = {last_2} (power mapping not found)")
                    else:
                        print(f"[DEBUG] GS1: GTIN = {gtin} (not ZEISS LUCIA, not used as model)")
            elif ai_code == "11":  # Production date (6 digits: YYMMDD) - skip, not power
                if pos + 6 <= len(data):
                    prod_date = data[pos:pos+6]
                    pos += 6
                    print(f"[DEBUG] GS1: Production Date = {prod_date} (not used as power)")
            elif ai_code == "17":  # Expiry date (6 digits: YYMMDD) - skip, not power
                if pos + 6 <= len(data):
                    expiry = data[pos:pos+6]
                    pos += 6
                    print(f"[DEBUG] GS1: Expiry = {expiry} (not used as power)")
            elif ai_code == "20":  # Variant (variable length, usually 1-2 digits)
                # Variant code, usually short (1-2 digits)
                if pos < len(data):
                    # Try to read 1-2 digits, but stop if we see next AI pattern
                    variant = ""
                    while pos < len(data) and len(variant) < 2 and data[pos].isdigit():
                        variant += data[pos]
                        pos += 1
                    print(f"[DEBUG] GS1: Variant = {variant}")
            elif ai_code == "12":  # Additional identification (variable length, usually 1-2 digits)
                # Additional ID, usually short
                if pos < len(data):
                    additional_id = ""
                    while pos < len(data) and len(additional_id) < 2 and data[pos].isdigit():
                        additional_id += data[pos]
                        pos += 1
                    print(f"[DEBUG] GS1: Additional ID = {additional_id}")
            elif ai_code == "21":  # Serial number (variable length, read until next AI or end)
                # Serial number can be 10 digits (common for medical devices)
                # But may be followed by other AIs like (240) for model
                remaining = data[pos:]
                if remaining:
                    # Priority 1: Check for AI 240 (3-digit AI) - most common pattern
                    # Pattern: 21(10 digits)240(model)
                    if len(remaining) >= 13 and remaining[:10].isdigit() and remaining[10:13] == "240":
                        result["sn"] = remaining[:10]
                        pos += 10
                        print(f"[DEBUG] GS1: Serial Number = {result['sn']} (10 digits, followed by 240)")
                        # Process 240 next
                        pos += 3  # Skip "240"
                        remaining_after_240 = data[pos:]
                        
                        # Extract model code (same logic as regex matching section)
                        # Use known model patterns for more reliable extraction
                        known_models = ["DIB00", "DIU150", "DIU100", "DCB00", "DEN00V", "DET", "DIU"]
                        model = ""
                        
                        # First, try to match known model patterns
                        matched_model = None
                        for known_model in sorted(known_models, key=len, reverse=True):  # Try longer patterns first
                            if remaining_after_240.startswith(known_model):
                                matched_model = known_model
                                break
                        
                        if matched_model:
                            model = matched_model
                            print(f"[DEBUG] GS1: Matched known model pattern: {model}")
                        else:
                            # Fallback: Extract model until we find a valid 5-digit power encoding
                            i = 0
                            while i < len(remaining_after_240):
                                char = remaining_after_240[i]
                                
                                # Check if remaining (from current position) starts with 5-digit power encoding
                                remaining = remaining_after_240[i:]
                                if len(remaining) >= 5 and remaining[:5].isdigit() and remaining[:2] == "00":
                                    # Check if this is a valid power encoding
                                    power_digits = remaining[2:5]  # Last 3 digits
                                    if power_digits.isdigit():
                                        tens = int(power_digits[0])
                                        ones = int(power_digits[1])
                                        decimal = int(power_digits[2])
                                        power_val = tens * 10 + ones + decimal * 0.1
                                        if 10 <= power_val <= 30:  # Reasonable power range for lenses
                                            # Only stop if we have a complete model code (at least 5 characters)
                                            if len(model) >= 5:  # We have a complete model code
                                                break
                                
                                # Model codes can be letters or digits
                                if char.isalnum():
                                    model += char
                                    i += 1
                                else:
                                    break
                        
                        if model:
                            result["model"] = model.strip()
                            pos += len(model)
                            print(f"[DEBUG] GS1: Model (240) = {result['model']}")
                            
                            # Extract power encoding after model (if present)
                            power_part = remaining_after_240[len(model):]
                            print(f"[DEBUG] GS1: Power part after model '{model}': '{power_part}' (length: {len(power_part)})")
                            
                            # Handle power encoding formats:
                            # 1. Standard 5-digit: 00215, 00140, 00175 (starts with 00)
                            # 2. With letter prefix: I0190, I230 (starts with I, followed by digits)
                            # 3. 3-digit: 215, 140, 175 (no leading zeros)
                            
                            # Check if it starts with 'I' (letter I) followed by digits
                            if len(power_part) > 0 and power_part[0] == 'I' and len(power_part) > 1:
                                # Format: I0190, I230 - skip the 'I' and parse the rest
                                digits_part = power_part[1:]
                                if len(digits_part) >= 4 and digits_part[:4].isdigit():
                                    # Format: I0190 -> 0190 -> 19.0D
                                    # 0190: first char is 0, rest is 190 -> 19.0
                                    if digits_part[0] == "0":
                                        # Remove first 0, take last 3 digits: 190 -> 19.0
                                        power_digits = digits_part[-3:]  # 190
                                        power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                        result["power"] = f"+{power_value}D"
                                        print(f"[DEBUG] GS1: Power (from 240, I-prefix format) = {result['power']}")
                                    elif digits_part[:2] == "00":
                                        # Format: I00255 -> 00255 -> 25.5D
                                        power_digits = digits_part[2:5]  # 255
                                        power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                        result["power"] = f"+{power_value}D"
                                        print(f"[DEBUG] GS1: Power (from 240, I-prefix 00 format) = {result['power']}")
                                elif len(digits_part) >= 3 and digits_part[:3].isdigit():
                                    # Format: I230 -> 230 -> 23.0D
                                    power_digits = digits_part[:3]
                                    power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                    result["power"] = f"+{power_value}D"
                                    print(f"[DEBUG] GS1: Power (from 240, I-prefix 3-digit format) = {result['power']}")
                            elif len(power_part) >= 5 and power_part[:5].isdigit():
                                # 5-digit format: 00215, 00140, 00175, 00255
                                if power_part[:2] == "00":
                                    power_digits = power_part[2:5]  # Skip first 2 zeros, get last 3
                                    if len(power_digits) == 3:
                                        power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                        result["power"] = f"+{power_value}D"
                                        print(f"[DEBUG] GS1: Power (from 240, 5-digit format) = {result['power']}")
                            elif len(power_part) >= 3 and power_part[:3].isdigit():
                                # 3-digit format: 215, 140, 175 (no leading zeros)
                                power_digits = power_part[:3]
                                power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                result["power"] = f"+{power_value}D"
                                print(f"[DEBUG] GS1: Power (from 240, 3-digit format) = {result['power']}")
                            else:
                                print(f"[DEBUG] GS1: Power part '{power_part}' doesn't match expected format")
                        break
                    
                    # Priority 2: Extract SN (prefer 11 digits, fallback to 10 digits)
                    # Medical device SNs are typically 10-11 digits
                    if len(remaining) >= 11 and remaining[:11].isdigit():
                        # Check if it's exactly 11 digits or if there's more data
                        if len(remaining) == 11:
                            # Exactly 11 digits - use all of it
                            result["sn"] = remaining
                            pos += 11
                            print(f"[DEBUG] GS1: Serial Number = {result['sn']} (exactly 11 digits)")
                            break
                        elif len(remaining) > 11:
                            # More than 11 digits - check what follows
                            next_part = remaining[11:]
                            if len(next_part) >= 3 and next_part[:3] == "240":
                                # Followed by AI 240 - use 11 digits as SN
                                result["sn"] = remaining[:11]
                                pos += 11
                                print(f"[DEBUG] GS1: Serial Number = {result['sn']} (11 digits, followed by 240)")
                                continue
                            elif len(next_part) >= 2 and next_part[:2].isdigit():
                                # Might be next AI - use 11 digits as SN
                                result["sn"] = remaining[:11]
                                pos += 11
                                print(f"[DEBUG] GS1: Serial Number = {result['sn']} (11 digits, possible next AI)")
                                continue
                            else:
                                # Just extra characters - use 11 digits as SN
                                result["sn"] = remaining[:11]
                                pos += 11
                                print(f"[DEBUG] GS1: Serial Number = {result['sn']} (11 digits, end of data)")
                                break
                    elif len(remaining) >= 10 and remaining[:10].isdigit():
                        # Fallback: Extract exactly 10 digits
                        # Check if there's more data that could be another AI
                        if len(remaining) > 10:
                            # Check if next 2-3 characters could be an AI code
                            next_part = remaining[10:]
                            if len(next_part) >= 3 and next_part[:3] == "240":
                                # Already handled above
                                pass
                            elif len(next_part) >= 2 and next_part[:2].isdigit() and len(remaining) > 12:
                                # Might be next AI
                                result["sn"] = remaining[:10]
                                pos += 10
                                print(f"[DEBUG] GS1: Serial Number = {result['sn']} (10 digits, possible next AI)")
                                # Continue to process next AI
                                continue
                            else:
                                # Just extra characters
                                result["sn"] = remaining[:10]
                                pos += 10
                                print(f"[DEBUG] GS1: Serial Number = {result['sn']} (10 digits, end of data)")
                                break
                        else:
                            # Exactly 10 digits
                            result["sn"] = remaining[:10]
                            pos += 10
                            print(f"[DEBUG] GS1: Serial Number = {result['sn']} (exactly 10 digits)")
                            break
                    
                    # Priority 3: Fallback - read all remaining as SN (if no clear pattern)
                    result["sn"] = remaining.strip()
                    pos += len(result["sn"])
                    print(f"[DEBUG] GS1: Serial Number = {result['sn']} (fallback, all remaining)")
                break  # Serial number is usually last, but may be followed by (240) for model
            elif ai_code == "24" or (len(data) > pos and data[pos] == "0" and ai_code + data[pos] == "240"):  # Additional product identification (240)
                # AI 240: Additional product identification (variable length, usually model code)
                if ai_code == "24" and pos < len(data) and data[pos] == "0":
                    # This is actually AI 240 (3 digits)
                    pos += 1  # Skip the '0'
                    ai_code = "240"
                
                if ai_code == "240":
                    remaining = data[pos:]
                    
                    # Use known model patterns for more reliable extraction
                    known_models = ["DIB00", "DIU150", "DIU100", "DCB00", "DEN00V", "DET", "DIU"]
                    model = ""
                    
                    # First, try to match known model patterns
                    matched_model = None
                    for known_model in sorted(known_models, key=len, reverse=True):  # Try longer patterns first
                        if remaining.startswith(known_model):
                            matched_model = known_model
                            break
                    
                    if matched_model:
                        model = matched_model
                        print(f"[DEBUG] GS1: Matched known model pattern: {model}")
                        pos += len(model)
                        result["model"] = model.strip()
                        print(f"[DEBUG] GS1: Model (240) = {result['model']}")
                        
                        # Extract power encoding after model (if present)
                        power_part = remaining[len(model):]
                        print(f"[DEBUG] GS1: Power part after model '{model}': '{power_part}' (length: {len(power_part)})")
                        
                        # Handle power encoding formats:
                        # 1. Standard 5-digit: 00215, 00140, 00175 (starts with 00)
                        # 2. With letter prefix: I0190, I230 (starts with I, followed by digits)
                        # 3. 3-digit: 215, 140, 175 (no leading zeros)
                        
                        # Check if it starts with 'I' (letter I) followed by digits
                        if len(power_part) > 0 and power_part[0] == 'I' and len(power_part) > 1:
                            # Format: I0190, I230 - skip the 'I' and parse the rest
                            digits_part = power_part[1:]
                            if len(digits_part) >= 4 and digits_part[:4].isdigit():
                                # Format: I0190 -> 0190 -> 19.0D
                                # 0190: first char is 0, rest is 190 -> 19.0
                                if digits_part[0] == "0":
                                    # Remove first 0, take last 3 digits: 190 -> 19.0
                                    power_digits = digits_part[-3:]  # 190
                                    power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                    result["power"] = f"+{power_value}D"
                                    print(f"[DEBUG] GS1: Power (from 240, I-prefix format) = {result['power']}")
                                elif digits_part[:2] == "00":
                                    # Format: I00255 -> 00255 -> 25.5D
                                    power_digits = digits_part[2:5]  # 255
                                    power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                    result["power"] = f"+{power_value}D"
                                    print(f"[DEBUG] GS1: Power (from 240, I-prefix 00 format) = {result['power']}")
                            elif len(digits_part) >= 3 and digits_part[:3].isdigit():
                                # Format: I230 -> 230 -> 23.0D
                                power_digits = digits_part[:3]
                                power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                result["power"] = f"+{power_value}D"
                                print(f"[DEBUG] GS1: Power (from 240, I-prefix 3-digit format) = {result['power']}")
                        elif len(power_part) >= 5 and power_part[:5].isdigit():
                            # 5-digit format: 00215, 00140, 00175, 00255
                            if power_part[:2] == "00":
                                power_digits = power_part[2:5]  # Skip first 2 zeros, get last 3
                                if len(power_digits) == 3:
                                    power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                    result["power"] = f"+{power_value}D"
                                    print(f"[DEBUG] GS1: Power (from 240, 5-digit format) = {result['power']}")
                            else:
                                # Non-standard 5-digit format: try parsing last 3 digits
                                try:
                                    power_digits = power_part[-3:]  # Last 3 digits
                                    tens = int(power_digits[0])
                                    ones = int(power_digits[1])
                                    decimal = int(power_digits[2])
                                    power_val = tens * 10 + ones + decimal * 0.1
                                    if 10 <= power_val <= 30:  # Reasonable power range
                                        power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                                        result["power"] = f"+{power_value}D"
                                        print(f"[DEBUG] GS1: Power (from 240, non-standard 5-digit format) = {result['power']}")
                                except:
                                    pass
                        elif len(power_part) >= 3 and power_part[:3].isdigit():
                            # 3-digit format: 215, 140, 175 (no leading zeros)
                            power_digits = power_part[:3]
                            power_value = power_digits[0] + power_digits[1] + "." + power_digits[2]
                            result["power"] = f"+{power_value}D"
                            print(f"[DEBUG] GS1: Power (from 240, 3-digit format) = {result['power']}")
                        else:
                            print(f"[DEBUG] GS1: Power part '{power_part}' doesn't match expected format")
                    else:
                        # Fallback: Extract model until we find a valid 5-digit power encoding
                        i = 0
                        while i < len(remaining) and len(model) < 15:
                            char = remaining[i]
                            # Model codes are usually alphanumeric
                            if char.isalnum():
                                model += char
                                i += 1
                            else:
                                break
                        
                        if model:
                            result["model"] = model.strip()
                            pos += len(model)
                            print(f"[DEBUG] GS1: Model (240) = {result['model']}")
                        else:
                            # Skip if no model found
                            pos += 1
                else:
                    # Unknown AI starting with 24, skip
                    break
            elif ai_code == "10":  # Batch/Lot (variable length)
                # For some brands, batch might contain model info, but we'll be conservative
                # and only use it if it looks like a model code (letters + numbers)
                remaining = data[pos:]
                # Try to read until next AI (2 digits) or end
                # Look for next AI code pattern
                next_ai_match = re.search(r'(?=\d{2})', remaining)
                if next_ai_match:
                    batch = remaining[:next_ai_match.start()]
                else:
                    batch = remaining
                
                # Only use batch as model if it looks like a model code (contains letters)
                if batch and re.search(r'[A-Za-z]', batch):
                    result["model"] = batch.strip()
                    print(f"[DEBUG] GS1: Batch/Lot (used as model) = {result['model']}")
                    pos += len(batch)
                else:
                    # Skip batch if it doesn't look like a model
                    pos += len(batch) if batch else 0
            else:
                # Unknown AI, try to skip
                break
    
    # For GS1 format, if we only got SN, that's expected for brands like Alcon
    # Model and power should be extracted from label text (OCR) or entered manually
    if result["sn"] and not result["model"] and not result["power"]:
        print(f"[DEBUG] GS1: Only SN extracted ({result['sn']}). Model and power should be read from label or entered manually.")
    
    return result


def merge_barcode_results(barcode_list: list[str]) -> Dict[str, Optional[str]]:
    """
    Merge multiple barcode readings from the same label.
    Different barcodes may contain different information (model, power, SN).
    
    Strategy:
    - Use longest barcode for SN if numeric
    - Combine text patterns from all barcodes
    """
    merged = {"model": None, "power": None, "sn": None, "original": []}
    
    all_parsed = [parse_barcode(code) for code in barcode_list]
    merged["original"] = barcode_list
    
    # Collect all non-None values
    models = [p["model"] for p in all_parsed if p["model"]]
    powers = [p["power"] for p in all_parsed if p["power"]]
    sns = [p["sn"] for p in all_parsed if p["sn"]]
    
    # Pick best values
    if models:
        # Prefer text model over numeric
        text_models = [m for m in models if not m.isdigit()]
        merged["model"] = text_models[0] if text_models else models[0]
    
    if powers:
        # Prefer power notation format
        power_powers = [p for p in powers if 'D' in p or '+' in p or '-' in p]
        merged["power"] = power_powers[0] if power_powers else powers[0]
    
    if sns:
        # Prefer longest numeric SN
        numeric_sns = [s for s in sns if s.isdigit()]
        if numeric_sns:
            merged["sn"] = max(numeric_sns, key=len)
        else:
            merged["sn"] = sns[0]
    
    return merged


def smart_extract_serial_number(barcode: str) -> Dict[str, Any]:
    """
    Intelligently extract serial number, type, and power from barcode using learned patterns and heuristics.
    
    Strategy:
    1. Try learned patterns first (highest priority)
    2. Use rule-based parsing as fallback
    
    Returns:
        dict with keys: sn, type, power, confidence (high/medium/low)
    """
    from .barcode_learner import apply_learned_patterns
    
    if not barcode:
        return {"sn": None, "type": None, "power": None, "confidence": "low"}
    
    barcode = barcode.strip()
    print(f"[SMART PARSER] Analyzing: {barcode}")
    
    # Step 1: Try learned patterns first (highest confidence)
    learned_result = apply_learned_patterns(barcode)
    if learned_result:
        print(f"[SMART PARSER] Found SN using learned pattern: {learned_result}")
        return {
            "sn": learned_result.get("sn"),
            "type": learned_result.get("type"),
            "power": learned_result.get("power"),
            "confidence": "high"
        }
    
    # Step 2: Fallback to rule-based parsing
    print(f"[SMART PARSER] No learned pattern matched, using rule-based parsing")
    parsed = parse_barcode(barcode)
    return {
        "sn": parsed.get("sn"),
        "type": parsed.get("model"),
        "power": parsed.get("power"),
        "confidence": "medium" if parsed.get("sn") else "low"
    }


def format_expiry_date(power: Optional[str]) -> Optional[str]:
    """
    Format expiry date from YYMMDD to readable format.
    
    Example: "250110" -> "2025-01-10"
    """
    if not power or len(power) < 6:
        return power
    
    try:
        # Assuming YYMMDD format
        yy = power[:2]
        mm = power[2:4]
        dd = power[4:6]
        
        # Convert YY to full year
        year = int(yy)
        year = 2000 + year if year >= 0 else 1900 + year
        
        return f"{year}-{mm}-{dd}"
    except:
        return power

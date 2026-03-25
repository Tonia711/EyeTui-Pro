"""
Barcode pattern learning system.
Learns patterns from barcode-serial_number pairs and applies them to new barcodes.
"""
import json
import os
import re
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

# Path to store learned patterns
LEARNED_PATTERNS_FILE = Path(__file__).parent.parent / "learned_barcode_patterns.json"


class BarcodePattern:
    """Represents a learned barcode pattern."""
    
    def __init__(self, pattern: str, sn_position: int, sn_length: int, 
                 prefix: str = "", suffix: str = "", examples: List[str] = None,
                 type: Optional[str] = None, power: Optional[str] = None):
        self.pattern = pattern  # Regex pattern
        self.sn_position = sn_position  # Position of SN in the pattern
        self.sn_length = sn_length  # Length of serial number
        self.prefix = prefix  # Fixed prefix before SN
        self.suffix = suffix  # Fixed suffix after SN
        self.examples = examples or []  # Example barcodes that match this pattern
        self.match_count = 0  # How many times this pattern has been used
        self.type = type  # Learned type/model (e.g., "DCB00", "CNA0T0")
        self.power = power  # Learned power (e.g., "+22.50D", "+20.0")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pattern": self.pattern,
            "sn_position": self.sn_position,
            "sn_length": self.sn_length,
            "prefix": self.prefix,
            "suffix": self.suffix,
            "examples": self.examples,
            "match_count": self.match_count,
            "type": self.type,
            "power": self.power
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BarcodePattern':
        pattern = cls(
            pattern=data["pattern"],
            sn_position=data["sn_position"],
            sn_length=data["sn_length"],
            prefix=data.get("prefix", ""),
            suffix=data.get("suffix", ""),
            examples=data.get("examples", []),
            type=data.get("type"),
            power=data.get("power")
        )
        pattern.match_count = data.get("match_count", 0)
        return pattern


def load_learned_patterns() -> List[BarcodePattern]:
    """Load learned patterns from file."""
    if not LEARNED_PATTERNS_FILE.exists():
        return []
    
    try:
        with open(LEARNED_PATTERNS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return [BarcodePattern.from_dict(item) for item in data]
    except Exception as e:
        print(f"[LEARNER] Error loading patterns: {e}")
        return []


def save_learned_patterns(patterns: List[BarcodePattern]):
    """Save learned patterns to file."""
    try:
        # Ensure directory exists
        LEARNED_PATTERNS_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        data = [pattern.to_dict() for pattern in patterns]
        with open(LEARNED_PATTERNS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"[LEARNER] Saved {len(patterns)} patterns to {LEARNED_PATTERNS_FILE}")
    except Exception as e:
        print(f"[LEARNER] Error saving patterns: {e}")


def extract_pattern(barcode: str, serial_number: str, type: Optional[str] = None, power: Optional[str] = None) -> Optional[BarcodePattern]:
    """
    Extract a pattern from a barcode-serial_number pair.
    
    Supports both numeric and alphanumeric serial numbers.
    Optionally stores type and power information for the pattern.
    
    Example 1 (numeric):
        barcode: "DCB000023520820525250628"
        serial_number: "2082052525"
        type: "DCB00"
        power: "+22.50D"
        -> Pattern: "DCB0000235" + {10 alphanumeric} + "0628"
    
    Example 2 (alphanumeric):
        barcode: "01040493360016771125021217280131216S2501800020"
        serial_number: "6S2501800020"
        -> Pattern: "0104049336001677112502121728013121" + {12 alphanumeric} + ""
    """
    if not barcode or not serial_number:
        return None
    
    # Find serial number position in barcode
    sn_pos = barcode.find(serial_number)
    if sn_pos == -1:
        # SN not found directly, try to find similar pattern
        # This might happen if SN is embedded differently
        return None
    
    # Extract prefix and suffix
    prefix = barcode[:sn_pos]
    suffix = barcode[sn_pos + len(serial_number):]
    
    # Create regex pattern
    # Use [A-Za-z0-9] to match both letters and digits (alphanumeric)
    # This supports serial numbers like "6S2501800020" that contain letters
    sn_length = len(serial_number)
    pattern_str = re.escape(prefix) + r'[A-Za-z0-9]{' + str(sn_length) + r'}' + re.escape(suffix)
    
    print(f"[LEARNER] Extracted pattern: prefix='{prefix}' (len={len(prefix)}), SN length={sn_length}, suffix='{suffix}' (len={len(suffix)}), type='{type}', power='{power}'")
    print(f"[LEARNER] Pattern regex: {pattern_str}")
    
    pattern = BarcodePattern(
        pattern=pattern_str,
        sn_position=len(prefix),
        sn_length=sn_length,
        prefix=prefix,
        suffix=suffix,
        examples=[barcode],
        type=type.strip() if type else None,
        power=power.strip() if power else None
    )
    
    return pattern


def find_matching_pattern(barcode: str, patterns: List[BarcodePattern]) -> Optional[Tuple[BarcodePattern, str]]:
    """
    Find a matching pattern for the given barcode.
    Returns (pattern, extracted_serial_number) if found, None otherwise.
    
    Supports both numeric and alphanumeric serial numbers.
    Uses direct prefix/suffix matching for reliability.
    Prioritizes more specific patterns (longer prefixes) to avoid false matches.
    """
    # Guardrail: ignore patterns that are too generic (short prefix+suffix) to avoid
    # cross-model false positives after learning a new model. A total context length
    # of 8 is a safe minimum for our current data (e.g., "524537"+"1027" = 10).
    MIN_SPECIFICITY = 8

    # Collect all matching patterns first
    matching_patterns = []
    
    for pattern in patterns:
        # Skip overly generic patterns early
        if len(pattern.prefix) + len(pattern.suffix) < MIN_SPECIFICITY:
            continue

        # Method 1: Direct prefix/suffix matching (most reliable)
        # Note: some manufacturers encode a changing numeric tail (e.g. expiry/lot).
        # If the learned suffix is purely numeric, allow any numeric suffix of the same length.
        suffix_ok = barcode.endswith(pattern.suffix)
        if (not suffix_ok) and pattern.suffix and pattern.suffix.isdigit():
            suffix_len = len(pattern.suffix)
            if len(barcode) >= suffix_len and barcode[-suffix_len:].isdigit():
                suffix_ok = True

        if barcode.startswith(pattern.prefix) and suffix_ok:
            sn_start = len(pattern.prefix)
            sn_end = len(barcode) - len(pattern.suffix)
            if sn_end > sn_start and sn_end - sn_start == pattern.sn_length:
                extracted_sn = barcode[sn_start:sn_end]
                # Validate: should be correct length and alphanumeric (letters and/or digits)
                if extracted_sn.isalnum() and len(extracted_sn) == pattern.sn_length:
                    matching_patterns.append((pattern, extracted_sn, len(pattern.prefix) + len(pattern.suffix)))
        
        # Method 2: Regex matching (fallback)
        try:
            # Use fullmatch so the pattern must cover the entire barcode; this
            # prevents partial-prefix matches from incorrectly winning.
            match = re.fullmatch(pattern.pattern, barcode)
            if match:
                sn_start = pattern.sn_position
                sn_end = sn_start + pattern.sn_length
                if sn_end <= len(barcode):
                    extracted_sn = barcode[sn_start:sn_end]
                    if len(extracted_sn) == pattern.sn_length and extracted_sn.isalnum():
                        # Calculate specificity: longer prefix + suffix = more specific
                        specificity = len(pattern.prefix) + len(pattern.suffix)
                        matching_patterns.append((pattern, extracted_sn, specificity))
        except re.error as e:
            print(f"[LEARNER] Regex error for pattern '{pattern.pattern}': {e}")
            continue
    
    # If we have matches, return the most specific one
    # Priority: 1) Longer prefix (more specific), 2) Longer suffix, 3) Higher match_count
    if matching_patterns:
        # Sort by prefix length (descending), then suffix length (descending), then match_count (descending)
        matching_patterns.sort(key=lambda x: (len(x[0].prefix), len(x[0].suffix), x[0].match_count), reverse=True)
        best_pattern, extracted_sn, specificity = matching_patterns[0]
        best_pattern.match_count += 1
        print(f"[LEARNER] Matched pattern (prefix_len={len(best_pattern.prefix)}, suffix_len={len(best_pattern.suffix)}): prefix='{best_pattern.prefix}', suffix='{best_pattern.suffix}', SN='{extracted_sn}', type='{best_pattern.type}', power='{best_pattern.power}'")
        return (best_pattern, extracted_sn)
    
    return None


def learn_from_example(barcode: str, serial_number: str, type: Optional[str] = None, power: Optional[str] = None) -> bool:
    """
    Learn a new pattern from a barcode-serial_number pair.
    Optionally learns type and power information.
    Returns True if a new pattern was learned, False otherwise.
    """
    print(f"[LEARNER] Learning from: barcode='{barcode}', SN='{serial_number}', type='{type}', power='{power}'")
    
    # Extract pattern
    new_pattern = extract_pattern(barcode, serial_number, type, power)
    if not new_pattern:
        print(f"[LEARNER] Could not extract pattern")
        return False
    
    # Load existing patterns
    patterns = load_learned_patterns()
    
    # Check if similar pattern already exists
    for existing in patterns:
        # If prefix and suffix match, it's the same pattern
        if existing.prefix == new_pattern.prefix and existing.suffix == new_pattern.suffix:
            # Add this example to existing pattern
            if barcode not in existing.examples:
                existing.examples.append(barcode)
                # Keep only last 10 examples
                existing.examples = existing.examples[-10:]
            # Update type and power if provided (prefer new values if existing ones are None)
            if new_pattern.type and (not existing.type or existing.type != new_pattern.type):
                existing.type = new_pattern.type
            if new_pattern.power and (not existing.power or existing.power != new_pattern.power):
                existing.power = new_pattern.power
            save_learned_patterns(patterns)
            print(f"[LEARNER] Updated existing pattern (now {len(existing.examples)} examples, type='{existing.type}', power='{existing.power}')")
            return False
    
    # Add new pattern
    patterns.append(new_pattern)
    save_learned_patterns(patterns)
    print(f"[LEARNER] Learned new pattern: prefix='{new_pattern.prefix}', suffix='{new_pattern.suffix}', SN length={new_pattern.sn_length}, type='{new_pattern.type}', power='{new_pattern.power}'")
    return True


def apply_learned_patterns(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Try to extract serial number, type, and power using learned patterns.
    Returns dict with 'sn', 'type', and 'power' if found, None otherwise.
    """
    patterns = load_learned_patterns()
    if not patterns:
        return None
    
    result = find_matching_pattern(barcode, patterns)
    if result:
        pattern, sn = result
        print(f"[LEARNER] Matched pattern: prefix='{pattern.prefix}', suffix='{pattern.suffix}' -> SN='{sn}', type='{pattern.type}', power='{pattern.power}'")
        # Save updated match counts
        save_learned_patterns(patterns)
        return {
            "sn": sn,
            "type": pattern.type,
            "power": pattern.power
        }
    
    return None


def get_learned_patterns() -> List[Dict[str, Any]]:
    """Get all learned patterns for display/management."""
    patterns = load_learned_patterns()
    return [
        {
            "id": i,
            "pattern": p.pattern,
            "prefix": p.prefix,
            "suffix": p.suffix,
            "sn_length": p.sn_length,
            "examples_count": len(p.examples),
            "match_count": p.match_count,
            "examples": p.examples[:3]  # Show first 3 examples
        }
        for i, p in enumerate(patterns)
    ]


def delete_pattern(pattern_id: int) -> bool:
    """Delete a learned pattern by ID."""
    patterns = load_learned_patterns()
    if 0 <= pattern_id < len(patterns):
        deleted = patterns.pop(pattern_id)
        save_learned_patterns(patterns)
        print(f"[LEARNER] Deleted pattern: {deleted.prefix}...{deleted.suffix}")
        return True
    return False


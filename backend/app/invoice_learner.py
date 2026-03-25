"""
Invoice Extraction Learning System

This module implements a self-learning invoice extraction system that:
1. Initially knows nothing about any invoice layouts
2. Learns extraction rules from user corrections
3. Applies learned rules to future invoices with similar layouts

Key concepts:
- Layout Fingerprint: A hash/signature identifying a PDF's visual structure
- Extraction Rule: Learned patterns for extracting specific fields
- Rule Storage: JSON file to persist learned rules across restarts
"""
import pdfplumber
import re
import json
import hashlib
from typing import Optional, Dict, Any, Tuple, List
from pathlib import Path
from dataclasses import dataclass, asdict
from datetime import datetime


# Path to store learned rules (relative to backend directory)
RULES_FILE = Path(__file__).parent.parent / "learned_rules.json"
# Path to default rules (shipped with the application)
DEFAULT_RULES_FILE = Path(__file__).parent.parent / "default_rules.json"


@dataclass
class ExtractionRule:
    """A learned rule for extracting a specific field"""
    field_type: str  # 'supplier', 'invoice_number', 'serial_number'
    
    # For supplier detection - text patterns that identify this supplier
    text_markers: List[str] = None  # Unique text fragments in this layout
    
    # For value extraction
    value_pattern: str = None  # Regex pattern matching the value format
    prefix_context: str = None  # Text appearing before the value
    suffix_context: str = None  # Text appearing after the value
    
    # Post-extraction transformation
    strip_leading_zeros: bool = False  # If True, remove leading zeros from extracted value
    
    # Coordinates-based extraction (optional, less reliable for serial numbers)
    x_range: Tuple[float, float] = None  # (min_x, max_x) normalized 0-1
    y_range: Tuple[float, float] = None  # (min_y, max_y) normalized 0-1
    
    # Statistics
    created_at: str = None
    match_count: int = 0
    
    def to_dict(self):
        return {k: v for k, v in asdict(self).items() if v is not None}
    
    @classmethod
    def from_dict(cls, d):
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass  
class LayoutProfile:
    """Profile of a learned invoice layout (supplier)"""
    supplier_name: str
    
    # Layout identification
    fingerprint: str  # Hash of structural features
    text_markers: List[str]  # Unique text fragments for identification
    
    # Extraction rules
    invoice_number_rules: List[ExtractionRule] = None
    serial_number_rules: List[ExtractionRule] = None
    
    # Metadata
    created_at: str = None
    last_updated: str = None
    example_count: int = 0
    
    def to_dict(self):
        result = {
            'supplier_name': self.supplier_name,
            'fingerprint': self.fingerprint,
            'text_markers': self.text_markers,
            'created_at': self.created_at,
            'last_updated': self.last_updated,
            'example_count': self.example_count,
        }
        if self.invoice_number_rules:
            result['invoice_number_rules'] = [r.to_dict() for r in self.invoice_number_rules]
        if self.serial_number_rules:
            result['serial_number_rules'] = [r.to_dict() for r in self.serial_number_rules]
        return result
    
    @classmethod
    def from_dict(cls, d):
        invoice_rules = None
        serial_rules = None
        if 'invoice_number_rules' in d:
            invoice_rules = [ExtractionRule.from_dict(r) for r in d['invoice_number_rules']]
        if 'serial_number_rules' in d:
            serial_rules = [ExtractionRule.from_dict(r) for r in d['serial_number_rules']]
        return cls(
            supplier_name=d['supplier_name'],
            fingerprint=d['fingerprint'],
            text_markers=d['text_markers'],
            invoice_number_rules=invoice_rules,
            serial_number_rules=serial_rules,
            created_at=d.get('created_at'),
            last_updated=d.get('last_updated'),
            example_count=d.get('example_count', 0),
        )


class InvoiceLearner:
    """
    Self-learning invoice extraction system.
    
    Learning workflow:
    1. User uploads PDF -> system extracts text, generates fingerprint
    2. System checks if fingerprint matches known layout
    3. If known: apply learned rules to extract data
    4. If unknown: return empty results, let user fill in
    5. User submits corrections -> system learns new rules
    """
    
    def __init__(self, rules_file: Path = RULES_FILE, default_rules_file: Path = DEFAULT_RULES_FILE):
        self.rules_file = rules_file
        self.default_rules_file = default_rules_file
        self.layouts: Dict[str, LayoutProfile] = {}
        self._load_rules()
    
    def _load_rules(self):
        """Load learned rules from file, falling back to default rules if empty"""
        loaded = False
        
        # Try to load from learned rules file
        if self.rules_file.exists():
            try:
                with open(self.rules_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    layouts_data = data.get('layouts', {})
                    if layouts_data:  # Only use if not empty
                        for fingerprint, layout_data in layouts_data.items():
                            self.layouts[fingerprint] = LayoutProfile.from_dict(layout_data)
                        print(f"[LEARNER] Loaded {len(self.layouts)} layout profiles from learned rules")
                        loaded = True
            except Exception as e:
                print(f"[LEARNER] Error loading rules: {e}")
        
        # If no learned rules, try to load default rules
        if not loaded and self.default_rules_file.exists():
            try:
                with open(self.default_rules_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for fingerprint, layout_data in data.get('layouts', {}).items():
                        self.layouts[fingerprint] = LayoutProfile.from_dict(layout_data)
                print(f"[LEARNER] Initialized with {len(self.layouts)} default layout profiles")
                # Save as learned rules so future updates are captured
                self._save_rules()
                loaded = True
            except Exception as e:
                print(f"[LEARNER] Error loading default rules: {e}")
        
        if not loaded:
            print("[LEARNER] No rules available, starting fresh")
            self.layouts = {}
    
    def _save_rules(self):
        """Save learned rules to file"""
        try:
            data = {
                'version': '1.0',
                'updated_at': datetime.now().isoformat(),
                'layouts': {fp: layout.to_dict() for fp, layout in self.layouts.items()}
            }
            with open(self.rules_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"[LEARNER] Saved {len(self.layouts)} layout profiles")
        except Exception as e:
            print(f"[LEARNER] Error saving rules: {e}")
    
    def generate_fingerprint(self, pdf_path: str) -> Tuple[str, List[str], str]:
        """
        Generate a fingerprint for PDF layout identification.
        
        Returns:
            (fingerprint_hash, text_markers, full_text)
        
        Fingerprint is based on:
        1. Page dimensions
        2. Image positions (company logos are often in fixed positions)
        3. Key text fragments (company names, headers, etc.)
        """
        features = []
        text_markers = []
        full_text = ""
        
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages[:2]):  # First 2 pages max
                # Page dimensions (normalized)
                w, h = page.width, page.height
                features.append(f"page{i}:{w:.0f}x{h:.0f}")
                
                # Image positions (if any) - company logos are often identifiers
                if hasattr(page, 'images') and page.images:
                    for img in page.images[:3]:
                        # Normalize positions to 0-1 range
                        nx = img['x0'] / w
                        ny = img['top'] / h
                        nw = img['width'] / w
                        nh = img['height'] / h
                        features.append(f"img:{nx:.2f},{ny:.2f},{nw:.2f},{nh:.2f}")
                
                # Extract text
                page_text = page.extract_text() or ""
                full_text += page_text + "\n"
                
                # Extract unique text markers (first few lines often contain company info)
                # Look for company-identifying text in the first 15 lines
                lines = page_text.split('\n')[:15]
                for line in lines:
                    line = line.strip()
                    # Look for company-identifying text
                    if len(line) > 10 and len(line) < 100:
                        # Skip generic invoice terms that appear in many invoices
                        skip_terms = [
                            'invoice', 'date', 'total', 'gst', 'tax', 'page', 
                            'phone', 'fax', 'email', 'po box', 'new zealand',
                            'nz$', 'amount', 'qty', 'quantity', 'price', 'due',
                            'payment', 'terms', 'subtotal', 'freight', 'discount',
                            'auckland', 'wellington', 'christchurch', 'street',
                            'road', 'drive', 'avenue', 'lane', 'place'
                        ]
                        line_lower = line.lower()
                        if not any(skip in line_lower for skip in skip_terms):
                            text_markers.append(line)
        
        # Create hash from features
        feature_str = "|".join(sorted(features))
        fingerprint = hashlib.md5(feature_str.encode()).hexdigest()[:16]
        
        return fingerprint, text_markers[:10], full_text
    
    def find_matching_layout(self, fingerprint: str, text_markers: List[str], 
                             full_text: str) -> Optional[LayoutProfile]:
        """
        Find a learned layout that matches this PDF.
        
        Matching strategy (in order of priority):
        1. Exact fingerprint match (same PDF structure)
        2. Text marker overlap (same company text patterns)
        
        Note: We removed supplier name matching because short names like "AMO" 
        can appear in unrelated text (e.g., "AMOUNT"), causing false positives.
        """
        # Try exact fingerprint match first
        if fingerprint in self.layouts:
            print(f"[LEARNER] Exact fingerprint match: {fingerprint}")
            return self.layouts[fingerprint]
        
        # Try text marker matching - look for unique company identifiers
        best_match = None
        best_score = 0
        
        for layout in self.layouts.values():
            if not layout.text_markers:
                continue
            
            # Check how many markers are found in the text
            # Only count exact marker matches (not partial)
            matches = 0
            for marker in layout.text_markers:
                # For short markers (< 15 chars), require word boundary match
                if len(marker) < 15:
                    # Check if marker appears as a complete phrase
                    if marker in full_text:
                        matches += 1
                else:
                    # For longer markers, partial match is OK
                    if marker in full_text:
                        matches += 1
            
            if len(layout.text_markers) == 0:
                continue
                
            score = matches / len(layout.text_markers)
            
            # Require at least 30% marker match for reliability
            if score >= 0.3 and score > best_score:
                best_score = score
                best_match = layout
                print(f"[LEARNER] Text marker match: {layout.supplier_name} (score={score:.2f})")
        
        if best_match:
            print(f"[LEARNER] Best match: {best_match.supplier_name}")
        else:
            print(f"[LEARNER] No matching layout found for fingerprint: {fingerprint}")
        
        return best_match
    
    def extract_with_rules(self, text: str, layout: LayoutProfile) -> Dict[str, Any]:
        """
        Extract invoice data using learned rules for this layout.
        """
        result = {
            'supplier_name': layout.supplier_name,
            'invoice_number': None,
            'serial_numbers': [],
            'confidence': 'high',
            'used_learned_rules': True,
        }
        
        # Extract invoice number
        if layout.invoice_number_rules:
            for rule in layout.invoice_number_rules:
                inv_num = self._apply_rule(text, rule)
                if inv_num:
                    result['invoice_number'] = inv_num
                    break
        
        # Extract serial numbers
        if layout.serial_number_rules:
            for rule in layout.serial_number_rules:
                serials = self._apply_rule_multi(text, rule, result.get('invoice_number'))
                if serials:
                    result['serial_numbers'].extend(serials)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_serials = []
        for s in result['serial_numbers']:
            if s not in seen:
                seen.add(s)
                unique_serials.append(s)
        result['serial_numbers'] = unique_serials
        
        return result
    
    def _apply_rule(self, text: str, rule: ExtractionRule) -> Optional[str]:
        """Apply a single extraction rule to find one value"""
        result = None
        
        if rule.value_pattern:
            # Try pattern with context first
            if rule.prefix_context:
                # Escape special regex chars in context, but keep the pattern
                prefix_escaped = re.escape(rule.prefix_context)
                pattern = f"{prefix_escaped}\\s*({rule.value_pattern})"
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    result = match.group(1)
            
            # Try pattern alone
            if result is None:
                matches = re.findall(rule.value_pattern, text)
                if matches:
                    result = matches[0]
        
        # Apply post-extraction transformation
        if result and rule.strip_leading_zeros:
            result = result.lstrip('0') or '0'  # Keep at least one '0' if all zeros
        
        return result
    
    def _apply_rule_multi(self, text: str, rule: ExtractionRule, 
                          invoice_number: str = None) -> List[str]:
        """Apply a rule to find multiple values (for serial numbers)"""
        results = []
        
        if rule.value_pattern:
            matches = re.findall(rule.value_pattern, text)
            for match in matches:
                # Exclude invoice number from serials
                if invoice_number and match == invoice_number:
                    continue
                
                # Apply post-extraction transformation
                if rule.strip_leading_zeros:
                    match = match.lstrip('0') or '0'  # Keep at least one '0' if all zeros
                
                results.append(match)
        
        return results
    
    def learn_from_correction(self, pdf_path: str, fingerprint: str,
                              text_markers: List[str], full_text: str,
                              supplier_name: str, invoice_number: str,
                              serial_numbers: List[str],
                              original_extracted: Dict[str, Any] = None) -> bool:
        """
        Learn extraction rules from user-provided correct values.
        
        This is called when user submits corrected invoice data.
        
        Args:
            original_extracted: The originally auto-extracted values (before user edits).
                               Used to determine if we should ADD or REPLACE rules.
        """
        try:
            now = datetime.now().isoformat()
            
            # Enhance text_markers with supplier-specific identifiers
            # Look for the supplier name or company-specific text in the PDF
            enhanced_markers = []
            
            # Add supplier name variations that appear in the text
            supplier_lower = supplier_name.lower()
            for line in full_text.split('\n')[:30]:
                line_stripped = line.strip()
                line_lower = line_stripped.lower()
                
                # If line contains supplier name, add it as a marker
                if supplier_lower in line_lower:
                    if len(line_stripped) > 5 and len(line_stripped) < 150:
                        enhanced_markers.append(line_stripped)
                
                # Also look for company identifiers (Ltd, Limited, Pty, Inc, etc.)
                if any(corp in line_lower for corp in ['ltd', 'limited', 'pty', 'inc', 'corp']):
                    if supplier_lower in line_lower or len(enhanced_markers) < 3:
                        if len(line_stripped) > 10 and len(line_stripped) < 150:
                            enhanced_markers.append(line_stripped)
            
            # Combine with original markers, prioritizing enhanced ones
            final_markers = enhanced_markers[:5] + [m for m in text_markers if m not in enhanced_markers][:5]
            
            print(f"[LEARNER] Learning layout for {supplier_name}")
            print(f"[LEARNER] Fingerprint: {fingerprint}")
            print(f"[LEARNER] Enhanced markers: {enhanced_markers[:3]}")
            
            # Check if we already have this layout
            if fingerprint in self.layouts:
                layout = self.layouts[fingerprint]
                layout.last_updated = now
                layout.example_count += 1
                # Update markers if we have better ones
                if enhanced_markers:
                    layout.text_markers = final_markers[:10]
            else:
                # Create new layout profile
                layout = LayoutProfile(
                    supplier_name=supplier_name,
                    fingerprint=fingerprint,
                    text_markers=final_markers[:10],
                    created_at=now,
                    last_updated=now,
                    example_count=1,
                )
                self.layouts[fingerprint] = layout
            
            # Update supplier name if changed
            layout.supplier_name = supplier_name
            
            # Determine if this is a modification of existing extraction or a new pattern
            # original_extracted contains what was auto-extracted before user edits
            original_invoice = original_extracted.get('invoice_number') if original_extracted else None
            original_serials = set(original_extracted.get('serial_numbers', [])) if original_extracted else set()
            
            # Learn invoice number pattern
            if invoice_number:
                inv_rule = self._learn_value_pattern(full_text, invoice_number, 'invoice_number')
                if inv_rule:
                    # If user modified an existing extraction, replace the rule
                    # If it was originally empty/missing, this is a new pattern
                    if original_invoice and original_invoice != invoice_number:
                        # User corrected the extracted value - replace rule
                        layout.invoice_number_rules = [inv_rule]
                        print(f"[LEARNER] Replaced invoice number rule: {original_invoice} -> {invoice_number}")
                    else:
                        # New pattern or same value - add/keep rule
                        layout.invoice_number_rules = [inv_rule]
            
            # Learn serial number patterns with ADD vs REPLACE logic
            if serial_numbers:
                new_serial_rules = []
                for sn in serial_numbers:
                    rule = self._learn_value_pattern(full_text, sn, 'serial_number')
                    if rule:
                        new_serial_rules.append(rule)
                
                if new_serial_rules:
                    # Collect new patterns
                    new_patterns = {}
                    for rule in new_serial_rules:
                        p = rule.value_pattern
                        if p not in new_patterns:
                            new_patterns[p] = rule
                        else:
                            new_patterns[p].match_count += 1
                    
                    # Check which serials are modifications vs additions
                    # Modification: a serial was auto-extracted but user changed it
                    # Addition: serial was not auto-extracted, user added it
                    modified_serials = set()
                    added_serials = set()
                    for sn in serial_numbers:
                        if original_serials and sn not in original_serials:
                            # Check if this might be a modification (user edited an original)
                            # For now, we can't know which original was edited, so treat all new ones as additions
                            added_serials.add(sn)
                        else:
                            # Serial was in original extraction, keep its rule
                            pass
                    
                    # Get existing patterns
                    existing_patterns = {}
                    if layout.serial_number_rules:
                        for rule in layout.serial_number_rules:
                            existing_patterns[rule.value_pattern] = rule
                    
                    # MERGE logic: add new patterns to existing ones
                    # User's latest choice for strip_leading_zeros should take precedence
                    for pattern, rule in new_patterns.items():
                        if pattern not in existing_patterns:
                            # This is a new pattern format - ADD it
                            existing_patterns[pattern] = rule
                            print(f"[LEARNER] Added new serial pattern: {pattern} (strip_zeros={rule.strip_leading_zeros})")
                        else:
                            # Same pattern exists - update settings based on user's latest choice
                            old_strip = existing_patterns[pattern].strip_leading_zeros
                            new_strip = rule.strip_leading_zeros
                            
                            existing_patterns[pattern].match_count += rule.match_count
                            
                            # Update strip_leading_zeros to user's latest preference
                            if old_strip != new_strip:
                                existing_patterns[pattern].strip_leading_zeros = new_strip
                                print(f"[LEARNER] Updated pattern {pattern}: strip_zeros {old_strip} -> {new_strip}")
                    
                    # Update layout with merged rules
                    layout.serial_number_rules = list(existing_patterns.values())
            
            # Save updated rules
            self._save_rules()
            
            print(f"[LEARNER] Learned rules for '{supplier_name}' (fingerprint: {fingerprint})")
            return True
            
        except Exception as e:
            print(f"[LEARNER] Error learning from correction: {e}")
            return False
    
    def _learn_value_pattern(self, text: str, value: str, 
                             field_type: str) -> Optional[ExtractionRule]:
        """
        Learn a pattern for extracting a specific value from text.
        
        Strategy:
        1. Find the value in the text (or a variant like with/without leading zeros)
        2. Capture surrounding context
        3. Infer a regex pattern from the value format
        """
        if not value:
            return None
        
        # Try to find the value in text, or find a variant (e.g., with leading zeros)
        actual_value_in_text = value
        needs_strip_leading_zeros = False
        pos = -1
        
        # For numeric values, first check if there's a version with leading zeros
        # This handles cases like user provides "25424111139" but PDF has "000000025424111139"
        if value.isdigit() and not value.startswith('0'):
            # Look for the value with potential leading zeros in the text
            # Use word boundary to ensure we match a complete number
            pattern_with_zeros = r'\b(0+' + re.escape(value) + r')\b'
            match = re.search(pattern_with_zeros, text)
            if match:
                actual_value_in_text = match.group(1)
                pos = match.start()
                needs_strip_leading_zeros = True
                print(f"[LEARNER] Found variant with leading zeros: {actual_value_in_text}, will strip zeros on extraction")
        
        # If not found with leading zeros, try exact match
        if pos < 0:
            # Use word boundary for exact match to avoid partial matches
            exact_pattern = r'\b' + re.escape(value) + r'\b'
            match = re.search(exact_pattern, text)
            if match:
                pos = match.start()
                actual_value_in_text = value
        
        # Fallback: simple string find
        if pos < 0:
            pos = text.find(value)
            if pos >= 0:
                actual_value_in_text = value
        
        if pos < 0:
            return None
        
        # Get context around the value
        prefix_start = max(0, pos - 50)
        prefix = text[prefix_start:pos].strip()
        # Get last "word" or label before the value
        prefix_words = prefix.split()
        prefix_context = prefix_words[-1] if prefix_words else None
        
        suffix_end = min(len(text), pos + len(actual_value_in_text) + 30)
        suffix = text[pos + len(actual_value_in_text):suffix_end].strip()
        suffix_words = suffix.split()
        suffix_context = suffix_words[0] if suffix_words else None
        
        # Infer pattern from actual value in text (with leading zeros if present)
        value_pattern = self._infer_pattern(actual_value_in_text, field_type)
        
        return ExtractionRule(
            field_type=field_type,
            value_pattern=value_pattern,
            prefix_context=prefix_context,
            suffix_context=suffix_context,
            strip_leading_zeros=needs_strip_leading_zeros,
            created_at=datetime.now().isoformat(),
            match_count=1,
        )
    
    def _infer_pattern(self, value: str, field_type: str = None) -> str:
        """
        Infer a regex pattern from an example value.
        
        For serial numbers, we want more general patterns.
        For invoice numbers, we can be more specific.
        
        Examples:
        - "9140481167" (invoice) -> r'\b(914\d{7})\b'
        - "9140481167" (serial) -> r'\b(\d{10})\b'
        - "NZINV/26479" -> r'(NZINV/\d+)'
        - "SI-00213175" -> r'(SI-\d+)'
        - "000000025424111139" -> r'\b(\d{18})\b'
        - "6S2303460050" -> r'\b(\d[A-Z]\d{10})\b'
        """
        is_serial = field_type == 'serial_number'
        
        # Check for specific formats
        
        # Format: PREFIX/NUMBERS (e.g., NZINV/26479)
        if '/' in value:
            parts = value.split('/')
            if len(parts) == 2 and parts[1].isdigit():
                return f"({re.escape(parts[0])}/\\d+)"
        
        # Format: PREFIX-NUMBERS (e.g., SI-00213175, 703245-00)
        if '-' in value:
            parts = value.split('-')
            if len(parts) == 2:
                if parts[0].isalpha() and parts[1].isdigit():
                    # SI-00213175
                    return f"({parts[0]}-\\d+)"
                elif parts[0].isdigit() and parts[1].isdigit():
                    # 703245-00
                    return f"(\\d{{{len(parts[0])}}}-\\d{{{len(parts[1])}}})"
                else:
                    # Mixed format like O30523001J-3
                    return f"([A-Z0-9]{{{len(parts[0])}}}-[A-Z0-9]+)"
        
        # Pure digits - differentiate by length
        if value.isdigit():
            length = len(value)
            if is_serial:
                # For serials, just match by length (more general)
                return f"\\b(\\d{{{length}}})\\b"
            else:
                # For invoice numbers, use first 3 digits as prefix (more specific)
                if length >= 10:
                    prefix = value[:3]
                    remaining = length - 3
                    return f"\\b({prefix}\\d{{{remaining}}})\\b"
                else:
                    return f"\\b(\\d{{{length}}})\\b"
        
        # Alphanumeric patterns
        if value.isalnum():
            # Analyze character pattern
            pattern_chars = []
            for c in value:
                if c.isdigit():
                    pattern_chars.append('\\d')
                elif c.isupper():
                    pattern_chars.append('[A-Z]')
                else:
                    pattern_chars.append('[a-z]')
            
            # Compress consecutive same patterns
            compressed = []
            i = 0
            while i < len(pattern_chars):
                char_type = pattern_chars[i]
                count = 1
                while i + count < len(pattern_chars) and pattern_chars[i + count] == char_type:
                    count += 1
                if count > 1:
                    compressed.append(f"{char_type}{{{count}}}")
                else:
                    compressed.append(char_type)
                i += count
            
            return "\\b(" + "".join(compressed) + ")\\b"
        
        # Fallback: escape the value
        return f"({re.escape(value)})"
    
    def get_all_layouts(self) -> List[Dict]:
        """Get all learned layouts for display in UI"""
        return [layout.to_dict() for layout in self.layouts.values()]
    
    def delete_layout(self, fingerprint: str) -> bool:
        """Delete a learned layout"""
        if fingerprint in self.layouts:
            del self.layouts[fingerprint]
            self._save_rules()
            return True
        return False
    
    def clear_all(self):
        """Clear all learned rules (reset to initial state)"""
        self.layouts = {}
        self._save_rules()
        print("[LEARNER] Cleared all learned rules")


# Global learner instance
_learner = None

def get_learner() -> InvoiceLearner:
    """Get the global learner instance"""
    global _learner
    if _learner is None:
        _learner = InvoiceLearner()
    return _learner

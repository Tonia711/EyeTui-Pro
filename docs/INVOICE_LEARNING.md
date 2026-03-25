# Adaptive Invoice Data Extraction System

> How EyeTui learns to extract invoice data from supplier-specific PDF layouts through user feedback

---

## Overview

EyeTui's invoice extraction system is adaptive and learns from user corrections. When users manually edit or provide invoice data, the system automatically analyzes the PDF layout and learns patterns for future extraction. This human-in-the-loop approach requires no pre-trained models or external training data, making it transparent, lightweight, and adaptable to custom invoice formats.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Learning Workflow](#learning-workflow)
3. [Layout Identification](#layout-identification)
4. [Extraction Rules](#extraction-rules)
5. [Rule Storage](#rule-storage)
6. [Implementation Details](#implementation-details)
7. [Adding New Suppliers](#adding-new-suppliers)

---

## Core Concepts

### Layout Profile

A **layout profile** represents a learned invoice template from a specific supplier. It contains:

- **Supplier Name**: Identifier for the invoice source (e.g., "Alcon Laboratories")
- **Fingerprint**: A hash-based signature of the PDF's visual structure (page dimensions, image positions, text structure)
- **Text Markers**: Unique text fragments that identify this supplier's invoices
- **Extraction Rules**: Learned patterns for extracting invoice numbers and serial numbers

### Extraction Rule

An **extraction rule** specifies how to extract a specific value (invoice number, serial number) from invoice text:

```json
{
  "field_type": "serial_number",
  "value_pattern": "\\b(\\d{10})\\b",
  "prefix_context": "Serial",
  "suffix_context": "#",
  "strip_leading_zeros": false,
  "match_count": 5
}
```

- **value_pattern**: Regex pattern matching the value format
- **prefix_context**: Text appearing before the value (helps disambiguate)
- **suffix_context**: Text appearing after the value
- **strip_leading_zeros**: Whether to remove leading zeros during extraction
- **match_count**: Statistics on how many times this rule successfully matched

### Fingerprint

The fingerprint is a lightweight signature identifying a PDF layout:

```
Features:
- Page 0: 595x842 (A4 dimensions)
- Image at: 0.05, 0.03, 0.15, 0.08 (normalized x0, y0, width, height)
- Image at: 0.85, 0.95, 0.10, 0.03
Hash: md5(sorted features)[0:16] = "a1b2c3d4e5f6g7h8"
```

This allows the system to recognize invoices with the same layout structure, even if minor text details change.

---

## Learning Workflow

### Step 1: Invoice Upload

User uploads a PDF invoice through the frontend:

```
User → Upload PDF → Backend: extract_text_and_layout()
```

The system extracts:
- Full text content from all pages
- Layout information (page dimensions, word coordinates, images)
- Generates a fingerprint and initial text markers

### Step 2: Layout Matching

The system checks if this PDF's layout has been seen before:

```python
layout = learner.find_matching_layout(fingerprint, text_markers, full_text)
```

**Matching strategy** (in priority order):

1. **Exact fingerprint match**: Same page dimensions + image positions = very high confidence
2. **Text marker overlap**: Key supplier text found in the PDF = moderate confidence

If a match is found, proceed to Step 3. If not, return empty extraction and wait for user input.

### Step 3: Automated Extraction (If Layout Recognized)

If the layout matches a known supplier, apply learned extraction rules:

```python
result = learner.extract_with_rules(text, layout)
# Returns: {
#   "supplier_name": "Alcon Laboratories",
#   "invoice_number": "INV-12345",
#   "serial_numbers": ["25424111139", "25424111140"],
#   "confidence": "high",
#   "used_learned_rules": true
# }
```

The system attempts to extract invoice numbers and serial numbers using regex patterns.

### Step 4: User Correction (If Extraction Incomplete or Wrong)

User reviews extracted data and manually corrects any errors. This user input is critical—the system uses it to learn and improve future extractions:

```
Frontend displays: {
  "supplier_name": [auto-filled, may be empty]
  "invoice_number": [auto-extracted or empty]
  "serial_numbers": [auto-extracted or empty]
}

User edits → Submits corrected values
```

### Step 5: Rule Learning

When user submits corrections, the system automatically learns extraction rules from the corrected values:

```python
learner.learn_from_correction(
    pdf_path=invoice_path,
    fingerprint=fingerprint,
    text_markers=text_markers,
    full_text=full_text,
    supplier_name="Alcon Laboratories",
    invoice_number="INV-12345",
    serial_numbers=["25424111139", "25424111140"],
    original_extracted={"invoice_number": None, "serial_numbers": []}
)
```

#### 5a. Layout Profile Creation/Update

If this is the first time seeing this layout:
- Create a new LayoutProfile with the supplier name and fingerprint
- Store enhanced text markers (supplier name + identifying text)

If layout already exists:
- Update last_modified timestamp
- Increment example_count
- Enhance text markers with any new supplier-identifying text

#### 5b. Rule Inference

For each corrected value, infer an extraction rule:

```python
invoice_number = "INV-12345"
# Find in text:
rule = _learn_value_pattern(full_text, invoice_number, "invoice_number")
# Result:
{
  "field_type": "invoice_number",
  "value_pattern": "(INV-\\d+)",
  "prefix_context": "Number",
  "suffix_context": ":",
  "strip_leading_zeros": false
}
```

The system infers patterns by:
1. Locating the value in the text
2. Capturing surrounding context (words before/after)
3. Determining if format variants exist (e.g., with leading zeros)
4. Building a regex that matches the format

#### 5c. Handling Serial Numbers with Leading Zeros

When a serial number like `000000025424111139` is extracted but user provides `25424111139`:

```python
# Detected leading zero variant in PDF
actual_value_in_text = "000000025424111139"
needs_strip_leading_zeros = True

rule = ExtractionRule(
    value_pattern=r'\b(\d{18})\b',
    strip_leading_zeros=True  # ← User will see values without leading zeros
)
```

Future extractions with this rule will remove leading zeros automatically.

### Step 6: Rule Storage

Learned rules are persisted to JSON for next application startup:

```json
{
  "version": "1.0",
  "updated_at": "2026-02-03T08:15:00",
  "layouts": {
    "a1b2c3d4e5f6g7h8": {
      "supplier_name": "Alcon Laboratories",
      "fingerprint": "a1b2c3d4e5f6g7h8",
      "text_markers": [
        "ALCON LABORATORIES (NEW ZEALAND) LIMITED",
        "INVOICE",
        "Auckland"
      ],
      "invoice_number_rules": [
        {
          "field_type": "invoice_number",
          "value_pattern": "(INV-\\d+)",
          "prefix_context": "Number"
        }
      ],
      "serial_number_rules": [
        {
          "field_type": "serial_number",
          "value_pattern": "\\b(\\d{11})\\b",
          "strip_leading_zeros": true
        }
      ],
      "created_at": "2026-02-01T10:00:00",
      "last_updated": "2026-02-03T08:15:00",
      "example_count": 5
    }
  }
}
```

---

## Layout Identification

### Fingerprint Generation

The fingerprint is computed from structural features, not content:

```python
def generate_fingerprint(pdf_path: str) -> Tuple[str, List[str], str]:
    features = []
    
    for page in pdf.pages[:2]:  # First 2 pages
        # Page dimensions
        w, h = page.width, page.height
        features.append(f"page{i}:{w:.0f}x{h:.0f}")
        
        # Image positions (company logos are layout-specific)
        for img in page.images[:3]:
            nx = img['x0'] / w  # Normalize to 0-1
            ny = img['top'] / h
            features.append(f"img:{nx:.2f},{ny:.2f}...")
    
    fingerprint = hashlib.md5("|".join(sorted(features))).hexdigest()[:16]
    return fingerprint
```

**Why fingerprints work:**
- Each supplier's invoice template has fixed page dimensions and logo positions
- Even if invoice numbers or dates change, the layout structure remains the same
- This allows recognition with extremely low false positive rates

### Text Marker Extraction

Text markers identify a supplier by unique content:

```python
# Look for company-identifying text in first 15 lines
text_markers = []
for line in text.split('\n')[:15]:
    line = line.strip()
    # Skip generic invoice terms
    if not any(skip in line.lower() for skip in ['invoice', 'date', 'total', 'phone', 'fax']):
        if 10 < len(line) < 100:
            text_markers.append(line)
```

**Examples of good text markers:**
- `"ALCON LABORATORIES (NEW ZEALAND) LIMITED"`
- `"Carl Zeiss (NZ) Ltd"`
- `"Toomac Holdings Ltd"`

These are unique enough to identify invoices from specific suppliers.

---

## Extraction Rules

### Pattern Learning

When user provides a corrected value, the system learns a pattern:

```python
def _infer_pattern(value: str, field_type: str = None) -> str:
    """
    Infer regex pattern from example value.
    
    Examples:
    - "INV-12345" → r"(INV-\d+)"
    - "SI-00213175" → r"(SI-\d+)"
    - "25424111139" → r"\b(\d{11})\b"
    - "000000025424111139" → r"\b(\d{18})\b" (with strip_leading_zeros=true)
    """
```

**Pattern inference rules:**

| Value Format | Inferred Pattern | Notes |
|--------------|------------------|-------|
| `INV-12345` | `(INV-\d+)` | Specific format with prefix |
| `25424111139` | `\b(\d{11})\b` | 11-digit numeric serial |
| `000000025424111139` | `\b(\d{18})\b` + `strip_leading_zeros=true` | Padded numeric with zeros |
| `6S2303460050` | `\b(\d[A-Z]\d{10})\b` | Mixed alphanumeric |
| `NZINV/26479` | `(NZINV/\d+)` | Custom separator format |

### Context-Based Extraction

Patterns are combined with surrounding context for better accuracy:

```python
# Pattern: \d{11}
# Context: prefix="Serial", suffix="Date"
# Text: "Serial #25424111139 Date 2026-02-03"
# Extraction: Finds "25424111139" successfully

# Without context, might match: "Your order 25424111139 was"
# Context helps disambiguate
```

---

## Rule Storage

### File Structure

Rules are stored in `backend/learned_rules.json`:

```
backend/
├── learned_rules.json  ← Persistent user-learned rules
├── default_rules.json  ← Shipped default rules for common suppliers
└── app/
    ├── invoice_learner.py   ← Learning engine
    └── invoice_extractor.py ← Text extraction
```

### Loading Rules

On startup, the system loads rules in order of preference:

```python
def _load_rules(self):
    # 1. Try to load from learned_rules.json (user's custom rules)
    if learned_rules_file.exists() and has_content():
        → Use learned rules
    
    # 2. Fall back to default_rules.json (shipped suppliers)
    elif default_rules_file.exists():
        → Use default rules
        → Copy to learned_rules.json for future updates
    
    # 3. Start fresh (no rules available)
    else:
        → Initialize empty, wait for first user correction
```

This ensures the system always has some rules available but respects user-learned customizations.

---

## Implementation Details

### Key Code Locations

| Component | File | Class/Function |
|-----------|------|-----------------|
| Extraction | `invoice_extractor.py` | `extract_text_from_pdf()` |
| Learning Engine | `invoice_learner.py` | `InvoiceLearner` class |
| Fingerprinting | `invoice_learner.py` | `generate_fingerprint()` |
| Pattern Inference | `invoice_learner.py` | `_infer_pattern()` |
| Rule Application | `invoice_learner.py` | `extract_with_rules()` |
| Rule Storage | `invoice_learner.py` | `_save_rules()` / `_load_rules()` |

### Test Coverage

```
backend/tests/
├── test_invoice_extractor.py  ← Text extraction tests
└── test_invoice_learner.py    ← Learning system tests
```

Run tests:

```bash
cd backend
pytest tests/test_invoice_learner.py -v
```

---

## Adding New Suppliers

### Manual Addition (For Initial Setup)

Add to `backend/default_rules.json`:

```json
{
  "layouts": {
    "fingerprint_hash_here": {
      "supplier_name": "New Supplier Ltd",
      "fingerprint": "fingerprint_hash_here",
      "text_markers": [
        "New Supplier Ltd",
        "INVOICE",
        "Company-specific text"
      ],
      "invoice_number_rules": [
        {
          "field_type": "invoice_number",
          "value_pattern": "(custom_pattern_here)"
        }
      ],
      "serial_number_rules": []
    }
  }
}
```

### Automatic Learning (Recommended)

1. Upload invoice from new supplier
2. System fails to match → returns empty extraction
3. User manually fills in fields and submits
4. System learns:
   - Generates fingerprint
   - Creates layout profile
   - Saves rules to `learned_rules.json`
5. Next invoice from same supplier → automatically recognized

---

## Advantages

✅ **Human-in-the-Loop**: Requires user feedback to learn—ensures accuracy and transparency  
✅ **No Training Data Required**: Learns from actual usage corrections  
✅ **Transparent**: All learned rules are human-readable regex patterns  
✅ **Lightweight**: No neural networks, minimal dependencies  
✅ **Adaptable**: Can learn custom invoice formats specific to your organization  
✅ **Reliable**: Fingerprinting + text markers = high-confidence matching  
✅ **Debuggable**: Can inspect and modify rules in JSON files  

---

## Limitations & Future Improvements

### Current Limitations

- **OCR Not Used for Extraction**: System relies on text already in PDF
  - Works well for text-based PDFs
  - May fail for scanned/image-only PDFs
  
- **Single Pattern Per Field**: One regex pattern per supplier per field
  - Works for most cases
  - May need multiple patterns for invoices with variable formats

### Future Improvements

- [ ] Support for multiple patterns per field (try each until one matches)
- [ ] OCR fallback for scanned invoices (image-based PDFs)
- [ ] ML-based confidence scoring for rule applicability
- [ ] Rule versioning and migration
- [ ] Pattern optimization from multiple examples

---

## See Also

- [README.md](../README.md) — System overview
- [SETUP.md](SETUP.md) — Development setup
- `backend/app/invoice_learner.py` — Implementation
- `backend/tests/test_invoice_learner.py` — Tests

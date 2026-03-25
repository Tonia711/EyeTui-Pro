# File Upload System - Presentation Script

## Introduction

Good [morning/afternoon], everyone. Today I'll be presenting our **Intelligent File Upload System** - a robust solution for processing Excel files with automatic column detection and data extraction.

---

## Slide 1: System Overview

Our file upload system supports **Excel files (.xlsx, .xls, .csv)** with an **intelligent column detection** mechanism that automatically identifies and extracts serial numbers, dates, models, and power information without requiring users to manually specify column names.

**Key Features:**
- Two upload methods: Click to browse or drag & drop
- Automatic column detection
- Support for multiple date formats
- Frontend and backend validation
- Batch upload capability

---

## Slide 2: Upload Methods

### Method 1: Click to Browse

Users click the "Browse Files" button to open the system file dialog.

**Implementation:**
- Uses standard HTML `<input type="file">` element
- Accepts: `.xlsx`, `.xls`, `.csv` files
- Hidden input with custom styled button

### Method 2: Drag & Drop

Users can drag files directly onto the upload area.

**Features:**
- Visual feedback during drag (border highlight, background color change)
- Automatic file type validation
- Seamless user experience

**Code Implementation:**
```typescript
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const droppedFile = e.dataTransfer.files[0];
  if (droppedFile && droppedFile.name.endsWith(".xlsx")) {
    handleFileChange(droppedFile);
  }
};
```

---

## Slide 3: File Processing Flow

### Step 1: File Reading

Uses **FileReader API** to read file content asynchronously:

```typescript
const reader = new FileReader();
reader.readAsArrayBuffer(selectedFile);
```

**Benefits:**
- Non-blocking UI
- Handles binary files efficiently
- Built-in error handling

### Step 2: Excel Parsing

Uses **XLSX (SheetJS)** library to parse Excel files:

```typescript
const workbook = XLSX.read(data, { type: "array" });
```

**Processing:**
1. Reads all worksheets (sheets)
2. Each sheet processed independently
3. Converts to JSON array format
4. Preserves original data types

**Configuration:**
- `header: 1`: Treats first row as array index
- `defval: ""`: Empty cells default to empty string

---

## Slide 4: Intelligent Column Detection

This is the **core feature** of our system - automatic column identification.

### 4.1 Header Row Detection

**Problem:** Excel files may contain title rows (like "New Arrival") that are not actual headers.

**Solution:**
- Checks if first row looks like a title
- Criteria: Few non-empty cells AND no "serial" keyword
- If title detected, uses second row as header

### 4.2 Serial Number Column Detection

**Method 1: Keyword Matching**
- Searches for: "serial number", "serial no", "serial no.", "sn"
- Case-insensitive matching
- Handles variations and whitespace

**Method 2: Intelligent Inference** (when keywords fail)
- Analyzes data content
- Scoring algorithm:
  - Length: 5-30 characters
  - Digit ratio: At least 50% digits
  - Frequency: More occurrences = higher score
- Selects column with highest score

### 4.3 Date Column Detection

**Keyword Matching:**
- "date", "received", "time", "day", "datetime", "created"
- Case-insensitive
- Handles variations

### 4.4 Model Column Detection

**Keyword Matching:**
- "model", "type", "brand"

**Intelligent Inference:**
- Contains letters
- Length: 3-20 characters
- Excludes known SN, date, power columns

### 4.5 Power Column Detection

**Keyword Matching:**
- "power", "se", "sphere", "diopter"

**Intelligent Inference:**
- Matches power format patterns
- Regex: `/[dD][\d\.\+\-]/i` or `/[\d\.\+\-][dD]/i`
- Examples: `+22.50D`, `D+22`, `-3.25D`

---

## Slide 5: Data Extraction

### 5.1 Date Parsing

Supports **multiple date formats**:

**Format 1: Excel Serial Number**
```typescript
// Excel date serial (days since 1900-01-01)
const excelEpoch = new Date(Date.UTC(1899, 11, 30));
const dt = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
```

**Format 2: Separator Dates**
- Supports: `/`, `.`, `-` as separators
- Examples: `01/08/2026`, `01.08.2026`, `01-08-2026`
- Auto-completes 2-digit years to 4-digit

**Format 3: ISO Format**
- Standard: `YYYY-MM-DD`
- Direct Date object parsing

**Date Inheritance:**
- Empty dates inherit from previous row
- If all rows empty, uses current date as default

### 5.2 Row Filtering

**Skips:**
1. **Header rows**: Contains "serial" or "sn"
2. **Empty rows**: All cells are empty
3. **Rows without SN**: Serial number column is empty

---

## Slide 6: Data Validation

### 6.1 Frontend Validation

**Validation Checks:**
1. **Serial Number Required**: Must have SN to add entry
2. **Date Format**: Must be valid date format
3. **Date Range**: Cannot be future date
4. **Local Duplicates**: Checks for duplicate serial numbers

**Implementation:**
```typescript
// Local duplicate check
const localMap = new Map<string, number>();
entries.forEach(item => 
  localMap.set(item.sn, (localMap.get(item.sn) || 0) + 1)
);

// Date validation
const todayStr = "YYYY-MM-DD";
entries.forEach(item => {
  if (item.date && item.date > todayStr) {
    futureDates.push(item.sn);
  }
});
```

### 6.2 Data Normalization

**Serial Number:**
- Converts to string
- Trims whitespace
- Handles null/undefined

**Date:**
- Standardizes to `YYYY-MM-DD` format
- Handles timezone issues (uses local date)

---

## Slide 7: Upload to Server

### 7.1 Upload Process

```typescript
const payload = {
  items: entries.map(item => ({
    serial_number: item.sn,
    received_date: item.date || undefined,
    model: item.model || undefined,
    power: item.power || undefined,
  })),
};

const res = await fetch(`${API_BASE_URL}/lens/bulk`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

### 7.2 Upload Features

**Batch Upload:**
- Uploads all entries in one request
- Reduces network overhead
- Improves efficiency

**Cancellable:**
- Uses AbortController
- Users can cancel long-running uploads

**Error Handling:**
- Network errors: Display error message
- Server errors: Show server response
- Cancellation: Show cancel message

**Duplicate Detection:**
- Server returns duplicate serial numbers
- Frontend displays duplicates
- Duplicates not added to database

---

## Slide 8: Backend Processing (Optional)

For InvoiceMatchingPanel, we also support backend Excel processing using Python's pandas library.

### Backend Flow

**API Endpoint:** `/extract-excel-serial-numbers`

**Process:**
1. **File Validation**: Checks file extension
2. **Read Excel**: Uses pandas `ExcelFile`
3. **Process Each Sheet**: Each sheet = one brand
4. **Column Matching**: Finds serial number column
5. **Data Extraction**: Extracts serial numbers
6. **Return Results**: Returns structured data

**Column Name Patterns:**
- "serial number", "serial no", "serial no."
- "sn", "s n", "s/n", "s-n"
- "product code", "item code" (fallback)

---

## Slide 9: Data Flow Diagram

```
User Action
  ↓
[Frontend] Select/Drag File
  ↓
[Frontend] FileReader Read (ArrayBuffer)
  ↓
[Frontend] XLSX Parse Excel
  ↓
[Frontend] Intelligent Column Detection
  ├─ Header Row Detection
  ├─ Serial Number Column (Keyword + Inference)
  ├─ Date Column Detection
  ├─ Model Column Detection
  └─ Power Column Detection
  ↓
[Frontend] Data Extraction
  ├─ Date Parsing (Multiple Formats)
  ├─ Row Filtering
  └─ Data Normalization
  ↓
[Frontend] Data Validation
  ├─ Local Duplicate Check
  ├─ Date Format Validation
  └─ Date Range Validation
  ↓
[Frontend] Add to Entries List (Display in Table)
  ↓
[Frontend] User Confirmation/Editing
  ↓
[Frontend] Batch Upload to Server
  ↓
[Backend] Server Validation & Processing
  ├─ Database Duplicate Check
  ├─ Data Insertion
  └─ Return Result (Success IDs + Duplicates)
  ↓
[Frontend] Display Upload Result
```

---

## Slide 10: Key Technical Features

### 1. Intelligent Column Detection

- **Keyword Matching**: Priority for exact matches
- **Smart Inference**: Analyzes data content when keywords fail
- **Multi-Column Support**: Auto-identifies SN, date, model, power columns

### 2. Flexible Date Handling

- **Multiple Formats**: Excel serial, separator dates, ISO format
- **Auto-Completion**: 2-digit years to 4-digit
- **Date Inheritance**: Empty dates use previous row's date

### 3. Data Validation

- **Frontend Validation**: Reduces invalid requests
- **Backend Validation**: Ensures data integrity
- **Duplicate Detection**: Local and server double-check

### 4. User Experience

- **Drag & Drop**: Convenient and fast
- **Real-time Feedback**: Shows processing progress
- **Error Messages**: Clear error information
- **Editable**: Users can edit extracted data

### 5. Performance Optimization

- **Frontend Parsing**: Reduces server load
- **Batch Upload**: Upload all data in one request
- **Cancellable**: Support for canceling long uploads

---

## Slide 11: Supported Excel Formats

### Column Name Variants

**Serial Number:**
- Serial Number, Serial No., Serial No, Serial
- SN, S N, S/N, S-N
- Product Code, Item Code (fallback)

**Date:**
- Date, Received Date, Received
- Time, DateTime, Day
- Created, Created Date

**Model:**
- Model, Type, Brand

**Power:**
- Power, SE, Sphere, Diopter

### File Structure

**Supported Structures:**
1. **Standard**: First row is header, data starts from second row
2. **With Title Row**: First row is title (e.g., "New Arrival"), second row is header
3. **Multiple Sheets**: Each sheet processed independently
4. **Mixed Data**: Can contain empty rows, header rows, etc.

---

## Slide 12: Error Handling

### Frontend Errors

1. **File Read Failure**
   - Message: `"Failed to read file. Please try again."`

2. **Excel Parse Failure**
   - Message: `"Error reading Excel file: [error details]"`

3. **No Serial Numbers Found**
   - Message: `"No serial numbers found in Excel. Please check the file format."`

4. **Local Duplicates**
   - Shows duplicate serial number list
   - Blocks upload

5. **Invalid Dates**
   - Shows future date serial numbers
   - Blocks upload

### Backend Errors

1. **Invalid File Type**
   - Returns: `"Invalid file type"`

2. **Serial Number Column Not Found**
   - Returns: `"Could not find 'Serial Number' or 'Serial No.' column"`

3. **Processing Failure**
   - Returns: `"Failed to process Excel file. Please check the file format."`

---

## Slide 13: Example

### Excel File Example

| Serial Number | Received Date | Type | Power |
|--------------|---------------|------|-------|
| 50483779011  | 2026-01-08    | DCB00| +22.5D|
| 50483779012  | 2026-01-08    | DCB00| +23.0D|

**System Automatically:**
1. Identifies Serial Number column
2. Identifies Received Date column
3. Identifies Type column
4. Identifies Power column
5. Extracts all data rows
6. Validates data
7. Prepares for upload

---

## Slide 14: Summary

Our file upload system achieves **intelligent Excel processing** through:

1. ✅ Automatic column structure identification
2. ✅ Support for multiple column name variants
3. ✅ Handling various date formats
4. ✅ Frontend and backend dual validation
5. ✅ Excellent user experience and error handling

This is a **production-grade Excel file processing solution**, specifically optimized for complex medical device serial number management scenarios.

---

## Q&A

Thank you for your attention. I'm happy to answer any questions.

---

## Additional Notes for Presenter

### Key Points to Emphasize:

1. **Intelligent Column Detection**: Explain how the system automatically finds columns without user input
2. **Multiple Date Formats**: Show flexibility in handling different date formats
3. **Validation**: Emphasize frontend and backend validation for data integrity
4. **User Experience**: Highlight drag & drop and real-time feedback
5. **Error Handling**: Show comprehensive error messages

### Demo Suggestions:

1. Show drag & drop in action
2. Demonstrate with different Excel formats
3. Show column detection with various column names
4. Display date parsing with different formats
5. Show error handling scenarios
6. Demonstrate batch upload

### Technical Deep Dive (if asked):

- Explain the scoring algorithm for column detection
- Detail the date parsing logic
- Discuss the validation strategy
- Explain the batch upload mechanism

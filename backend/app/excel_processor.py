"""
Excel Serial Number Extraction Module
Extracts serial numbers from Excel files with multiple sheets (brands)
"""
import pandas as pd
import io
from typing import List, Dict, Any


def process_excel_file(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Process Excel file and extract serial numbers from all sheets.
    Each sheet represents a different brand.
    
    Args:
        file_content: Raw bytes of the Excel file
        
    Returns:
        List of dictionaries containing:
        - serial_number: str
        - sheet_name: str (brand name)
    """
    extracted_data = []
    
    try:
        # Read Excel file from bytes
        xls = pd.ExcelFile(io.BytesIO(file_content))
        
        # Process each sheet (each sheet = one brand)
        for sheet_name in xls.sheet_names:
            # First, try to read and check if the first row looks like a title
            df_peek = pd.read_excel(xls, sheet_name=sheet_name, nrows=2)
            
            # Check if first row might be a title (like "Used_lens")
            skip_rows = 0
            if not df_peek.empty:
                first_row_cols = df_peek.columns.astype(str).str.strip().str.lower()
                # If columns don't contain 'serial', might need to skip first row
                has_serial = any('serial' in col for col in first_row_cols)
                if not has_serial and len(df_peek) > 0:
                    # Check if second row (first data row) has 'serial' in it
                    second_row = df_peek.iloc[0].astype(str).str.strip().str.lower()
                    if any('serial' in val for val in second_row):
                        skip_rows = 1
            
            # Read the sheet with correct header row, treating all columns as strings to preserve leading zeros
            df = pd.read_excel(xls, sheet_name=sheet_name, skiprows=skip_rows, dtype=str)
            
            # Skip empty sheets
            if df.empty:
                continue
            
            # Clean column names: strip whitespace and convert to lowercase
            df.columns = df.columns.astype(str).str.strip().str.lower()
            
            # Debug: print available columns
            print(f"Sheet: {sheet_name}")
            print(f"Available columns: {list(df.columns)}")
            
            # Try to find serial number column by matching header name
            serial_col = None
            for col in df.columns:
                col_cleaned = col.replace('.', '').replace('/', '').replace('-', '').replace('_', ' ').strip().lower()
                print(f"Checking column: '{col}' -> cleaned: '{col_cleaned}'")
                
                # Match various patterns:
                # 1. "serial number", "serial no", "serial no."
                if 'serial' in col_cleaned and ('number' in col_cleaned or 'no' in col_cleaned or col_cleaned == 'serial'):
                    serial_col = col
                    print(f"✓ Matched serial column: {col}")
                    break
                # 2. Just "sn" or variations
                elif col_cleaned in ['sn', 's n', 's/n', 's-n']:
                    serial_col = col
                    print(f"✓ Matched serial column (SN): {col}")
                    break
                # 3. "product code", "item code", "code" as fallback (for some formats)
                elif any(pattern in col_cleaned for pattern in ['product code', 'item code', 'item no', 'part no', 'model no']):
                    serial_col = col
                    print(f"✓ Matched serial column (code): {col}")
                    break
            
            # If no matching column found, try harder: use first non-empty column
            if not serial_col and not df.empty:
                print(f"⚠ No standard serial column found. Trying first non-empty column...")
                # Get first column with non-null values
                for col in df.columns:
                    if df[col].notna().any():
                        serial_col = col
                        print(f"⚠ Using first available column: {col}")
                        break
            
            # If still no column found, skip this sheet
            if not serial_col:
                print(f"✗ No serial column found in sheet: {sheet_name}")
                print(f"   Available columns: {list(df.columns)}")
                continue
            
            print(f"Using column: {serial_col}")
            
            # Extract data from rows
            for _, row in df.iterrows():
                # Get serial number
                sn = str(row[serial_col]).strip()
                
                # Skip empty, NaN, or invalid serial numbers
                if not sn or sn.lower() in ['nan', 'none', '']:
                    continue
                
                # Add to results
                extracted_data.append({
                    'serial_number': sn,
                    'sheet_name': sheet_name
                })
                    
    except Exception as e:
        # Return the actual exception message to help with debugging
        error_detail = str(e) if str(e) else "Unknown error while processing Excel file"
        raise Exception(f"Failed to read Excel file: {error_detail}")
    
    return extracted_data

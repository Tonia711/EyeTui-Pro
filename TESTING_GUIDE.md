# Excel Upload Feature - Fix Verification Steps

## Issue Fix Summary

Fixed: When the Type column in Excel contains "SN" prefix (e.g., "SN60WF"), the row was being incorrectly skipped.

Fix Location: `extractItemsFromSheet` function in `frontend/components/ReceivePanel.tsx` (line 570)

## Testing Steps

### Method 1: Using Provided Test File

1. Create an Excel file with the following content:

```
#  | Serial Number  | Type    | Company             | Power   | Received Date
1  | 25424111139    | CNWTT0  | Alcon               | +19.0D  | 15/12/2025
2  | 25579955045    | CNWTT3  | Alcon               | +22.0D  | 15/12/2025
3  | 16014350048    | SN60WF  | (empty)             | +20.0D  | 15/12/2025  ← Key test row
4  | TQ21273723     | DEN00V  | Johnson & Johnson   | +12.5D  | 15/12/2025
```

2. Upload this file
3. **Verify**: `16014350048` should appear in the read list (previously it was skipped)

### Method 2: Using Your Own Actual File

1. Upload your `new_arrival_3.xlsx` file
2. **Verify**: All Serial Numbers (including 16014350048) should be read

## Expected Results

- ✅ All 4 rows of data should be read
- ✅ Especially row 3 containing "SN60WF" will no longer be skipped
- ✅ Other functionalities (date parsing, company selection, etc.) remain unchanged

## Technical Details

The old detection logic only checked if the string contains "sn", causing Types like "SN60WF" to be misidentified as headers.

New logic:

- Checks if multiple cells contain header keywords (serial/date/type/company/power/number/received)
- Only considers it a header row when more than one cell contains these keywords
- Or requires "serial" and "number" to appear together
- This distinguishes between actual header rows and data rows containing "SN" prefix

## If You Need Help

- If upload still has issues, check the browser developer tools console for other errors
- Ensure the Excel file format is correct (column names must include a variant of "Serial Number" or "SN")

# New User Onboarding Guide

This guide is for first-time users who need to learn how to use the system step by step.

## 1) What this system does

The platform tracks intraocular lens (IOL) products from receiving to usage and invoice reconciliation.

Main pages:

- **Lens Receiving**
- **Lens Usage & Invoice Reconciliation**
- **Lens Inventory**
- **Invoice List**
- **Settings**

## 2) First-time setup checklist

Before daily operations:

1. Open **Settings**.
2. Confirm base master data exists:
   - Supplier
   - Company (manufacturer)
   - Lens Type
   - Site/Clinic
3. If missing, create them first.

Why this matters:

- Receiving and reconciliation rely on clean master data.
- Unknown lens type/company often causes manual correction work.

## 3) Daily workflow (recommended order)

### Step A - Receive lenses

Go to **Lens Receiving**:

- Use barcode scan or Excel upload.
- Select the correct clinic/site before upload.
- Confirm serial numbers are captured.

If recognition fails:

- Use Learning Mode (manual correction) where available.
- Add missing company/lens type in Settings, then retry.

### Step B - Upload used lens records

Go to **Lens Usage & Invoice Reconciliation**:

- Upload usage Excel file.
- Verify extracted serial numbers and dates.

### Step C - Upload invoice PDF and reconcile

In the same reconciliation module:

- Upload supplier invoice PDF.
- Review extraction output.
- Use Edit/Learn if the invoice layout is new or extracted incorrectly.

### Step D - Verify results

- Check unmatched rows and unmatched invoice numbers.
- Export reconciliation results if needed.

### Step E - Review inventory

Go to **Lens Inventory**:

- Search by serial number.
- Filter by site, company, lens type, status.
- Verify stock and usage status.

## 4) How to read key statuses

- **In stock**: lens exists and is not marked used.
- **Used**: lens has been consumed.
- **Matched**: record is matched in reconciliation.
- **Unmatched**: not yet matched; needs review.

Important:

- Inventory status and reconciliation status are different dimensions.

## 5) How to investigate common issues

### “No product found with serial number ...”

- Check serial number formatting.
- Check if lens was actually received.
- Check for typing or OCR errors.

### “Which invoices are problematic?”

- Problematic means invoice rows that are unmatched.
- Unmatched invoice rows != unmatched invoice numbers.

### “Database connection refused”

- Ensure PostgreSQL is running.
- Verify `DATABASE_URL` in `backend/.env`.

## 6) Suggested questions for chatbot

- “How do I receive lenses from Excel?”
- “How do I reconcile invoice PDFs?”
- “What does unmatched invoice rows mean?”
- “How can I find a lens by serial number?”
- “How do I set up supplier and lens type for new users?”

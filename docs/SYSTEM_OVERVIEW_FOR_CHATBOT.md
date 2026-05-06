# System Overview

This platform is the **Auckland Eye IOL Tracking and Reconciliation Platform**.

## Core Modules

- **Lens Receiving**: register new lenses by barcode scan or Excel upload.
- **Lens Usage & Invoice Reconciliation**: upload used-lens records and supplier invoice PDFs, then compare and reconcile.
- **Lens Inventory**: view and filter stock across clinics.
- **Invoice List**: browse invoice records and invoice-to-lens matching status.
- **Settings**: maintain master data such as supplier, company, lens type, and clinic/site.

## End-to-End Workflow

1. Add master data in Settings (company, lens type, site, supplier) if needed.
2. Receive lenses into inventory (serial number is the business key).
3. Upload usage records when lenses are used.
4. Upload invoice data and perform reconciliation.
5. Review unmatched records and correct data if required.

## Important Data Concepts

- One lens is identified by one **serial number**.
- A single invoice number can contain multiple serial numbers.
- Reconciliation depends on matching serial numbers across lens and invoice records.
- Inventory and reconciliation statuses are related but not identical.

## Status Terms

- **In stock**: lens exists and is not used.
- **Used**: lens has been marked as used.
- **Matched**: lens or invoice row is matched by reconciliation logic.
- **Unmatched**: missing or not matched in reconciliation.

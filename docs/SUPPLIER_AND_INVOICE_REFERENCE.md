# Supplier and Invoice Reference

This document explains supplier and invoice concepts for chatbot and user guidance.

## Supplier

- A supplier is a vendor that provides lens products.
- Suppliers are maintained in Settings.
- In reports and invoice list, supplier name is shown for each invoice group.

## Invoice Model

The system stores invoice data in a row-based structure:

- `invoice_number`: logical invoice ID.
- `serial_number`: one row per serial number on the invoice.
- `supplier_id`: optional link to supplier table.
- `upload_date`: when invoice row was recorded.

## Key Behavior

- One invoice number can include multiple serial numbers.
- Invoice detail views aggregate rows by invoice number.
- Reconciliation checks whether invoice serial numbers can be matched with lens records.

## Typical Invoice Queries

- Show invoice details for invoice number `X`.
- Find invoice by serial number `Y`.
- Which invoices are problematic or unmatched?
- How many unmatched invoice rows exist?
- How many unmatched invoice numbers exist?

## Problematic Invoice Meaning

An invoice row is considered problematic when:

- no corresponding lens serial number exists, or
- corresponding lens exists but reconciliation status is not matched.

So:

- **Unmatched invoice rows** = unmatched serial number entries.
- **Unmatched invoice numbers** = count of distinct invoice numbers containing unmatched rows.

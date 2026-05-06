# Lens Product Reference

This document describes lens product fields and business meanings used by the system.

## Lens Entity (Core)

Each lens record includes:

- `serial_number`: unique identifier (business key).
- `type_id` / `type`: lens model or lens type.
- `company`: manufacturer.
- `power`: lens power value such as `+21.0D`, `Plano`, `-3.50D`.
- `site_id` / `site`: clinic location currently holding the lens.
- `received_date`: when lens was received.
- `is_used`: whether lens has been used.
- `is_matched`: reconciliation status.
- `invoice_id`: linked invoice row reference (if any).

## Product Lifecycle

1. **Received**: lens enters the system via scan/upload.
2. **Stored in inventory**: lens is available in a clinic site.
3. **Used**: lens is consumed in surgery or procedure.
4. **Invoiced / reconciled**: invoice records are linked by serial number.

## Common Lens Questions

- Does serial number `SN123...` exist?
- Which clinic currently holds a lens?
- How many lenses are in stock?
- How many lenses are used?
- How many lenses are matched or unmatched?

## Data Quality Notes

- Duplicate serial numbers should be prevented.
- Unknown company or lens type should be configured in Settings first.
- If recognition fails during receiving, Learning Mode can help improve future extraction.

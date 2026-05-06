# Inventory and Clinic Operations

This document covers inventory filtering and clinic movement workflows.

## Inventory View

Users can search or filter by:

- serial number
- lens type
- power
- company
- status (used, matched, unmatched, etc.)
- clinic/site

## Inventory Metrics

Common summary metrics:

- total lenses
- in-stock lenses
- used lenses
- matched lenses
- unmatched lenses

These metrics may overlap by dimension (inventory status vs reconciliation status).

## Clinic / Site Concepts

- A site (clinic) represents physical storage or usage location.
- Lenses are assigned to a site when received.
- Lenses can be moved between clinics as an operational action.
- Site list can be managed in Settings.

## Common Operations

1. Receive lens to a selected clinic.
2. Search lens by serial number.
3. Filter inventory by clinic to review local stock.
4. Move lens from clinic A to clinic B.
5. Check whether lenses in invoice are used/matched.

## Troubleshooting Hints

- If expected lens is missing, verify serial number format.
- If site is not found, confirm site exists in Settings.
- If inventory count seems inconsistent, compare used status and matched status separately.

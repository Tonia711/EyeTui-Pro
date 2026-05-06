#!/usr/bin/env python3
"""
Create synthetic Invoice rows that reference existing Lens serial numbers.

In this schema, one logical invoice is many DB rows with the same invoice_number
and one serial_number each (see POST /invoice/save). Each row is linked back to
inventory by matching Lens.serial_number; optionally sets Lens.invoice_id.

Usage (from backend/):

  python seed_invoice_demo.py --invoices 20
  python seed_invoice_demo.py --invoices 10 --min-per-invoice 3 --max-per-invoice 10
  python seed_invoice_demo.py --serial-prefix SEED- --mark-matched
"""

from __future__ import annotations

import argparse
import random
import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Invoice, Lens, Supplier


DEMO_SUPPLIER = "__Demo_Supplier_Seed__"


def ensure_demo_supplier(db) -> int:
    row = db.execute(select(Supplier).where(Supplier.name == DEMO_SUPPLIER)).scalar_one_or_none()
    if row is None:
        row = Supplier(name=DEMO_SUPPLIER)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row.id


def load_eligible_lenses(
    db,
    *,
    serial_prefix: str | None,
    skip_if_sn_in_invoice_table: bool,
    require_invoice_id_null: bool,
):
    q = select(Lens)
    if serial_prefix:
        q = q.where(Lens.serial_number.startswith(serial_prefix))
    if require_invoice_id_null:
        q = q.where(Lens.invoice_id.is_(None))

    lenses = db.execute(q).scalars().all()

    if skip_if_sn_in_invoice_table:
        invoiced = set(db.execute(select(Invoice.serial_number)).scalars().all())
        if invoiced:
            lenses = [ln for ln in lenses if ln.serial_number not in invoiced]

    return list(lenses)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Invoice rows tied to existing Lens serial numbers."
    )
    parser.add_argument(
        "--invoices",
        type=int,
        default=20,
        help="Maximum number of logical invoices (groups) to create.",
    )
    parser.add_argument("--min-per-invoice", type=int, default=2, help="Min lenses per invoice.")
    parser.add_argument("--max-per-invoice", type=int, default=7, help="Max lenses per invoice.")
    parser.add_argument(
        "--serial-prefix",
        type=str,
        default=None,
        help="Only use lenses whose serial_number starts with this string (e.g. SEED-).",
    )
    parser.add_argument(
        "--include-existing-sn",
        action="store_true",
        help="Allow lenses whose serial already appears on an Invoice row (default: skip them).",
    )
    parser.add_argument(
        "--allow-overwrite-invoice-id",
        action="store_true",
        help="Include lenses that already have invoice_id set (default: only invoice_id IS NULL).",
    )
    parser.add_argument(
        "--mark-matched",
        action="store_true",
        help="Set is_matched=True on lenses when linking (optional, for reconciliation demos).",
    )
    parser.add_argument("--seed", type=int, default=None, help="Random seed.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print how many lenses would be used and exit.",
    )
    args = parser.parse_args()

    if args.invoices < 1:
        raise SystemExit("--invoices must be >= 1")
    if args.min_per_invoice < 1 or args.max_per_invoice < args.min_per_invoice:
        raise SystemExit("Invalid --min-per-invoice / --max-per-invoice")

    rng = random.Random(args.seed)
    tag = uuid.uuid4().hex[:8].upper()

    db = SessionLocal()
    try:
        lenses = load_eligible_lenses(
            db,
            serial_prefix=args.serial_prefix,
            skip_if_sn_in_invoice_table=not args.include_existing_sn,
            require_invoice_id_null=not args.allow_overwrite_invoice_id,
        )
        rng.shuffle(lenses)

        if args.dry_run:
            print(
                f"Dry run: {len(lenses)} eligible lens(es); "
                f"would create up to {args.invoices} logical invoice(s)."
            )
            return

        if not lenses:
            raise SystemExit(
                "No eligible lenses. Seed inventory first, widen filters, "
                "or pass --include-existing-sn / --allow-overwrite-invoice-id if appropriate."
            )

        supplier_id = ensure_demo_supplier(db)

        invoice_lines = 0
        logical_created = 0
        ptr = 0

        while ptr < len(lenses) and logical_created < args.invoices:
            size = rng.randint(args.min_per_invoice, args.max_per_invoice)
            chunk = lenses[ptr : ptr + size]
            if not chunk:
                break
            ptr += len(chunk)
            logical_created += 1

            inv_no = f"SEED-INV-{tag}-{logical_created:04d}"
            upload_date = date.today() - timedelta(days=rng.randint(0, 120))

            for ln in chunk:
                inv = Invoice(
                    upload_date=upload_date,
                    invoice_number=inv_no,
                    serial_number=ln.serial_number,
                    supplier_id=supplier_id,
                )
                db.add(inv)
                db.flush()
                ln.invoice_id = inv.id
                if args.mark_matched:
                    ln.is_matched = True
                invoice_lines += 1

            db.commit()

        print(
            f"Done. Created {logical_created} logical invoice(s), "
            f"{invoice_lines} invoice line(s), supplier_id={supplier_id}."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()

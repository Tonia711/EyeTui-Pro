#!/usr/bin/env python3
"""
Insert synthetic Lens rows for local demos. Uses existing lens_type / site rows
when present; otherwise creates a minimal Company + LensType + Site.

Usage (from backend/):

  python seed_inventory_demo.py --count 200
  python seed_inventory_demo.py --count 500 --all-received

Then link invoices to those serials: python seed_invoice_demo.py --serial-prefix SEED-
"""

from __future__ import annotations

import argparse
import random
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Company, Lens, LensType, Site


def _random_received_date(rng: random.Random) -> date:
    days_ago = rng.randint(1, 150)
    return date.today() - timedelta(days=days_ago)


def ensure_reference_data(db):
    demo_company_name = "__Demo_Manufacturer_Seed__"
    demo_type_name = "__Demo_Model_Seed__"
    demo_site_name = "__Demo_Clinic_Seed__"

    sites = db.execute(select(Site.id)).scalars().all()
    types = db.execute(select(LensType.id)).scalars().all()

    created = False
    if not types:
        company = db.execute(
            select(Company).where(Company.name == demo_company_name)
        ).scalar_one_or_none()
        if company is None:
            company = Company(name=demo_company_name)
            db.add(company)
            db.flush()

        lt = db.execute(
            select(LensType).where(LensType.name == demo_type_name)
        ).scalar_one_or_none()
        if lt is None:
            db.add(LensType(name=demo_type_name, company_id=company.id))
            created = True
        db.flush()

    if not sites:
        st = db.execute(select(Site).where(Site.name == demo_site_name)).scalar_one_or_none()
        if st is None:
            db.add(Site(name=demo_site_name))
            created = True

    if created:
        db.commit()

    sites = db.execute(select(Site.id)).scalars().all()
    types = db.execute(select(LensType.id)).scalars().all()
    return sites, types


def build_lenses(count: int, site_ids: list[int], type_ids: list[int], rng: random.Random, all_received: bool):
    powers = ["+21.0D", "+20.5D", "-3.50D", "-2.75D", "Plano", "+6.00D", "+7.50D", "-12.25D"]
    rows: list[Lens] = []
    prefix = uuid.uuid4().hex[:8].upper()

    for i in range(count):
        sn = f"SEED-{prefix}-{i:06d}-{uuid.uuid4().hex[:6].upper()}"

        is_used = False
        is_matched = False
        used_date = None
        move_from = None

        if not all_received:
            roll = rng.random()
            if roll < 0.12:
                is_used = True
                is_matched = rng.random() < 0.85
                used_dt = date.today() - timedelta(days=rng.randint(1, 90))
                used_date = used_dt if is_used else None
                if rng.random() < 0.4:
                    move_from = rng.choice(["North Clinic", "South Clinic", "Central Hub", None])
                if move_from is None and rng.random() < 0.25:
                    move_from = "Transferred Site A"
            elif roll < 0.42:
                is_matched = True

        rows.append(
            Lens(
                serial_number=sn,
                received_date=_random_received_date(rng),
                used_date=used_date,
                is_used=is_used,
                is_matched=is_matched,
                type_id=rng.choice(type_ids),
                power=rng.choice(powers),
                site_id=rng.choice(site_ids),
                invoice_id=None,
                move_from_clinic=move_from,
            )
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed synthetic Lens inventory rows.")
    parser.add_argument("--count", type=int, default=150, help="How many Lens rows to add.")
    parser.add_argument(
        "--all-received",
        action="store_true",
        help="All rows: not used / not matched (pure stock).",
    )
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility.")
    args = parser.parse_args()

    if args.count < 1:
        raise SystemExit("--count must be >= 1")

    rng = random.Random(args.seed)
    db = SessionLocal()
    try:
        site_ids, type_ids = ensure_reference_data(db)
        if not site_ids or not type_ids:
            raise SystemExit("No sites or lens types available and failed to create demo rows.")

        batch = build_lenses(
            args.count,
            site_ids=list(site_ids),
            type_ids=list(type_ids),
            rng=rng,
            all_received=args.all_received,
        )

        inserted = 0
        chunk = 400
        for i in range(0, len(batch), chunk):
            slice_ = batch[i : i + chunk]
            db.add_all(slice_)
            try:
                db.commit()
                inserted += len(slice_)
            except IntegrityError:
                db.rollback()
                # Fall back row-by-row only for this slice (duplicate SN is unlikely).
                for row in slice_:
                    db.add(row)
                    try:
                        db.commit()
                        inserted += 1
                    except IntegrityError:
                        db.rollback()

        print(f"Done. Inserted {inserted} lens row(s); requested {args.count}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

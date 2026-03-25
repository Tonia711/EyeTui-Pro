from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_main_helpers__get_or_create_company_supplier_type_site(tmp_path):
    import app.main as main
    from app.models import Company, LensType, Site, Supplier

    engine = create_engine(f"sqlite+pysqlite:///{tmp_path/'db.sqlite'}")
    # Create only the tables needed by these helpers (avoid unrelated tables/indexes).
    Company.__table__.create(bind=engine)
    Supplier.__table__.create(bind=engine)
    Site.__table__.create(bind=engine)
    LensType.__table__.create(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    db = Session()
    try:
        c1 = main.get_or_create_company(db, "  Acme  ")
        c2 = main.get_or_create_company(db, "ACME")
        assert c1 is not None and c2 is not None
        assert c1.id == c2.id
        assert db.query(Company).count() == 1

        s1 = main.get_or_create_supplier(db, " SupplierX ")
        s2 = main.get_or_create_supplier(db, "supplierx")
        assert s1 is not None and s2 is not None
        assert s1.id == s2.id
        assert db.query(Supplier).count() == 1

        t1 = main.get_or_create_type(db, "DCB00", c1)
        t2 = main.get_or_create_type(db, "dcb00", c1)
        assert t1 is not None and t2 is not None
        assert t1.id == t2.id
        assert db.query(LensType).count() == 1

        site1 = main.get_or_create_site(db, " Clinic A ")
        site2 = main.get_or_create_site(db, "clinic a")
        assert site1 is not None and site2 is not None
        assert site1.id == site2.id
        assert db.query(Site).count() == 1
    finally:
        db.close()



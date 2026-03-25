from datetime import date


def test_models__lens_properties_type_site_company():
    from app.models import Company, Lens, LensType, Site

    c = Company(name="ACME")
    t = LensType(name="DCB00", company=c, company_id=1)
    s = Site(name="Clinic A")

    lens = Lens(serial_number="SN1", lens_type=t, site_ref=s)

    assert lens.type == "DCB00"
    assert lens.site == "Clinic A"
    assert lens.company == "ACME"


def test_models__invoice_supplier_name_property():
    from app.models import Invoice, Supplier

    sup = Supplier(name="SupplierX")
    inv = Invoice(invoice_number="INV1", serial_number="SN", upload_date=date(2025, 1, 1), supplier=sup)
    assert inv.supplier_name == "SupplierX"


def test_models__repr_methods_and_company_none_branches():
    from app.models import Company, Invoice, Lens, LensType, Site, Supplier

    # __repr__ coverage
    c = Company(name="ACME")
    s = Supplier(name="SUP")
    site = Site(name="Clinic A")
    lt = LensType(name="DCB00", company=c, company_id=1)

    assert "Company" in repr(c)
    assert "Supplier" in repr(s)
    assert "Site" in repr(site)
    assert "LensType" in repr(lt)

    # Lens.company None branches
    lens1 = Lens(serial_number="SN1")
    assert lens1.company is None

    lens2 = Lens(serial_number="SN2", lens_type=LensType(name="X", company=None, company_id=1))
    assert lens2.company is None

    # Invoice.__repr__ hits supplier_name property (supplier can be None)
    inv = Invoice(invoice_number="INV", serial_number="SN", upload_date=date(2025, 1, 1), supplier=None)
    assert "Invoice" in repr(inv)



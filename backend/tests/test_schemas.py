from datetime import date


def test_schemas__invoice_extracted_data__serial_numbers_not_shared_between_instances():
    from app.schemas import InvoiceExtractedData

    a = InvoiceExtractedData(file_name="a.pdf")
    b = InvoiceExtractedData(file_name="b.pdf")
    a.serial_numbers.append("X")
    assert b.serial_numbers == []


def test_schemas__lens_create_accepts_optional_fields():
    from app.schemas import LensCreate

    obj = LensCreate(serial_number="SN1", received_date=date(2025, 1, 1), is_used=False)
    assert obj.serial_number == "SN1"
    assert obj.received_date == date(2025, 1, 1)
    assert obj.is_used is False



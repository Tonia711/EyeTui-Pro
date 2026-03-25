import json


class _FakePage:
    def __init__(self, width=100.0, height=200.0, text="", images=None):
        self.width = width
        self.height = height
        self._text = text
        self.images = images or []

    def extract_text(self):
        return self._text


class _FakePDF:
    def __init__(self, pages):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_invoice_learner__infer_pattern_examples(tmp_path):
    from app.invoice_learner import InvoiceLearner

    l = InvoiceLearner(rules_file=tmp_path / "rules.json")
    assert l._infer_pattern("NZINV/26479") == r"(NZINV/\d+)"
    assert l._infer_pattern("SI-00213175") == r"(SI-\d+)"
    assert l._infer_pattern("9140481167", field_type="invoice_number") == r"\b(914\d{7})\b"
    assert l._infer_pattern("9140481167", field_type="serial_number") == r"\b(\d{10})\b"
    assert l._infer_pattern("6S2303460050", field_type="serial_number") == r"\b(\d[A-Z]\d{10})\b"


def test_invoice_learner__generate_fingerprint_and_markers(monkeypatch, tmp_path):
    import app.invoice_learner as mod

    fake_pdf = _FakePDF(
        pages=[
            _FakePage(
                width=600,
                height=800,
                text="ACME SUPPLIES LTD\nINVOICE\nTotal\nSome Unique Header Text",
                images=[{"x0": 0, "top": 0, "width": 100, "height": 50}],
            )
        ]
    )

    monkeypatch.setattr(mod.pdfplumber, "open", lambda _p: fake_pdf)

    learner = mod.InvoiceLearner(rules_file=tmp_path / "rules.json")
    fp, markers, full_text = learner.generate_fingerprint("dummy.pdf")

    assert isinstance(fp, str) and len(fp) == 16
    assert "ACME SUPPLIES LTD" in full_text
    # Should include company-ish line, and skip "INVOICE"/"Total"
    assert any("ACME" in m for m in markers)


def test_invoice_learner__learn_from_correction_writes_rules_and_can_match(tmp_path):
    from app.invoice_learner import InvoiceLearner

    rules_file = tmp_path / "learned_rules.json"
    learner = InvoiceLearner(rules_file=rules_file)

    fingerprint = "abc123"
    text_markers = ["ACME SUPPLIES LTD"]
    full_text = "ACME SUPPLIES LTD\nInvoice No: INV-123\nSerial: 1111111111\nSerial: 2222222222\n"

    ok = learner.learn_from_correction(
        pdf_path="dummy.pdf",
        fingerprint=fingerprint,
        text_markers=text_markers,
        full_text=full_text,
        supplier_name="ACME",
        invoice_number="INV-123",
        serial_numbers=["1111111111", "2222222222"],
    )
    assert ok is True
    assert rules_file.exists()

    data = json.loads(rules_file.read_text(encoding="utf-8"))
    assert fingerprint in data["layouts"]

    layout = learner.find_matching_layout(fingerprint, text_markers, full_text)
    assert layout is not None

    extracted = learner.extract_with_rules(full_text, layout)
    assert extracted["invoice_number"] == "INV-123"
    assert extracted["serial_numbers"] == ["1111111111", "2222222222"]


def test_invoice_learner__apply_rule_with_prefix_context_and_multi_excludes_invoice_number(tmp_path):
    from app.invoice_learner import ExtractionRule, InvoiceLearner

    l = InvoiceLearner(rules_file=tmp_path / "rules.json")
    text = "Invoice No: INV-123\nSerial: INV-123\nSerial: 1111111111\n"

    rule_inv = ExtractionRule(field_type="invoice_number", value_pattern=r"INV-\d+", prefix_context="No:")
    assert l._apply_rule(text, rule_inv) == "INV-123"

    rule_sn = ExtractionRule(field_type="serial_number", value_pattern=r"\d{10}")
    serials = l._apply_rule_multi(text, rule_sn, invoice_number="INV-123")
    assert serials == ["1111111111"]


def test_invoice_learner__text_marker_matching_threshold(tmp_path):
    from app.invoice_learner import InvoiceLearner, LayoutProfile

    l = InvoiceLearner(rules_file=tmp_path / "rules.json")
    layout = LayoutProfile(supplier_name="ACME", fingerprint="fp1", text_markers=["ACME LTD", "Unique Header"])
    l.layouts["fp1"] = layout

    # 0/2 markers -> no match
    assert l.find_matching_layout("nope", [], "nothing here") is None
    # 1/2 markers -> score 0.5 -> match
    assert l.find_matching_layout("nope", [], "ACME LTD\nblah") is layout


def test_invoice_learner__delete_and_clear_and_global_instance(tmp_path, monkeypatch):
    import app.invoice_learner as mod

    rules_file = tmp_path / "rules.json"
    learner = mod.InvoiceLearner(rules_file=rules_file)
    learner.layouts["x"] = mod.LayoutProfile(supplier_name="S", fingerprint="x", text_markers=["M"])
    assert learner.delete_layout("x") is True
    assert learner.delete_layout("x") is False

    learner.layouts["y"] = mod.LayoutProfile(supplier_name="S", fingerprint="y", text_markers=["M"])
    learner.clear_all()
    assert learner.layouts == {}

    # get_learner caches global instance
    monkeypatch.setattr(mod, "_learner", None)
    a = mod.get_learner()
    b = mod.get_learner()
    assert a is b


def test_invoice_learner__load_rules_invalid_json_recovers(tmp_path, capsys):
    from app.invoice_learner import InvoiceLearner

    rules_file = tmp_path / "rules.json"
    rules_file.write_text("{not-json", encoding="utf-8")

    learner = InvoiceLearner(rules_file=rules_file)
    # When learned rules JSON is invalid, we should recover gracefully.
    # Current behavior: fall back to `default_rules.json` if present.
    assert learner.layouts is not None
    assert len(learner.layouts) > 0

    out = capsys.readouterr().out
    assert "Error loading rules" in out
    assert "Initialized with" in out


def test_invoice_learner__layoutprofile_to_from_dict_with_rules(tmp_path):
    from app.invoice_learner import ExtractionRule, LayoutProfile

    lp = LayoutProfile(
        supplier_name="ACME",
        fingerprint="fp",
        text_markers=["A"],
        invoice_number_rules=[ExtractionRule(field_type="invoice_number", value_pattern=r"INV-\d+")],
        serial_number_rules=[ExtractionRule(field_type="serial_number", value_pattern=r"\d{10}")],
    )
    d = lp.to_dict()
    lp2 = LayoutProfile.from_dict(d)
    assert lp2.supplier_name == "ACME"
    assert lp2.invoice_number_rules and lp2.invoice_number_rules[0].value_pattern == r"INV-\d+"
    assert lp2.serial_number_rules and lp2.serial_number_rules[0].value_pattern == r"\d{10}"



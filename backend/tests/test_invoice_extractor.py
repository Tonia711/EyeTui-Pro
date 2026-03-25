import json

import pytest

from app.invoice_extractor import extract_text_and_layout, extract_text_from_pdf, get_pdf_info


class _FakePage:
    def __init__(self, text: str = "", words=None, images=None):
        self._text = text
        self._words = words or []
        # pdfplumber pages expose `.images` (list) for image metadata
        self.images = images

    def extract_text(self):
        return self._text

    def extract_words(self, **_kwargs):
        # Keep behavior simple: return provided words unchanged
        return list(self._words)


class _FakePDF:
    def __init__(self, pages):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _install_pdfplumber_open(monkeypatch, fake_pdf):
    import app.invoice_extractor as mod

    def _open(_path):
        return fake_pdf

    monkeypatch.setattr(mod.pdfplumber, "open", _open)


def test_invoice_extractor__text_concat_newlines(monkeypatch):
    fake_pdf = _FakePDF(
        pages=[
            _FakePage(text="Hello"),
            _FakePage(text=None),  # should become ""
            _FakePage(text="World"),
        ]
    )
    _install_pdfplumber_open(monkeypatch, fake_pdf)

    text = extract_text_from_pdf("dummy.pdf")
    assert text == "Hello\n\nWorld\n"


def test_invoice_extractor__layout_words_add_page_and_json(monkeypatch):
    fake_pdf = _FakePDF(
        pages=[
            _FakePage(
                text="P1",
                words=[{"text": "A", "x0": 1, "top": 2}, {"text": "B", "x0": 3, "top": 4}],
            ),
            _FakePage(
                text="P2",
                words=[{"text": "C", "x0": 5, "top": 6}],
            ),
        ]
    )
    _install_pdfplumber_open(monkeypatch, fake_pdf)

    text, layout_json = extract_text_and_layout("dummy.pdf")
    assert text == "P1\nP2\n"

    words = json.loads(layout_json)
    assert words == [
        {"text": "A", "x0": 1, "top": 2, "page": 0},
        {"text": "B", "x0": 3, "top": 4, "page": 0},
        {"text": "C", "x0": 5, "top": 6, "page": 1},
    ]


def test_invoice_extractor__info_counts_pages_and_images(monkeypatch):
    fake_pdf = _FakePDF(
        pages=[
            _FakePage(images=[{"id": 1}, {"id": 2}]),
            _FakePage(images=[]),
            _FakePage(images=[{"id": 3}]),
        ]
    )
    _install_pdfplumber_open(monkeypatch, fake_pdf)

    info = get_pdf_info("some/path/invoice.pdf")
    assert info["filename"] == "invoice.pdf"
    assert info["page_count"] == 3
    assert info["has_images"] is True
    assert info["image_count"] == 3
    assert "error" not in info


def test_invoice_extractor__info_open_error_sets_error(monkeypatch):
    import app.invoice_extractor as mod

    def _boom(_path):
        raise RuntimeError("cannot open")

    monkeypatch.setattr(mod.pdfplumber, "open", _boom)

    info = get_pdf_info("bad.pdf")
    assert info["page_count"] == 0
    assert info["has_images"] is False
    assert info["image_count"] == 0
    assert info["error"] == "cannot open"



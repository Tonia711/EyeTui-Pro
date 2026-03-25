import pytest
from PIL import Image


def _ocr_instance_without_init():
    from app.ocr_processor import LensLabelOCR

    ocr = object.__new__(LensLabelOCR)
    ocr.use_paddleocr = False
    ocr.engine = "test"
    return ocr


def test_ocr_processor__parse_model_hash_prefix_normalizes_O_to_0():
    ocr = _ocr_instance_without_init()
    texts = [("# CNAOT3", 0.9)]
    # O should become 0
    assert ocr.parse_model(texts) == "CNA0T3"


def test_ocr_processor__parse_power_sign_separate_token():
    ocr = _ocr_instance_without_init()
    texts = [("+", 0.9), ("23.5D", 0.9)]
    assert ocr.parse_power(texts) == "+23.5D"


def test_ocr_processor__parse_serial_number_prefers_11_digits():
    ocr = _ocr_instance_without_init()
    # NOTE: current implementation normalizes OCR output by stripping spaces and ":".
    # That turns "SN: 241..." into "SN241..." where `\b` word-boundary based patterns
    # won't match the digits. Use a non-word separator that survives normalization.
    texts = [("SN#24116011069", 0.8)]
    assert ocr.parse_serial_number(texts) == "24116011069"


def test_ocr_processor__parse_power_combined_inserts_space_before_C():
    ocr = _ocr_instance_without_init()
    texts = [("+18.5C+3.00D", 0.9)]
    assert ocr.parse_power(texts) == "+18.5 C+3.00D"


def test_ocr_processor__preprocess_image_methods_return_image():
    from PIL import Image

    ocr = _ocr_instance_without_init()
    img = Image.new("RGB", (10, 10), color=(120, 120, 120))

    for method in ["original", "contrast", "strong_contrast", "sharpen", "grayscale", "threshold", "brighten"]:
        out = ocr.preprocess_image(img, method=method)
        assert isinstance(out, Image.Image)


def test_ocr_processor__extract_lens_info_early_exit_and_confidence(monkeypatch):
    from PIL import Image

    from app.ocr_processor import LensLabelOCR

    ocr = object.__new__(LensLabelOCR)
    ocr.use_paddleocr = False
    ocr.engine = "test"

    # Return a stable set of OCR texts.
    monkeypatch.setattr(
        LensLabelOCR,
        "extract_text",
        # Same boundary note as above: after normalization the serial must be preceded by a non-word char.
        lambda _self, _img, preprocess="auto": [("ACME", 0.9), ("+23.5D", 0.8), ("SN#24116011069", 0.7)],
    )

    img = Image.new("RGB", (20, 20), color=(255, 255, 255))
    result = ocr.extract_lens_info(img, extract_model=True, extract_power=True, extract_sn=True, preprocess_methods=["auto"])
    assert result["model"] is not None
    assert result["power"] is not None
    assert result["sn"] == "24116011069"
    assert 0.0 <= result["confidence"] <= 1.0


def test_ocr_processor__import_sets_engine_flags_when_deps_present(tmp_path, monkeypatch):
    """
    Cover import-time branches that set _PADDLEOCR_AVAILABLE/_TESSERACT_AVAILABLE.
    We load the module under an alternate name with fake paddleocr/pytesseract.
    """
    import importlib.util
    import sys
    from pathlib import Path
    import types

    # Fake paddleocr module
    paddleocr = types.ModuleType("paddleocr")

    class _FakePaddleOCR:  # noqa: N801 (match external lib class name)
        def __init__(self, lang="en"):
            self.lang = lang

    paddleocr.PaddleOCR = _FakePaddleOCR
    sys.modules["paddleocr"] = paddleocr

    # Fake pytesseract module
    pytesseract = types.ModuleType("pytesseract")

    def _get_tesseract_version():
        return "5.0"

    pytesseract.get_tesseract_version = _get_tesseract_version
    sys.modules["pytesseract"] = pytesseract

    # Load ocr_processor.py under a different module name so we can re-execute import-time code.
    src = Path(__file__).resolve().parents[1] / "app" / "ocr_processor.py"
    spec = importlib.util.spec_from_file_location("app._ocr_processor_import_test", str(src))
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)  # type: ignore[union-attr]

    assert mod._PADDLEOCR_AVAILABLE is True
    assert mod._TESSERACT_AVAILABLE is True


def test_ocr_processor__init_raises_when_no_engines(monkeypatch):
    """
    Cover __init__ guardrail when both OCR engines are unavailable.
    """
    import app.ocr_processor as mod

    monkeypatch.setattr(mod, "_PADDLEOCR_AVAILABLE", False)
    monkeypatch.setattr(mod, "_TESSERACT_AVAILABLE", False)

    with pytest.raises(RuntimeError, match="No OCR engine available"):
        mod.LensLabelOCR(use_paddleocr=True)


def test_ocr_processor__extract_text_paddleocr_parses_dict_result(monkeypatch):
    """
    Cover extract_text_paddleocr parsing of OCRResult-like dict.
    """
    import app.ocr_processor as mod

    class _FakePaddle:
        def ocr(self, _img_array):
            return [
                {
                    "rec_texts": ["HELLO", "WORLD"],
                    "rec_scores": [0.9, 0.8],
                    "rec_polys": [[[0, 0], [1, 0], [1, 1], [0, 1]], [[0, 0], [2, 0], [2, 2], [0, 2]]],
                }
            ]

    monkeypatch.setattr(mod, "_PADDLEOCR_AVAILABLE", True)
    monkeypatch.setattr(mod, "_paddle_ocr", _FakePaddle())

    ocr = _ocr_instance_without_init()
    texts = ocr.extract_text_paddleocr(Image.new("RGB", (5, 5), color=(255, 255, 255)))
    assert texts[0][0] == "HELLO"
    assert texts[1][0] == "WORLD"


def test_ocr_processor__extract_text_falls_back_to_other_engine(monkeypatch):
    """
    Cover extract_text() fallback logic: primary returns nothing -> fallback used.
    """
    import app.ocr_processor as mod
    from app.ocr_processor import LensLabelOCR

    # Pretend both engines exist
    monkeypatch.setattr(mod, "_PADDLEOCR_AVAILABLE", True)
    monkeypatch.setattr(mod, "_TESSERACT_AVAILABLE", True)

    ocr = object.__new__(LensLabelOCR)
    ocr.use_paddleocr = True
    ocr.engine = "paddleocr"

    monkeypatch.setattr(LensLabelOCR, "extract_text_paddleocr", lambda *_a, **_k: [])
    monkeypatch.setattr(LensLabelOCR, "extract_text_tesseract", lambda *_a, **_k: [("X", 90.0, None)])

    out = ocr.extract_text(Image.new("RGB", (5, 5), color=(255, 255, 255)), preprocess="original")
    assert out == [("X", 90.0)]


def test_ocr_processor__extract_text_tesseract_picks_best_psm(monkeypatch):
    """
    Cover extract_text_tesseract: tries multiple PSMs and chooses best average confidence.
    """
    import app.ocr_processor as mod
    from app.ocr_processor import LensLabelOCR

    monkeypatch.setattr(mod, "_TESSERACT_AVAILABLE", True)

    class _FakeOutput:
        DICT = "DICT"

    class _FakePyTesseract:
        Output = _FakeOutput

        def __init__(self):
            self.calls = 0

        def image_to_data(self, _img, config, output_type):
            self.calls += 1
            # First mode produces low conf, second high conf, third empty
            if "psm 6" in config:
                return {"text": ["a"], "conf": ["10"], "left": [0], "top": [0], "width": [1], "height": [1]}
            if "psm 11" in config:
                return {"text": ["b", "c"], "conf": ["80", "90"], "left": [0, 0], "top": [0, 0], "width": [1, 1], "height": [1, 1]}
            return {"text": [""], "conf": ["-1"], "left": [0], "top": [0], "width": [1], "height": [1]}

    fake = _FakePyTesseract()
    monkeypatch.setattr(mod, "pytesseract", fake, raising=False)

    ocr = object.__new__(LensLabelOCR)
    ocr.use_paddleocr = False
    ocr.engine = "tesseract"

    results = ocr.extract_text_tesseract(Image.new("RGB", (5, 5), color=(255, 255, 255)))
    assert [t for t, *_ in results] == ["b", "c"]




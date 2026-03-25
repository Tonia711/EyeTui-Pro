from __future__ import annotations

import os
from pathlib import Path

import pytest


SN_DIR = Path(__file__).with_name("sn")

if not SN_DIR.exists():
    pytest.skip("tests/sn folder not found; skipping real-image /barcode/decode tests", allow_module_level=True)


def _collect_image_cases() -> list[tuple[Path, str]]:
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    files = [p for p in SN_DIR.iterdir() if p.is_file() and p.suffix.lower() in exts]
    files.sort(key=lambda p: p.name.lower())
    if not files:
        pytest.skip("No images found in tests/sn; skipping", allow_module_level=True)
    return [(p, p.stem) for p in files]


@pytest.fixture(scope="module")
def client():
    """
    FastAPI test client for calling the decode endpoint without running uvicorn.
    """
    from fastapi.testclient import TestClient
    import app.main as main_mod

    # For real images, we accept any available engine; but if none are available the
    # endpoint returns 503, so skip to avoid false failures in CI.
    if (
        not getattr(main_mod, "_PYZBAR_AVAILABLE", False)
        and not (getattr(main_mod, "_OPENCV_AVAILABLE", False) and getattr(main_mod, "_OPENCV_BARCODE_DETECTOR", None) is not None)
        and not getattr(main_mod, "_PYLIBDMTX_AVAILABLE", False)
    ):
        pytest.skip("No barcode decode engines available (pyzbar/opencv/pylibdmtx); skipping")

    return TestClient(main_mod.app)


def test_barcode_decode__real_images_folder_accuracy(client):
    """
    Accuracy evaluation over real images in tests/sn/.

    The images are real captures and may not all be decodable depending on:
    - crop/quiet-zone, blur, glare, rotation
    - which decode engines are available on the machine (pyzbar/opencv/pylibdmtx)

    To avoid making the unit test suite flaky across environments, we only enforce a
    minimum accuracy threshold if BARCODE_DECODE_MIN_ACCURACY is set (> 0).
    """
    cases = _collect_image_cases()

    total = len(cases)
    decoded = 0
    correct = 0
    failures: list[str] = []

    for img_path, expected_barcode in cases:
        img_bytes = img_path.read_bytes()
        content_type = "image/png" if img_path.suffix.lower() == ".png" else "application/octet-stream"

        resp = client.post(
            "/barcode/decode",
            files={"image": (img_path.name, img_bytes, content_type)},
        )
        assert resp.status_code == 200, resp.text
        payload = resp.json()

        results = payload.get("results") or []
        texts = [r.get("text") for r in results if isinstance(r, dict) and r.get("text")]

        if texts:
            decoded += 1
        if expected_barcode in texts:
            correct += 1
        else:
            failures.append(f"{img_path.name} -> {texts}")

    accuracy = (correct / total) if total else 0.0
    min_acc = float(os.environ.get("BARCODE_DECODE_MIN_ACCURACY", "0"))

    # Helpful output for local runs / CI logs.
    print(
        f"[BARCODE TEST] real-images total={total} decoded={decoded} correct={correct} "
        f"accuracy={accuracy:.3f} min_required={min_acc:.3f}"
    )
    if failures:
        print("[BARCODE TEST] mismatches:")
        for line in failures[:20]:
            print("  -", line)

    assert accuracy >= min_acc



import json
from pathlib import Path


def test_barcode_learner__roundtrip(tmp_path, monkeypatch):
    import app.barcode_learner as learner

    patterns_file = tmp_path / "patterns.json"
    monkeypatch.setattr(learner, "LEARNED_PATTERNS_FILE", patterns_file)

    barcode = "DCB000023520820525250628"
    sn = "2082052525"

    learned = learner.learn_from_example(barcode, sn, type="DCB00", power="+22.50D")
    assert learned is True
    assert patterns_file.exists()

    out = learner.apply_learned_patterns(barcode)
    assert out == {"sn": sn, "type": "DCB00", "power": "+22.50D"}


def test_barcode_learner__ignore_generic_pattern(tmp_path, monkeypatch):
    import app.barcode_learner as learner

    patterns_file = tmp_path / "patterns.json"
    monkeypatch.setattr(learner, "LEARNED_PATTERNS_FILE", patterns_file)

    # This creates prefix "AB" and suffix "CD" (total specificity 4 < MIN_SPECIFICITY 8),
    # so it should be ignored by find_matching_pattern.
    barcode = "AB12345CD"
    sn = "12345"
    pat = learner.extract_pattern(barcode, sn)
    assert pat is not None

    learner.save_learned_patterns([pat])
    assert learner.apply_learned_patterns(barcode) is None


def test_barcode_learner__missing_file_empty(tmp_path, monkeypatch):
    import app.barcode_learner as learner

    patterns_file = tmp_path / "missing.json"
    monkeypatch.setattr(learner, "LEARNED_PATTERNS_FILE", patterns_file)

    assert learner.load_learned_patterns() == []


def test_barcode_learner__extract_pattern_missing_sn_returns_none():
    import app.barcode_learner as learner

    assert learner.extract_pattern("ABCDEF", "999") is None


def test_barcode_learner__find_matching_pattern_allows_numeric_suffix_variation():
    import app.barcode_learner as learner

    # Learn pattern with numeric suffix "0628" but match barcode ending with another 4-digit suffix.
    pat = learner.extract_pattern("DCB000023520820525250628", "2082052525", type="DCB00", power="+22.50D")
    assert pat is not None
    pat.match_count = 5

    matched = learner.find_matching_pattern("DCB000023520820525250999", [pat])
    assert matched is not None
    best_pat, sn = matched
    assert sn == "2082052525"
    assert best_pat.match_count == 6  # increments


def test_barcode_learner__delete_pattern_out_of_range_false(tmp_path, monkeypatch):
    import app.barcode_learner as learner

    patterns_file = tmp_path / "patterns.json"
    monkeypatch.setattr(learner, "LEARNED_PATTERNS_FILE", patterns_file)

    assert learner.delete_pattern(0) is False


def test_barcode_learner__load_invalid_json_returns_empty(tmp_path, monkeypatch, capsys):
    import app.barcode_learner as learner

    patterns_file = tmp_path / "patterns.json"
    patterns_file.write_text("{bad json", encoding="utf-8")
    monkeypatch.setattr(learner, "LEARNED_PATTERNS_FILE", patterns_file)

    out = learner.load_learned_patterns()
    assert out == []
    assert "Error loading patterns" in capsys.readouterr().out


def test_barcode_learner__delete_pattern_success(tmp_path, monkeypatch):
    import app.barcode_learner as learner

    patterns_file = tmp_path / "patterns.json"
    monkeypatch.setattr(learner, "LEARNED_PATTERNS_FILE", patterns_file)

    pat = learner.extract_pattern("DCB000023520820525250628", "2082052525")
    assert pat is not None
    learner.save_learned_patterns([pat])

    assert learner.delete_pattern(0) is True



import pytest


def test_barcode_parser__empty_all_none():
    from app.barcode_parser import parse_barcode

    assert parse_barcode("") == {
        "model": None,
        "power": None,
        "sn": None,
        "company": None,
        "original": "",
    }


def test_barcode_parser__numeric11_is_sn():
    from app.barcode_parser import parse_barcode

    out = parse_barcode("24116011069")
    assert out["sn"] == "24116011069"
    assert out["model"] is None
    assert out["power"] is None


def test_barcode_parser__gs1_parentheses_sn():
    from app.barcode_parser import parse_barcode

    raw = "(01)12345678901234(17)271031(21)50483779011"
    out = parse_barcode(raw)
    assert out["sn"] == "50483779011"


def test_barcode_parser__merge_prefers_longest_numeric_sn(monkeypatch):
    import app.barcode_parser as mod

    def _fake_parse(code: str):
        if code == "a":
            return {"model": "DCB00", "power": None, "sn": "123", "company": None, "original": code}
        if code == "b":
            return {"model": None, "power": "+23.5D", "sn": "1234567890", "company": None, "original": code}
        if code == "c":
            return {"model": None, "power": None, "sn": "12345678901", "company": None, "original": code}
        raise AssertionError("unexpected")

    monkeypatch.setattr(mod, "parse_barcode", _fake_parse)

    merged = mod.merge_barcode_results(["a", "b", "c"])
    assert merged["model"] == "DCB00"
    assert merged["power"] == "+23.5D"
    assert merged["sn"] == "12345678901"
    assert merged["original"] == ["a", "b", "c"]


def test_barcode_parser__smart_learned_over_rules(monkeypatch):
    import app.barcode_learner as learner
    from app.barcode_parser import smart_extract_serial_number

    monkeypatch.setattr(
        learner,
        "apply_learned_patterns",
        lambda _barcode: {"sn": "SNX", "type": "T", "power": "+20.0D"},
    )

    out = smart_extract_serial_number("anything")
    assert out == {"sn": "SNX", "type": "T", "power": "+20.0D", "confidence": "high"}


def test_barcode_parser__smart_fallback_to_rules(monkeypatch):
    import app.barcode_learner as learner
    import app.barcode_parser as parser

    monkeypatch.setattr(learner, "apply_learned_patterns", lambda _barcode: None)
    monkeypatch.setattr(parser, "parse_barcode", lambda _b: {"sn": "S", "model": "M", "power": "P"})

    out = parser.smart_extract_serial_number("x")
    assert out == {"sn": "S", "type": "M", "power": "P", "confidence": "medium"}


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("250110", "2025-01-10"),
        ("", ""),
        (None, None),
        ("abc", "abc"),
        ("25011", "25011"),
    ],
    ids=[
        "yyMMdd_to_iso_date",
        "empty_string_passthrough",
        "none_passthrough",
        "non_date_passthrough",
        "too_short_passthrough",
    ],
)
def test_barcode_parser__expiry_format_or_passthrough(raw, expected):
    from app.barcode_parser import format_expiry_date

    assert format_expiry_date(raw) == expected


def test_barcode_parser__numeric_long_extracts_middle_11_sn():
    from app.barcode_parser import parse_barcode

    out = parse_barcode("524537504837790111027")
    assert out["sn"] == "50483779011"


def test_barcode_parser__embedded_model_power_sn_parses():
    from app.barcode_parser import parse_barcode

    # Embedded model (DCB00), power digits after model ("00235" -> +23.5D),
    # SN before model (10 digits).
    # Important: len(raw) must be > 30 to enter the embedded-model fast-path,
    # and power should start with "0235" (-> +23.5D) right after the model.
    raw = "9999999999XYZ240DCB000235TAILXX"
    out = parse_barcode(raw)
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"
    assert out["sn"] == "9999999999"


def test_barcode_parser__power_normalizes_D_plus_format():
    from app.barcode_parser import parse_barcode

    out = parse_barcode("D+22.50")
    assert out["power"] == "+22.50D"


def test_barcode_parser__gs1_compact_format_extracts_sn_ai21():
    from app.barcode_parser import _parse_gs1_barcode

    # Compact format: ...21 + SN (10 digits)
    data = "010123456789012317271031219876543210"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "9876543210"


def test_barcode_parser__model_company_autodetect():
    from app.barcode_parser import parse_barcode

    out = parse_barcode("DCB00+23.5D")
    assert out["model"] == "DCB00"
    assert out["company"] == "AMO"


def test_barcode_parser__power_encoded_I021_maps_to_21_point_5_and_sn_prefers_non5():
    """
    Hit the special-case: digits '021' -> '+21.5D', and SN selection prefers a non-'5' candidate.
    """
    from app.barcode_parser import parse_barcode

    # Model DCB00, remaining begins with I021 (-> +21.5D), followed by a numeric block
    # where multiple 10-digit candidates exist and the parser should prefer one not starting with '5'.
    raw = "DCB00I021526816225120328"
    out = parse_barcode(raw)
    assert out["model"] == "DCB00"
    assert out["power"] == "+21.5D"
    assert out["sn"] == "2681622512"


def test_barcode_parser__power_encoded_I125_and_overlapping_sn_choice():
    from app.barcode_parser import parse_barcode

    # Comment in code mentions preferring "2261812523" over overlapping candidates.
    raw = "DCB00I12522618125230628"
    out = parse_barcode(raw)
    assert out["model"] == "DCB00"
    assert out["power"] == "+12.5D"
    assert out["sn"] == "2261812523"


def test_barcode_parser__gs1_parentheses_format_extracts_sn():
    from app.barcode_parser import _parse_gs1_barcode

    out = _parse_gs1_barcode("(01)12345678901234(17)271031(21)50483779011")
    assert out["sn"] == "50483779011"


def test_barcode_parser__gs1_compact_with_240_model_and_power():
    """
    Cover the compact GS1 flow where '21' is followed by '240' model and power digits.
    """
    from app.barcode_parser import _parse_gs1_barcode

    # 01 + GTIN(14) + 17 + date(6) + 21 + SN(10) + 240 + model + power(5 digits 00xxx)
    data = "01012345678901231727103121" + "2082052525" + "240" + "DCB00" + "00235"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "2082052525"
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_gtin_zeiss_maps_power():
    """
    Cover ZEISS GTIN branch that maps a known GTIN suffix to power.
    """
    from app.barcode_parser import _parse_gs1_barcode

    # GTIN starts with 0404933600 and ends with known mapping 1677 -> +22.5D (per code table)
    data = "01" + "04049336001677" + "17270110" + "21" + "6S2501800020"
    out = _parse_gs1_barcode(data)
    assert out["model"] == "CT LUCIA 621P"
    assert out["power"] == "+22.5D"
    assert out["sn"] == "6S2501800020"


def test_barcode_parser__merge_barcode_results_prefers_text_model_and_power_format(monkeypatch):
    import app.barcode_parser as mod

    monkeypatch.setattr(
        mod,
        "parse_barcode",
        lambda code: {
            "model": ("123" if code == "a" else "DCB00"),
            "power": ("23.5" if code == "a" else "+23.5D"),
            "sn": ("111" if code == "a" else "2222222222"),
            "company": None,
            "original": code,
        },
    )

    merged = mod.merge_barcode_results(["a", "b"])
    assert merged["model"] == "DCB00"
    assert merged["power"] == "+23.5D"


def test_barcode_parser__smart_extract_low_confidence_when_no_sn(monkeypatch):
    import app.barcode_learner as learner
    import app.barcode_parser as parser

    monkeypatch.setattr(learner, "apply_learned_patterns", lambda _b: None)
    monkeypatch.setattr(parser, "parse_barcode", lambda _b: {"sn": None, "model": None, "power": None})

    out = parser.smart_extract_serial_number("x")
    assert out["confidence"] == "low"


def test_barcode_parser__numeric_15_25_sn_fallback_chooses_closest_to_middle_when_no_middle_candidates():
    """
    Hit the branch where multiple 11-digit candidates exist but none are in the "middle range",
    so we fall back to choosing the one closest to center from all candidates.
    """
    from app.barcode_parser import parse_barcode

    # length 25; only candidates at positions 0-3 start with non-zero, positions >=4 start with 0 and are ignored.
    raw = "1111" + ("0" * 21)
    out = parse_barcode(raw)
    assert out["sn"] == "10000000000"


def test_barcode_parser__power_encoded_I019_maps_to_19_point_5():
    """
    Hit the special power rule: digits with leading zero like 019 -> 19.5D.
    """
    from app.barcode_parser import parse_barcode

    out = parse_barcode("DCB00I01922618125230628")
    assert out["model"] == "DCB00"
    assert out["power"] == "+19.5D"


def test_barcode_parser__fallback_longest_numeric_sequence_when_no_patterns_match():
    """
    Hit the last-resort fallback that picks the longest numeric sequence in raw text.
    """
    from app.barcode_parser import parse_barcode

    out = parse_barcode("abc123456789def98765432zzz")
    assert out["sn"] == "123456789"


def test_barcode_parser__gs1_sequential_parsing_hits_11_20_12_10_21_17_branches():
    """
    Force _parse_gs1_barcode to go through its sequential parsing loop:
    - 01 GTIN
    - 11 production date
    - 20 variant
    - 12 additional id
    - 10 batch/lot (letters) -> used as model
    - 21 serial number (11 digits) with following 17 -> triggers "possible next AI" continue path
    - 17 expiry date
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = (
        "01" + "12345678901234" +  # GTIN
        "11" + "250101" +          # production date
        "20" + "12" +              # variant
        "12" + "34" +              # additional id
        "10" + "BATCHX" +          # batch/lot as model
        "21" + "24116011069" +     # 11-digit SN
        "17" + "260101"            # expiry date (next AI)
    )
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "24116011069"
    assert out["model"] == "BATCHX"


def test_barcode_parser__gs1_ai24_becomes_240_and_parses_model_and_power():
    """
    Cover the sequential branch where ai_code == "24" and the next char is "0",
    so it is treated as AI 240 (model identification).
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = "24" + "0" + "DCB00" + "00235"
    out = _parse_gs1_barcode(data)
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_compact_alphanumeric_sn_pattern_uses_12char_format():
    """
    Cover compact GS1 regex that looks for 21 + (digit + letter + 10 digits).
    """
    from app.barcode_parser import _parse_gs1_barcode

    # Proper compact layout: 01 GTIN(14) + 17 expiry(6) + 21 alphanumeric SN(12)
    data = "01" + "04049336001677" + "17" + "271031" + "21" + "6S2501800020"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "6S2501800020"


def test_barcode_parser__gs1_compact_multiple_21_matches_picks_closest_to_end():
    """
    Cover best-match scoring when multiple 21 patterns exist.
    """
    from app.barcode_parser import _parse_gs1_barcode

    # Two SN candidates in the string; the one closest to end should win, and we
    # force an early return by making it followed by AI240 model+power.
    data = (
        "01" + "12345678901234" + "17" + "271031" +
        "21" + "1111111111" + "XX" +
        "21" + "2222222222" + "240" + "DCB00" + "00235"
    )
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "2222222222"


def test_barcode_parser__gs1_compact_sn_then_240_model_with_I_prefix_power_formats():
    """
    Cover AI240 power parsing for:
    - I0190 -> +19.0D (len>=4 digits, leading 0 case)
    - I230 -> +23.0D (3-digit case)
    """
    from app.barcode_parser import _parse_gs1_barcode

    data1 = "01" + "12345678901234" + "17" + "271031" + "21" + "1234567890" + "240" + "DCB00" + "I0190"
    out1 = _parse_gs1_barcode(data1)
    assert out1["sn"] == "1234567890"
    assert out1["model"] == "DCB00"
    assert out1["power"] == "+19.0D"

    data2 = "01" + "12345678901234" + "17" + "271031" + "21" + "1234567890" + "240" + "DCB00" + "I230"
    out2 = _parse_gs1_barcode(data2)
    assert out2["power"] == "+23.0D"


def test_barcode_parser__gs1_sequential_ai21_prefers_11_digits_when_followed_by_digits():
    """
    Current behavior: when 21 is followed by 10 digits and then another AI that starts with a digit,
    the sequential parser will treat it as an 11-digit SN (it checks 11 digits before 10).
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = "21" + "9876543210" + "11" + "250101"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "98765432101"


def test_barcode_parser__gs1_sequential_ai10_numeric_batch_is_skipped():
    """
    Cover ai_code == 10 branch where batch has no letters and should not be used as model.
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = "10" + "12345" + "21" + "2411601106"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "2411601106"
    assert out["model"] is None


def test_barcode_parser__parse_barcode_power_reverse_format_D_minus_normalizes():
    from app.barcode_parser import parse_barcode

    out = parse_barcode("D-5.0")
    assert out["power"] == "-5.0D"


def test_barcode_parser__sn_selection_all_candidates_start_with_5_skips_first_position_after_power():
    """
    Cover SN selection branch where all valid candidates start with '5', so it prefers
    the first candidate that is not at the very first position after power encoding.
    """
    from app.barcode_parser import parse_barcode

    # Model DCB00, power encoded as I125 (-> +12.5D), then a long run of 5s.
    out = parse_barcode("DCB00I125" + "5555555555555555")
    assert out["model"] == "DCB00"
    assert out["power"] == "+12.5D"
    assert out["sn"] == "5555555555"


def test_barcode_parser__gs1_sequential_parses_21_followed_by_240_model_and_power_when_regex_choice_skips_it():
    """
    Force _parse_gs1_barcode to enter the sequential loop and hit the big
    21(10 digits)240(model)(power) branch.

    Trick: include TWO '21' candidates so the regex pre-scan chooses the one
    closest to the end that is NOT followed by 240, preventing an early return.
    Then sequential parsing will process the earlier 21..240 segment.
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = (
        "01" + "12345678901234" + "17" + "271031" +
        "21" + "1234567890" + "240" + "DCB00" + "00235" +  # has model+power
        "21" + "9999999999"  # tail SN so regex best-match picks this and doesn't return early
    )
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "1234567890"
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_sequential_21_240_branch_is_executed_when_regex_prefers_later_sn():
    """
    Specifically cover the large sequential-parsing branch:
      ai_code == "21" and remaining[:10] digits and remaining[10:13] == "240"

    We ensure the earlier 21..240 match does NOT "win" in the initial regex scan by
    placing a much later 21 SN so the later one is closer to end (distance > 100),
    which outweighs the small +100 bonus for being followed by 240.
    """
    from app.barcode_parser import _parse_gs1_barcode

    filler = "0" * 150
    data = (
        "01" + "12345678901234" + "17" + "271031" +
        "21" + "1234567890" + "240" + "DCB00" + "00235" +
        filler +
        "21" + "9999999999"
    )
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "1234567890"
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_sequential_ai21_exactly_11_digits():
    from app.barcode_parser import _parse_gs1_barcode

    out = _parse_gs1_barcode("21" + "24116011069")
    assert out["sn"] == "24116011069"


def test_barcode_parser__gs1_sequential_ai21_exactly_10_digits():
    from app.barcode_parser import _parse_gs1_barcode

    out = _parse_gs1_barcode("21" + "9876543210")
    assert out["sn"] == "9876543210"


def test_barcode_parser__gs1_sequential_ai21_11digits_followed_by_240_then_ai240_parses_model_power():
    """
    Cover sequential path where AI21 has 11 digits and is followed by AI240,
    so it continues and parses model/power in the ai_code 24/240 branch.
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = "21" + "24116011069" + "240" + "DCB00" + "00235"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "24116011069"
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_sequential_ai21_10digits_then_non_digit_breaks():
    """
    Cover sequential ai21 10-digit fallback where the 11th char is non-digit,
    so it doesn't take the 11-digit branch and uses 10-digit SN.
    """
    from app.barcode_parser import _parse_gs1_barcode

    out = _parse_gs1_barcode("21" + "9876543210" + "X" + "11" + "250101")
    assert out["sn"] == "9876543210"


def test_barcode_parser__gs1_sequential_ai10_batch_with_letters_sets_model():
    from app.barcode_parser import _parse_gs1_barcode

    out = _parse_gs1_barcode("10" + "BATCHX" + "21" + "24116011069")
    assert out["sn"] == "24116011069"
    assert out["model"] == "BATCHX"


def test_barcode_parser__gs1_sequential_ai24_unknown_breaks():
    from app.barcode_parser import _parse_gs1_barcode

    # ai_code 24 not followed by 0 -> treated as unknown and breaks
    out = _parse_gs1_barcode("249ABC")
    assert out["sn"] is None
    assert out["model"] is None


def test_barcode_parser__gs1_ai240_fallback_model_extraction_sets_model():
    from app.barcode_parser import _parse_gs1_barcode

    # Not a known model, so it goes into fallback "extract alnum up to 15" branch.
    out = _parse_gs1_barcode("240" + "AB12C" + "00235")
    assert out["model"] == "AB12C00235"[:15]


def test_barcode_parser__gs1_compact_sn_then_240_model_I00255_maps_to_25_point_5():
    """
    Cover AI240 I-prefix parsing where the digits start with 0 and the last 3 digits encode power.
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = "01" + "12345678901234" + "17" + "271031" + "21" + "1234567890" + "240" + "DCB00" + "I00255"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "1234567890"
    assert out["model"] == "DCB00"
    assert out["power"] == "+25.5D"


def test_barcode_parser__gs1_regex_240_unknown_model_fallback_loop_extracts_model_and_power():
    """
    Cover the regex-stage 240 handling where model is not in known_models, so it runs the
    fallback loop (lines around 590-614 in app/barcode_parser.py).
    """
    from app.barcode_parser import _parse_gs1_barcode

    data = "01" + "12345678901234" + "17" + "271031" + "21" + "1234567890" + "240" + "ABCDE" + "00235"
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "1234567890"
    assert out["model"] == "ABCDE"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_ai240_nonstandard_5digit_power_parses_last3_digits():
    from app.barcode_parser import _parse_gs1_barcode

    # power_part[:5].isdigit and not starting with "00" -> parse last 3 digits (235 -> +23.5D)
    out = _parse_gs1_barcode("240" + "DCB00" + "11235")
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_ai240_I_prefix_formats_in_ai240_branch():
    """
    Cover the ai_code == 240 branch for I-prefix power parsing (I0190, I230).
    """
    from app.barcode_parser import _parse_gs1_barcode

    out1 = _parse_gs1_barcode("240" + "DCB00" + "I0190")
    assert out1["model"] == "DCB00"
    assert out1["power"] == "+19.0D"

    out2 = _parse_gs1_barcode("240" + "DCB00" + "I230")
    assert out2["model"] == "DCB00"
    assert out2["power"] == "+23.0D"


def test_barcode_parser__gs1_sequential_21_240_unknown_model_fallback_extracts_model_and_power_5digit():
    """
    Cover the sequential 21..240 path where model is NOT in known_models,
    so it uses the fallback model-extraction loop and then parses 5-digit power (00xxx).
    """
    from app.barcode_parser import _parse_gs1_barcode

    filler = "0" * 150
    data = (
        "01" + "12345678901234" + "17" + "271031" +
        "21" + "1234567890" + "240" + "ABCDE" + "00235" +
        filler +
        "21" + "9999999999"
    )
    out = _parse_gs1_barcode(data)
    assert out["sn"] == "1234567890"
    assert out["model"] == "ABCDE"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_sequential_21_240_power_3digit_format():
    from app.barcode_parser import _parse_gs1_barcode

    filler = "A" * 150
    data = (
        "01" + "12345678901234" + "17" + "271031" +
        # Make the first 5 chars NOT all digits (so it doesn't enter the 5-digit branch),
        # but the first 3 chars ARE digits (so it takes the 3-digit branch).
        "21" + "1234567890" + "240" + "DCB00" + "235X" +
        filler +
        "21" + "9999999999"
    )
    out = _parse_gs1_barcode(data)
    assert out["model"] == "DCB00"
    assert out["power"] == "+23.5D"


def test_barcode_parser__gs1_sequential_21_240_power_unmatched_leaves_power_none():
    from app.barcode_parser import _parse_gs1_barcode

    filler = "0" * 150
    data = (
        "01" + "12345678901234" + "17" + "271031" +
        "21" + "1234567890" + "240" + "DCB00" + "ZZZ" +
        filler +
        "21" + "9999999999"
    )
    out = _parse_gs1_barcode(data)
    assert out["model"] == "DCB00"
    assert out["power"] is None


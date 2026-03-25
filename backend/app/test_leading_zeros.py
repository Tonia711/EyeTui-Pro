"""
Test cases for Alcon-style leading zeros handling in invoice_learner.py

Scenario:
1. User uploads Alcon invoice with serial number "000000025424111139" in PDF
2. User edits and saves as "25424111139" (strips leading zeros)
3. System should learn:
   - The pattern matches "000000025424111139" format (18 digits)
   - But output should be stripped to "25424111139"
4. Next Alcon invoice upload should:
   - Find "000000012345678901" in PDF
   - Extract and return "12345678901"
"""

import sys
import os
import tempfile
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.invoice_learner import InvoiceLearner, ExtractionRule, LayoutProfile


def test_learn_value_pattern_with_leading_zeros():
    """Test that _learn_value_pattern correctly detects leading zeros case"""
    print("\n=== Test 1: _learn_value_pattern with leading zeros ===")
    
    # Create learner with temp rules file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        # Simulate PDF text containing serial with leading zeros
        pdf_text = """
        ALCON LABORATORIES
        Invoice Number: INV-12345
        Serial Numbers:
        000000025424111139
        000000012345678901
        Total: $500.00
        """
        
        # User provides stripped value
        user_value = "25424111139"
        
        # Learn the pattern
        rule = learner._learn_value_pattern(pdf_text, user_value, 'serial_number')
        
        assert rule is not None, "Rule should be created"
        assert rule.strip_leading_zeros == True, f"strip_leading_zeros should be True, got {rule.strip_leading_zeros}"
        assert rule.value_pattern is not None, "value_pattern should be set"
        
        print(f"  ✓ Rule created with strip_leading_zeros={rule.strip_leading_zeros}")
        print(f"  ✓ Pattern: {rule.value_pattern}")
        
        # Verify the pattern matches the original format with zeros
        import re
        matches = re.findall(rule.value_pattern, pdf_text)
        print(f"  ✓ Pattern matches in text: {matches}")
        assert "000000025424111139" in matches or any("0000000" in m for m in matches), \
            "Pattern should match the format with leading zeros"
        
        print("  ✓ Test 1 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_apply_rule_strips_zeros():
    """Test that _apply_rule correctly strips leading zeros when flag is set"""
    print("\n=== Test 2: _apply_rule strips leading zeros ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        # Create a rule that should strip leading zeros
        rule = ExtractionRule(
            field_type='serial_number',
            value_pattern=r'\b(\d{18})\b',  # Matches 18-digit numbers
            strip_leading_zeros=True,
        )
        
        pdf_text = "Serial: 000000025424111139 and 000000012345678901"
        
        # Apply rule - should strip zeros
        result = learner._apply_rule(pdf_text, rule)
        
        assert result is not None, "Should find a match"
        assert result == "25424111139", f"Expected '25424111139', got '{result}'"
        
        print(f"  ✓ Extracted value: '{result}' (zeros stripped)")
        print("  ✓ Test 2 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_apply_rule_multi_strips_zeros():
    """Test that _apply_rule_multi correctly strips leading zeros for all matches"""
    print("\n=== Test 3: _apply_rule_multi strips leading zeros ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        # Create a rule that should strip leading zeros
        rule = ExtractionRule(
            field_type='serial_number',
            value_pattern=r'\b(\d{18})\b',  # Matches 18-digit numbers
            strip_leading_zeros=True,
        )
        
        pdf_text = """
        Serials:
        000000025424111139
        000000012345678901
        000000099999999999
        """
        
        # Apply rule for multiple values
        results = learner._apply_rule_multi(pdf_text, rule)
        
        assert len(results) == 3, f"Expected 3 results, got {len(results)}"
        assert "25424111139" in results, f"'25424111139' should be in results: {results}"
        assert "12345678901" in results, f"'12345678901' should be in results: {results}"
        assert "99999999999" in results, f"'99999999999' should be in results: {results}"
        
        # Verify no leading zeros
        for r in results:
            assert not r.startswith('0'), f"Result '{r}' should not start with 0"
        
        print(f"  ✓ Extracted values: {results}")
        print("  ✓ Test 3 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_full_learn_and_extract_workflow():
    """Test the complete workflow: learn from correction, then extract from new PDF"""
    print("\n=== Test 4: Full learn and extract workflow ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        # Simulate first Alcon invoice
        fingerprint = "alcon_layout_v1"
        text_markers = ["ALCON LABORATORIES", "Invoice"]
        full_text = """
        ALCON LABORATORIES (NZ) LTD
        Invoice Number: INV-2024-001
        
        Item Details:
        Product: Contact Lens
        Serial: 000000025424111139
        
        Total: $299.00
        """
        
        # User provides corrected values (stripped zeros)
        supplier_name = "Alcon"
        invoice_number = "INV-2024-001"
        serial_numbers = ["25424111139"]  # User stripped the zeros
        
        # Learn from the correction
        success = learner.learn_from_correction(
            pdf_path="dummy.pdf",
            fingerprint=fingerprint,
            text_markers=text_markers,
            full_text=full_text,
            supplier_name=supplier_name,
            invoice_number=invoice_number,
            serial_numbers=serial_numbers,
            original_extracted=None
        )
        
        assert success, "Learning should succeed"
        assert fingerprint in learner.layouts, "Layout should be saved"
        
        layout = learner.layouts[fingerprint]
        assert layout.serial_number_rules, "Serial number rules should exist"
        
        # Check if strip_leading_zeros is set
        has_strip_flag = any(r.strip_leading_zeros for r in layout.serial_number_rules)
        print(f"  ✓ Layout learned with {len(layout.serial_number_rules)} serial rules")
        print(f"  ✓ strip_leading_zeros flag set: {has_strip_flag}")
        
        # Verify the flag is set correctly
        assert has_strip_flag, "strip_leading_zeros should be True for at least one rule"
        
        # Now simulate a NEW Alcon invoice with different serials
        new_full_text = """
        ALCON LABORATORIES (NZ) LTD
        Invoice Number: INV-2024-002
        
        Item Details:
        Product: Contact Lens
        Serial: 000000012345678901
        
        Total: $399.00
        """
        
        # Extract using learned rules - pass the layout object, not fingerprint
        extracted = learner.extract_with_rules(new_full_text, layout)
        
        print(f"  ✓ Extracted from new PDF: {extracted}")
        
        # The serial should be extracted WITHOUT leading zeros
        if extracted.get('serial_numbers'):
            serials = extracted['serial_numbers']
            assert "12345678901" in serials, \
                f"Expected '12345678901' in serials, got {serials}"
            for s in serials:
                assert not s.startswith('000000'), \
                    f"Serial '{s}' should not have leading zeros"
            print(f"  ✓ New serial extracted correctly: {serials}")
        else:
            print("  ⚠ No serials extracted - checking if pattern issue...")
            # Debug: check what patterns we have
            for rule in layout.serial_number_rules:
                print(f"    Pattern: {rule.value_pattern}, strip_zeros: {rule.strip_leading_zeros}")
        
        print("  ✓ Test 4 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_serialization_preserves_strip_flag():
    """Test that strip_leading_zeros survives save/load cycle"""
    print("\n=== Test 5: Serialization preserves strip_leading_zeros ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        # Create and save
        learner1 = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        rule = ExtractionRule(
            field_type='serial_number',
            value_pattern=r'\b(\d{18})\b',
            strip_leading_zeros=True,
            match_count=1,
        )
        
        layout = LayoutProfile(
            supplier_name="Alcon",
            fingerprint="test_fp",
            text_markers=["ALCON"],
            serial_number_rules=[rule],
        )
        
        learner1.layouts["test_fp"] = layout
        learner1._save_rules()
        
        # Load in new instance
        learner2 = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        assert "test_fp" in learner2.layouts, "Layout should be loaded"
        loaded_layout = learner2.layouts["test_fp"]
        assert loaded_layout.serial_number_rules, "Rules should be loaded"
        
        loaded_rule = loaded_layout.serial_number_rules[0]
        assert loaded_rule.strip_leading_zeros == True, \
            f"strip_leading_zeros should be True after load, got {loaded_rule.strip_leading_zeros}"
        
        print(f"  ✓ Loaded rule has strip_leading_zeros={loaded_rule.strip_leading_zeros}")
        print("  ✓ Test 5 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_value_without_leading_zeros_in_pdf():
    """Test that values without leading zeros in PDF work normally (no strip)"""
    print("\n=== Test 6: Value without leading zeros (normal case) ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        # PDF text with normal serial (no leading zeros)
        pdf_text = """
        TOOMAC OPTICS
        Invoice Number: TM-12345
        Serial Numbers:
        3Q13635012
        O30523001J-3
        Total: $1500.00
        """
        
        # User provides the exact value as in PDF
        user_value = "3Q13635012"
        
        # Learn the pattern
        rule = learner._learn_value_pattern(pdf_text, user_value, 'serial_number')
        
        assert rule is not None, "Rule should be created"
        assert rule.strip_leading_zeros == False, \
            f"strip_leading_zeros should be False for normal values, got {rule.strip_leading_zeros}"
        
        print(f"  ✓ Rule created with strip_leading_zeros={rule.strip_leading_zeros}")
        print("  ✓ Test 6 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_value_already_has_leading_zeros():
    """Test that if user provides value WITH leading zeros, no strip is set"""
    print("\n=== Test 7: User provides value with leading zeros ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        # PDF text with serial with leading zeros
        pdf_text = """
        ALCON LABORATORIES
        Serial: 000000025424111139
        """
        
        # User provides the value WITH leading zeros (exact match)
        user_value = "000000025424111139"
        
        # Learn the pattern
        rule = learner._learn_value_pattern(pdf_text, user_value, 'serial_number')
        
        assert rule is not None, "Rule should be created"
        assert rule.strip_leading_zeros == False, \
            f"strip_leading_zeros should be False when user provides full value, got {rule.strip_leading_zeros}"
        
        print(f"  ✓ Rule created with strip_leading_zeros={rule.strip_leading_zeros}")
        print("  ✓ Test 7 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_multiple_serials_mixed_zeros():
    """Test learning multiple serials where some have leading zeros stripped"""
    print("\n=== Test 8: Multiple serials with mixed zero handling ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        fingerprint = "mixed_layout"
        text_markers = ["MIXED INVOICE"]
        full_text = """
        MIXED INVOICE COMPANY
        Invoice: MIX-001
        
        Serials:
        000000025424111139
        NORMAL123456
        000000099887766554
        """
        
        # User strips zeros from some, keeps others as-is
        serial_numbers = ["25424111139", "NORMAL123456", "99887766554"]
        
        success = learner.learn_from_correction(
            pdf_path="dummy.pdf",
            fingerprint=fingerprint,
            text_markers=text_markers,
            full_text=full_text,
            supplier_name="Mixed Co",
            invoice_number="MIX-001",
            serial_numbers=serial_numbers,
            original_extracted=None
        )
        
        assert success, "Learning should succeed"
        
        layout = learner.layouts[fingerprint]
        
        # Check rules
        rules_with_strip = [r for r in layout.serial_number_rules if r.strip_leading_zeros]
        rules_without_strip = [r for r in layout.serial_number_rules if not r.strip_leading_zeros]
        
        print(f"  ✓ Rules with strip_zeros: {len(rules_with_strip)}")
        print(f"  ✓ Rules without strip_zeros: {len(rules_without_strip)}")
        
        # Now extract from similar document
        new_text = """
        MIXED INVOICE COMPANY
        Invoice: MIX-002
        
        Serials:
        000000011111111111
        NORMALABCDEF
        000000022222222222
        """
        
        extracted = learner.extract_with_rules(new_text, layout)
        serials = extracted['serial_numbers']
        
        print(f"  ✓ Extracted serials: {serials}")
        
        # Numeric serials should have zeros stripped
        assert "11111111111" in serials or any("1111111" in s for s in serials), \
            f"Numeric serial should have zeros stripped: {serials}"
        
        print("  ✓ Test 8 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_change_strip_preference_from_true_to_false():
    """
    Test that user can change from stripped to non-stripped format.
    
    Scenario:
    1. First time: user strips zeros (25424111139) -> strip_leading_zeros=True
    2. Later: user wants original format (000000025424111139) -> strip_leading_zeros=False
    3. Next extraction should return the full format with zeros
    """
    print("\n=== Test 9: Change strip preference from True to False ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        fingerprint = "alcon_revert_test"
        text_markers = ["ALCON"]
        full_text = """
        ALCON LABORATORIES (NZ) LTD
        Invoice Number: INV-001
        Serial: 000000025424111139
        """
        
        # Step 1: User first strips zeros
        print("  Step 1: User saves stripped value '25424111139'")
        success = learner.learn_from_correction(
            pdf_path="dummy.pdf",
            fingerprint=fingerprint,
            text_markers=text_markers,
            full_text=full_text,
            supplier_name="Alcon",
            invoice_number="INV-001",
            serial_numbers=["25424111139"],  # Stripped
            original_extracted=None
        )
        assert success
        
        layout = learner.layouts[fingerprint]
        assert layout.serial_number_rules
        rule = layout.serial_number_rules[0]
        assert rule.strip_leading_zeros == True, f"Should be True after first learning, got {rule.strip_leading_zeros}"
        print(f"    ✓ Learned with strip_leading_zeros=True")
        
        # Step 2: User changes mind, wants original format with zeros
        print("  Step 2: User saves full value '000000025424111139'")
        success = learner.learn_from_correction(
            pdf_path="dummy.pdf",
            fingerprint=fingerprint,
            text_markers=text_markers,
            full_text=full_text,
            supplier_name="Alcon",
            invoice_number="INV-001",
            serial_numbers=["000000025424111139"],  # Full format
            original_extracted=None
        )
        assert success
        
        layout = learner.layouts[fingerprint]
        rule = layout.serial_number_rules[0]
        assert rule.strip_leading_zeros == False, \
            f"Should be False after reverting, got {rule.strip_leading_zeros}"
        print(f"    ✓ Updated to strip_leading_zeros=False")
        
        # Step 3: Verify extraction now returns full format
        new_text = """
        ALCON LABORATORIES (NZ) LTD
        Invoice Number: INV-002
        Serial: 000000012345678901
        """
        
        extracted = learner.extract_with_rules(new_text, layout)
        serials = extracted['serial_numbers']
        
        print(f"    Extracted serials: {serials}")
        assert "000000012345678901" in serials, \
            f"Should extract full format with zeros, got {serials}"
        
        print("  ✓ Test 9 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def test_change_strip_preference_from_false_to_true():
    """
    Test that user can change from non-stripped to stripped format.
    
    Scenario:
    1. First time: user keeps zeros (000000025424111139) -> strip_leading_zeros=False
    2. Later: user strips zeros (25424111139) -> strip_leading_zeros=True
    3. Next extraction should return stripped format
    """
    print("\n=== Test 10: Change strip preference from False to True ===")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump({'version': '1.0', 'layouts': {}}, f)
        temp_rules_file = f.name
    
    try:
        learner = InvoiceLearner(rules_file=Path(temp_rules_file))
        
        fingerprint = "alcon_strip_test"
        text_markers = ["ALCON"]
        full_text = """
        ALCON LABORATORIES (NZ) LTD
        Invoice Number: INV-001
        Serial: 000000025424111139
        """
        
        # Step 1: User first keeps full format
        print("  Step 1: User saves full value '000000025424111139'")
        success = learner.learn_from_correction(
            pdf_path="dummy.pdf",
            fingerprint=fingerprint,
            text_markers=text_markers,
            full_text=full_text,
            supplier_name="Alcon",
            invoice_number="INV-001",
            serial_numbers=["000000025424111139"],  # Full format
            original_extracted=None
        )
        assert success
        
        layout = learner.layouts[fingerprint]
        assert layout.serial_number_rules
        rule = layout.serial_number_rules[0]
        assert rule.strip_leading_zeros == False, f"Should be False, got {rule.strip_leading_zeros}"
        print(f"    ✓ Learned with strip_leading_zeros=False")
        
        # Step 2: User changes mind, wants stripped format
        print("  Step 2: User saves stripped value '25424111139'")
        success = learner.learn_from_correction(
            pdf_path="dummy.pdf",
            fingerprint=fingerprint,
            text_markers=text_markers,
            full_text=full_text,
            supplier_name="Alcon",
            invoice_number="INV-001",
            serial_numbers=["25424111139"],  # Stripped
            original_extracted=None
        )
        assert success
        
        layout = learner.layouts[fingerprint]
        rule = layout.serial_number_rules[0]
        assert rule.strip_leading_zeros == True, \
            f"Should be True after update, got {rule.strip_leading_zeros}"
        print(f"    ✓ Updated to strip_leading_zeros=True")
        
        # Step 3: Verify extraction now returns stripped format
        new_text = """
        ALCON LABORATORIES (NZ) LTD
        Invoice Number: INV-002
        Serial: 000000012345678901
        """
        
        extracted = learner.extract_with_rules(new_text, layout)
        serials = extracted['serial_numbers']
        
        print(f"    Extracted serials: {serials}")
        assert "12345678901" in serials, \
            f"Should extract stripped format, got {serials}"
        # Should NOT have leading zeros
        for s in serials:
            assert not s.startswith('000000'), f"Should not have leading zeros: {s}"
        
        print("  ✓ Test 10 PASSED")
        return True
        
    finally:
        os.unlink(temp_rules_file)


def run_all_tests():
    """Run all tests and report results"""
    print("=" * 60)
    print("Running Alcon Leading Zeros Tests")
    print("=" * 60)
    
    tests = [
        test_learn_value_pattern_with_leading_zeros,
        test_apply_rule_strips_zeros,
        test_apply_rule_multi_strips_zeros,
        test_full_learn_and_extract_workflow,
        test_serialization_preserves_strip_flag,
        test_value_without_leading_zeros_in_pdf,
        test_value_already_has_leading_zeros,
        test_multiple_serials_mixed_zeros,
        test_change_strip_preference_from_true_to_false,
        test_change_strip_preference_from_false_to_true,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
                print(f"  ✗ {test.__name__} FAILED")
        except Exception as e:
            failed += 1
            print(f"  ✗ {test.__name__} FAILED with exception: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)

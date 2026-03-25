#!/bin/bash

# Test script to verify exists_in_db field is returned correctly

echo "Testing invoice extraction API with exists_in_db field..."
echo ""

# First, check what invoices exist in the database
echo "=== Existing invoices in database ==="
curl -s http://localhost:8000/invoice | python3 -c "
import sys, json
data = json.load(sys.stdin)
seen = set()
for item in data:
    inv_num = item['invoice_number']
    if inv_num not in seen:
        print(f\"{inv_num} - {item['company_name']}\")
        seen.add(inv_num)
" | head -10

echo ""
echo "=== Test 1: Check if invoice 703401-00 exists ==="
curl -s -X POST http://localhost:8000/invoice/check-exists \
  -H "Content-Type: application/json" \
  -d '{"invoice_number": "703401-00"}' | python3 -m json.tool

echo ""
echo "=== Test 2: Extract invoice with learning (mock with existing invoice number) ==="
echo "Note: This would require an actual PDF file to test properly"
echo "The API should return exists_in_db=true for invoice 703401-00"
echo ""
echo "To test with actual PDF, upload a PDF with invoice number 703401-00 through the UI"
echo "and check the browser console for the logged API response."

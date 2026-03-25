#!/bin/bash
set -euo pipefail
# Script to fix ZBar library path issues

set_homebrew_lib_path() {
    local added_paths=()
    if [ -d "/opt/homebrew/lib" ]; then
        added_paths+=("/opt/homebrew/lib")
    elif [ -d "/usr/local/lib" ]; then
        added_paths+=("/usr/local/lib")
    fi
    if [ ${#added_paths[@]} -gt 0 ]; then
        local prefix
        prefix=$(IFS=":"; echo "${added_paths[*]}")
        export DYLD_LIBRARY_PATH="${prefix}${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
        export LIBRARY_PATH="${prefix}${LIBRARY_PATH:+:$LIBRARY_PATH}"
        echo "✓ Library path set: ${prefix}"
    else
        echo "⚠️  Homebrew library path not found; ensure zbar is installed"
    fi
}

set_homebrew_lib_path

# Test if pyzbar works correctly
python -c "
try:
    from pyzbar import pyzbar
    print('✓ pyzbar import successful')
except ImportError as e:
    print('✗ pyzbar import failed:', e)
    raise SystemExit(1)
"

echo "✓ ZBar library path checked"

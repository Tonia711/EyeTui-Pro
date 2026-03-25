#!/bin/bash
set -euo pipefail
# Wrapper: call unified run_server.sh with passed args (generic entry)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/run_server.sh" "$@"

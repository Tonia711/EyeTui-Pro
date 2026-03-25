#!/usr/bin/env bash
set -euo pipefail
# Unified server runner for backend. Other start scripts are lightweight wrappers that call this.
# Usage: scripts/run_server.sh [--env ENV] [--host HOST] [--port PORT] [--lib-only] [--no-reload]

set_homebrew_lib_path() {
    local added_paths=()
    if [ -d "/opt/homebrew/lib" ]; then
        added_paths+=("/opt/homebrew/lib")
    elif [ -d "/usr/local/lib" ]; then
        added_paths+=("/usr/local/lib")
    fi
    if [ -d "/opt/homebrew/opt/libdmtx/lib" ]; then
        added_paths+=("/opt/homebrew/opt/libdmtx/lib")
    fi
    if [ ${#added_paths[@]} -gt 0 ]; then
        local prefix
        prefix=$(IFS=":"; echo "${added_paths[*]}")
        export DYLD_LIBRARY_PATH="${prefix}${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
        export LIBRARY_PATH="${prefix}${LIBRARY_PATH:+:$LIBRARY_PATH}"
        echo "✓ Library path set: ${prefix}"
    else
        echo "⚠️  Homebrew library path not found; ensure native libs (zbar/libdmtx) are installed"
    fi
}

activate_conda_env() {
    local env_name="$1"
    if [ -z "$env_name" ]; then
        return 1
    fi
    if ! command -v conda >/dev/null 2>&1; then
        echo "⚠️  conda not found; skipping activation"
        return 1
    fi
    local conda_base
    conda_base="$(conda info --base 2>/dev/null || true)"
    if [ -z "$conda_base" ]; then
        echo "⚠️  conda base not found; skipping activation"
        return 1
    fi
    # shellcheck disable=SC1090
    source "$conda_base/etc/profile.d/conda.sh"
    conda activate "$env_name"
}

ENV=""
HOST="0.0.0.0"
PORT="8000"
LIB_ONLY=false
RELOAD=true

while [[ $# -gt 0 ]]; do
    case "$1" in
        --env)
            ENV="$2"; shift 2;;
        --host)
            HOST="$2"; shift 2;;
        --port)
            PORT="$2"; shift 2;;
        --lib-only)
            LIB_ONLY=true; shift;;
        --no-reload)
            RELOAD=false; shift;;
        --help|-h)
            echo "Usage: $0 [--env ENV] [--host HOST] [--port PORT] [--lib-only] [--no-reload]"; exit 0;;
        *) echo "Unknown arg: $1"; exit 1;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

set_homebrew_lib_path

if [ "$LIB_ONLY" = false ]; then
    if [ -n "$ENV" ]; then
        activate_conda_env "$ENV" || true
    else
        echo "⚠️  No conda env specified; skipping activation"
    fi
fi

cd "$BACKEND_DIR"

echo "Starting FastAPI server (host=$HOST port=$PORT)"
echo "Conda env: ${CONDA_DEFAULT_ENV:-(none)}"
echo "DYLD_LIBRARY_PATH: ${DYLD_LIBRARY_PATH:-(not set)}"

UVICORN_ARGS=(app.main:app --host "$HOST" --port "$PORT")
if [ "$RELOAD" = true ]; then
    UVICORN_ARGS=(--reload "${UVICORN_ARGS[@]}")
fi

exec uvicorn "${UVICORN_ARGS[@]}"

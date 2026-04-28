# Backend Scripts and Usage

This document explains the helper scripts under `scripts/` and how to run the backend in two clear ways.

## Important: Run from the Correct Directory

`scripts/run_server.sh` lives in the project root, not inside `backend/`.

- If your current directory is project root (`EyeTui-Pro/`), use:
  - `bash scripts/run_server.sh --env <your-conda-env>`
- If your current directory is `backend/`, use:
  - `bash ../scripts/run_server.sh --env <your-conda-env>`

If you run `bash scripts/run_server.sh` inside `backend/`, you will get:
- `bash: scripts/run_server.sh: No such file or directory`

## Two Ways to Run the Backend

### Option A — Use the script (recommended)

`scripts/run_server.sh` is the unified entry that can:
- set Homebrew library paths (for `zbar`, `libdmtx`)
- optionally activate a conda environment
- start Uvicorn

Examples:

```bash
# conda users: pass your env name
bash scripts/run_server.sh --env <your-conda-env>

# generic (no conda): use system Python or an already-activated venv
bash scripts/run_server.sh
```

If running from `backend/`, use:

```bash
bash ../scripts/run_server.sh --env <your-conda-env>
```

Notes:
- Defaults are `--host 0.0.0.0` and `--port 8000`, so you can omit them.
- Use `--no-reload` if you don’t want auto-reload.
- `scripts/start_server.sh` is a thin wrapper that just forwards arguments to `scripts/run_server.sh`.

### Option B — Run Uvicorn directly

If you prefer manual control, run Uvicorn directly from the `backend/` directory:

```bash
cd backend
uvicorn app.main:app --reload
```

If you want a custom port:

```bash
uvicorn app.main:app --reload --port 8000
```

## Other Scripts

- `scripts/fix_zbar.sh`
  - Sets library paths and verifies `pyzbar` can be imported.
  - Useful when you see “Unable to find zbar shared library”.

## Tips

- If you use conda, either run `conda activate <your-conda-env>` first or pass `--env <your-conda-env>` to `scripts/run_server.sh`.
- On macOS, barcode libraries often need Homebrew paths in `DYLD_LIBRARY_PATH` / `LIBRARY_PATH`. `scripts/run_server.sh` and `scripts/fix_zbar.sh` handle this for you.
- If startup fails with `DATABASE_URL is not set`, create `.env` from `env.example` in `backend/`:
  - `cd backend && cp env.example .env`
  - Then update `DATABASE_URL` in `.env` and restart.

## Data Matrix Support (Optional)

If `pyzbar` cannot read Data Matrix codes, the backend falls back to `pylibdmtx`.

- macOS: `brew install libdmtx`
- Ubuntu/Debian: `sudo apt-get install libdmtx0a libdmtx-dev`
- CentOS/RHEL: `sudo yum install libdmtx libdmtx-devel`
- Python deps:
  ```bash
  pip install pylibdmtx>=0.1.10 numpy>=1.24.0
  # or
  pip install -r requirements.txt
  ```

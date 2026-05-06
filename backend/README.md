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

## Chatbot API (MVP)

Backend now includes an MVP chatbot endpoint:

```bash
POST /chat/ask
```

Request body:

```json
{
  "question": "Current inventory status"
}
```

Supported routes in MVP:
- `doc_qa`: system usage, setup, troubleshooting, workflow questions
- `business_qa`: inventory overview, invoice details, unmatched reconciliation summary, supplier/company/site overviews
- `out_of_scope`: unsupported questions

Routing pipeline:
- First try LLM query plan parsing (`route + entity + operation + filters`, strict backend validation)
- If query plan parsing is unavailable or invalid, fallback to LLM/rule-based intent routing
- `doc_qa` retrieves local project docs (`README.md`, `backend/README.md`, `docs/*.md`)
- `business_qa` stays on backend-controlled queries and does not send business data to the LLM
- `business_qa` now builds a validated query plan (`entity + operation + filters`) before execution

Optional environment variables for LLM intent parsing:

```bash
OPENAI_API_KEY=your_key_here
# Optional:
# OPENAI_BASE_URL=https://api.openai.com/v1
# CHATBOT_INTENT_MODEL=gpt-4o-mini
# CHATBOT_QUERY_PLAN_MODEL=gpt-4o-mini
# CHATBOT_SAFE_NLG_ENABLED=true
# CHATBOT_ANSWER_MODEL=gpt-4o-mini
```

Safe NLG notes:
- `CHATBOT_SAFE_NLG_ENABLED=true` enables a natural-language rewrite layer for business answers.
- The rewrite layer only receives sanitized aggregate metrics (no serial numbers, invoice numbers, or row-level data).

Example questions:
- `Current inventory status`
- `Invoice 9140481167 details`
- `What are the unmatched reconciliation records?`
- `How many suppliers do we have?`
- `How many companies do we have?`
- `How many clinics do we have?`
- `How do I start the backend?`
- `Where is the invoice learning rules documentation?`

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

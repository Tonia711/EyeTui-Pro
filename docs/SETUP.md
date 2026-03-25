# EyeTui — Setup and Run Guide

> Complete project environment setup, database initialization, and run commands

---

## Table of Contents

1. [Requirements](#requirements)
2. [Project Structure](#project-structure)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Database Setup](#database-setup)
6. [Running the Project](#running-the-project)
7. [API Endpoints](#api-endpoints)
8. [Troubleshooting & Notes](#troubleshooting--notes)

---

## Requirements

| Tool       | Minimum Version / Recommendation | Check command      |
| ---------- | -------------------------------- | ------------------ |
| Node.js    | >= 18.x                          | `node --version`   |
| npm        | >= 9.x                           | `npm --version`    |
| Python     | >= 3.11 (recommend 3.12)         | `python --version` |
| PostgreSQL | >= 14.x                          | `psql --version`   |

Notes:

- Some backend packages (e.g., `pyrxing`, `paddlepaddle`, `paddleocr`) recommend or require Python >= 3.11. If you use `conda`, a Python 3.12 environment is known to work in this repository.
- On macOS, some barcode/vision native libraries (ZBar, libjpeg etc.) may need to be installed via Homebrew — see the Barcode section below.

---

## Project Structure

```
EyeTui/
├── backend/                 # Python FastAPI backend
│   ├── venv/                # Python virtualenv (not committed)
│   ├── .env                 # Environment variables (not committed)
│   ├── env.example          # Environment variables template
│   ├── requirements.txt     # Python dependencies
│   └── app/
│       ├── __init__.py
│       ├── main.py          # FastAPI application entrypoint
│       ├── database.py      # DB connection
│       ├── models.py        # SQLAlchemy models
│       ├── schemas.py       # Pydantic schemas
│       └── invoice_extractor.py  # Invoice extraction logic

├── frontend/                # React frontend (Vite + React)
│   └── ...

├── db/
│   └── schema.sql           # Database schema

├── package.json
└── vite.config.ts
```

---

## Backend Setup

1. Create and activate a Python environment

On macOS / Linux (virtualenv):

```bash
cd backend
python -m venv venv
source venv/bin/activate
```

On Windows (PowerShell):

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Using conda (recommended if you already use conda):

```bash
conda create -n <your-conda-env> python=3.12 -y
conda activate <your-conda-env>
cd backend
```

2. Install Python dependencies

```bash
# from backend/
pip install -r requirements.txt
```

If a specific system package is required, see the Troubleshooting section below.

3. Configure environment variables

```bash
cp env.example .env
# Then edit backend/.env to set DATABASE_URL and other variables
```

Example DATABASE_URL values:

```env
# with password
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/hospital_lens_yourname

# local trust (no password)
DATABASE_URL=postgresql://postgres@localhost:5432/hospital_lens_yourname
```

---

## Frontend Setup

1. Install Node dependencies (project root):

```bash
npm install
```

The frontend uses Vite. Development server: `npm run dev`.

---

## Database Setup

1. Create a PostgreSQL database (example name):

```sql
CREATE DATABASE hospital_lens_yourname;
```

2. Initialize tables from the schema file:

```bash
psql -U postgres -d hospital_lens_yourname -f db/schema.sql
```

3. Example table (already in `db/schema.sql`):

```sql
CREATE TABLE received_lens (
  id SERIAL PRIMARY KEY,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE
);
```

---

## Running the Project

Recommended (development): run backend and frontend in separate terminals.

Terminal A — Backend (macOS / Linux):

```bash
cd backend
source venv/bin/activate   # or use conda activate <your-conda-env>
uvicorn app.main:app --reload --port 8000
```

Terminal B — Frontend (project root):

```bash
npm run dev
```

Quick notes:

- Frontend default: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## API Endpoints

Invoice PDF extraction:

POST /extract-invoices
Content-Type: multipart/form-data

Form field `files` should contain PDF file(s).

Response example (successful extraction):

```json
{
  "success": true,
  "data": [ ... ],
  "total_files": 1,
  "successful_extractions": 1,
  "failed_extractions": 0
}
```

Received lens CRUD endpoints:

- POST `/received-lens`
- GET `/received-lens`
- GET `/received-lens/{id}`
- PATCH `/received-lens/{id}`
- DELETE `/received-lens/{id}`

---

## Troubleshooting & Notes

Q: Virtualenv activation issues

- On macOS/Linux use `source venv/bin/activate`.
- On Windows (PowerShell) use `.
\venv\Scripts\Activate.ps1` and, if needed, set execution policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Q: `psycopg2` install fails

- Use the binary wheel:

```bash
pip install psycopg2-binary
```

Q: Database connection fails

1. Confirm PostgreSQL is running.
2. Check `backend/.env` DATABASE_URL.
3. Confirm the target database exists.

Q: Port 8000 in use

On macOS/Linux find the process:

```bash
lsof -i :8000
# then kill <PID>
kill -9 <PID>
```

Barcode / native dependencies

- The backend supports server-side barcode decoding (pyzbar, pylibdmtx, pyrxing). Some of these require native libraries on the host system.

- macOS (Homebrew):

```bash
brew install zbar
```

- Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y libzbar0 libzbar-dev
```

- Data Matrix (libdmtx) support:
  - macOS (Homebrew): `brew install libdmtx`
  - Ubuntu/Debian: `sudo apt-get install libdmtx0a libdmtx-dev`
  - CentOS/RHEL: `sudo yum install libdmtx libdmtx-devel`

Restart backend after native lib changes

If you just installed or fixed native libraries (e.g., `libdmtx`, `zbar`) or added `pylibdmtx`, restart the backend so new libraries are picked up.

Recommended (script):

```bash
cd backend
bash ../scripts/run_server.sh
```

Manual:

```bash
# 1) Set library path (macOS + Homebrew)
export DYLD_LIBRARY_PATH=/opt/homebrew/lib:/opt/homebrew/opt/libdmtx/lib:$DYLD_LIBRARY_PATH

# 2) Activate conda environment (optional)
conda activate <your-conda-env>

# 3) Start service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verification (optional):

```bash
cd /Users/dongniya/Desktop/778/code/Tui-E2E-Tests
pytest tests/test_barcode_image_recognition.py::TestBarcodeImageRecognition::test_decode_barcode_from_image -v -s
```

- OCR / Vision engines:

- `paddlepaddle` / `paddleocr` can have GPU/CPU variants and special install steps — follow the official PaddlePaddle install guide when needed.
- `pyrxing` (ZXing C++ bindings) notes: requires Python >= 3.11; if unavailable use `pyzbar` + OpenCV as a fallback.

Development workflow

- Add new Python dependency:

```bash
# activate env then
pip install <package-name>
pip freeze > requirements.txt
```

- Sync team dependencies:

```bash
git pull
cd backend
source venv/bin/activate  # or conda activate <your-conda-env>
pip install -r requirements.txt
cd ..
npm install
```

## Quick Start (macOS + conda)

If you are on macOS and use `conda`, this condensed sequence gets you running quickly:

```bash
# create & activate conda env (recommended)
conda create -n <your-conda-env> python=3.12 -y
conda activate <your-conda-env>

# install system deps (Homebrew)
brew update
brew install zbar pkg-config libjpeg openblas

# install Python deps (backend)
cd backend
pip install -r requirements.txt

# run backend
uvicorn app.main:app --reload --port 8000

# in a separate terminal, run frontend
cd ..
npm run dev
```

Notes:

- If `pip install -r requirements.txt` fails for heavy packages, see the sections below for targeted install commands (PaddlePaddle, pyrxing, pyzbar).

## Native / Troublesome Dependencies

Some packages require native libraries or special wheels. Use these macOS tips when needed.

- ZBar (pyzbar runtime):

```bash
brew install zbar
```

- OpenCV and image libs (if you encounter issues installing `opencv-python`):

```bash
brew install pkg-config jpeg zlib libpng openblas
pip install --no-binary :all: opencv-python
```

- pyrxing (ZXing C++ binding):
  - This package may need a matching Python ABI (>=3.11) or a prebuilt wheel. If `pip install pyrxing` fails, you can temporarily rely on `pyzbar` + `opencv-python` as a fallback.

## OCR Engines (PaddleOCR recommended)

The backend will automatically select the available OCR engine:
1. Prefer PaddleOCR when installed.
2. Fall back to Tesseract if PaddleOCR is not available.

### PaddleOCR Installation

PaddleOCR provides higher recognition accuracy than Tesseract, especially for complex layouts and label recognition.

Install in your conda environment:

```bash
conda activate <your-conda-env>
pip install "paddlepaddle>=2.5.0" "paddleocr>=2.7.0"
```

Note: In zsh, version numbers should be wrapped in quotes, otherwise `>=` is treated as a redirection operator.

Verify installation:

```bash
python -c "from paddleocr import PaddleOCR; print('PaddleOCR installed successfully')"
```

First run: PaddleOCR will download model files (about 100-200MB). Ensure network connection is available.

Platform note: `paddlepaddle` has platform- and CUDA-specific wheels. For a CPU-only install on macOS (Intel/Apple Silicon support varies), try the CPU wheel recommended by Paddle's install docs. Example (CPU):

```bash
# CPU example (may vary by Python version and macOS CPU)
pip install paddlepaddle --index-url https://mirror.baidu.com/pypi/simple
pip install paddleocr
```

If you need GPU support, follow the official PaddlePaddle guide to select the correct CUDA-enabled wheel for your system.

### Tesseract (Alternative)

If PaddleOCR is not available, the system will automatically fall back to Tesseract.

macOS:

```bash
brew install tesseract
pip install pytesseract>=0.3.10
```

### Troubleshooting OCR

1. Confirm the Python environment is correct (`conda activate <your-conda-env>`).
2. Check network connection (first run requires model download).
3. Review OCR DEBUG information in backend logs.

## Verify Backend Locally (quick checklist)

1. Activate your environment (`conda activate <your-conda-env>` or `source venv/bin/activate`).
2. From `backend/` run:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

3. Use curl or open the browser to confirm the API is up:

```bash
curl http://localhost:8000/health || curl http://localhost:8000/docs
```

If the repo does not expose `/health`, try visiting `http://localhost:8000/docs` in a browser and confirm the Swagger UI loads.

---

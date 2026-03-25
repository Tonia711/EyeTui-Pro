# Dependency Installation Guide

This document explains how to install all dependencies required by the EyeTui project.

## Contents

1. [System prerequisites](#system-prerequisites)
2. [Python backend dependencies](#python-backend-dependencies)
3. [Node.js frontend dependencies](#nodejs-frontend-dependencies)
4. [Verify installation](#verify-installation)

---

## System prerequisites

### macOS

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install ZBar (barcode decoding runtime)
brew install zbar

# Install libdmtx (Data Matrix support)
brew install libdmtx

# Install Tesseract OCR (optional, if you use Tesseract instead of PaddleOCR)
brew install tesseract
```

### Ubuntu / Debian

```bash
# Update package lists
sudo apt-get update

# Install ZBar
sudo apt-get install -y libzbar0 libzbar-dev

# Install libdmtx
sudo apt-get install -y libdmtx0a libdmtx-dev

# Install Tesseract OCR (optional)
sudo apt-get install -y tesseract-ocr libtesseract-dev
```

### Windows

Windows users should install the native dependencies manually:

1. ZBar: download and install the Windows binaries from https://github.com/mchehab/zbar/releases
   - Ensure the ZBar DLL is on your PATH
2. libdmtx: download and install Windows binaries from https://github.com/dmtx/libdmtx/releases
   - Ensure the DLLs are on your PATH

---

## Python backend dependencies

### Option A — virtualenv (recommended)

```bash
# change into the backend directory
cd backend

# create a virtual environment
python -m venv venv

# activate the virtual environment
# macOS / Linux:
source venv/bin/activate

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows CMD:
.\venv\Scripts\activate.bat
```

After activation, upgrade pip and install Python packages:

```bash
# ensure pip is up-to-date
pip install --upgrade pip

# install all Python dependencies (includes OpenCV)
pip install -r requirements.txt
```

### Option B — conda (optional)

If you prefer conda, activate your conda environment and install the Python dependencies with pip:

```bash
conda activate <your-environment>
cd backend
pip install --upgrade pip
pip install -r requirements.txt
```

#### macOS Apple Silicon notes

If you see "Unable to find zbar shared library" on macOS Apple Silicon, set the library path:

```bash
export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"
export LIBRARY_PATH="/opt/homebrew/lib:$LIBRARY_PATH"

# or use the helper script (sets path + tests pyzbar)
bash scripts/fix_zbar.sh
```

If pip installs fail for some heavy packages, try using conda-forge to install binary packages first:

```bash
conda install -c conda-forge opencv numpy pillow
# then install the rest via pip
pip install -r requirements.txt
```

### Key backend packages overview

- `fastapi`: Web framework
- `pyzbar`: Barcode decoding (requires system ZBar library)
- `pylibdmtx`: Data Matrix decoding (requires system libdmtx)
- `opencv-python`: OpenCV for image processing and barcode detection
- `paddleocr`: High-accuracy OCR engine (PaddleOCR)
- `pytesseract`: Tesseract OCR wrapper (optional)
- other packages for DB, PDF processing, etc.

### Verify critical Python packages

```bash
# Verify pyzbar
python -c "from pyzbar import pyzbar; print('pyzbar OK')"

# Verify OpenCV
python -c "import cv2; print(f'OpenCV version: {cv2.__version__}')"

# Verify PaddleOCR (first run downloads models)
python -c "from paddleocr import PaddleOCR; print('PaddleOCR OK')"

# Verify pylibdmtx
python -c "from pylibdmtx import pylibdmtx; print('pylibdmtx OK')"
```

---

## Node.js frontend dependencies

### Check Node.js / npm versions

```bash
# Node.js should be >= 18.x
node --version

# npm should be >= 9.x
npm --version
```

### Install frontend dependencies

```bash
# from project root
npm install
```

### If you encounter installation issues

```bash
# remove node modules and lockfile then reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Verify installation

### 1) Verify backend dependencies

```bash
cd backend

# activate virtualenv
source venv/bin/activate  # macOS/Linux
# or for Windows PowerShell
.\venv\Scripts\Activate.ps1

# quick test script
python - <<'PY'
import sys
print('Python version:', sys.version)

try:
    from pyzbar import pyzbar
    print('✓ pyzbar installed')
except Exception:
    print('✗ pyzbar not installed')

try:
    import cv2
    print(f'✓ OpenCV installed (version: {cv2.__version__})')
except Exception:
    print('✗ OpenCV not installed')

try:
    from pylibdmtx import pylibdmtx
    print('✓ pylibdmtx installed')
except Exception:
    print('✗ pylibdmtx not installed')

try:
    from paddleocr import PaddleOCR
    print('✓ PaddleOCR installed')
except Exception:
    print('✗ PaddleOCR not installed (optional)')
PY
```

### 2) Start the backend server

```bash
cd backend
source venv/bin/activate  # or use Windows activation
uvicorn app.main:app --reload
```

You should see lines similar to:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 3) Start the frontend dev server

```bash
# from project root
npm run dev
```

Expected Vite output:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Troubleshooting

### Q1: "Unable to find zbar shared library" on macOS (conda)

Cause: conda environment cannot see the system ZBar library (common on Apple Silicon).

Fix:

```bash
export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"
export LIBRARY_PATH="/opt/homebrew/lib:$LIBRARY_PATH"

# or use helper script (sets path + tests pyzbar)
bash scripts/fix_zbar.sh
```

Permanent fix: add the exports to `~/.zshrc` or `~/.bash_profile`:

```bash
if [ -d "/opt/homebrew/lib" ]; then
    export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH"
    export LIBRARY_PATH="/opt/homebrew/lib:$LIBRARY_PATH"
fi
```

### Q2: pip install opencv-python is slow or fails

Solutions:

```bash
# try a fast PyPI mirror
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple opencv-python

# or
pip install -i https://mirrors.aliyun.com/pypi/simple/ opencv-python
```

### Q3: pyzbar import fails

Reason: system ZBar library not installed.

Fix:

```bash
# macOS
brew install zbar

# Ubuntu/Debian
sudo apt-get install libzbar0 libzbar-dev

# then reinstall pyzbar
pip install --force-reinstall pyzbar
```

### Q4: pylibdmtx import fails

Reason: system libdmtx not installed.

Fix:

```bash
# macOS
brew install libdmtx

# Ubuntu/Debian
sudo apt-get install libdmtx0a libdmtx-dev

# then reinstall pylibdmtx
pip install --force-reinstall pylibdmtx
```

### Q5: OpenCV barcode detector not available

Cause: OpenCV version too low (requires >= 4.5.1)

Fix:

```bash
# upgrade OpenCV
pip install --upgrade "opencv-python>=4.5.1"

# verify version
python -c "import cv2; print(cv2.__version__)"
```

### Q6: PaddleOCR first run is slow

Cause: first run downloads model files (around 100-200MB).

Fix:

- Ensure you have a working network connection
- Wait for the download to complete (only necessary once)
- If the download fails, consider manual model download

### Q7: Virtual environment activation fails (Windows)

Fix:

```powershell
# run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# then reactivate your virtualenv
.\venv\Scripts\Activate.ps1
```

---

## Quick install script

### macOS / Linux

Create `install.sh`:

```bash
#!/bin/bash

echo "Installing system dependencies..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install zbar libdmtx
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt-get update
    sudo apt-get install -y libzbar0 libzbar-dev libdmtx0a libdmtx-dev
fi

echo "Creating Python virtual environment..."
cd backend
python -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Installing Node.js dependencies..."
cd ..
npm install

echo "Done!"
```

Run it:

```bash
chmod +x install.sh
./install.sh
```

---

## Next steps

After installation, refer to:

- [SETUP.md](./SETUP.md) - project configuration and run guide
- [BARCODE_OPTIMIZATION.md](./BARCODE_OPTIMIZATION.md) - barcode recognition optimization notes

Cause: OpenCV version too low (requires >= 4.5.1)

Solution:

```bash
# upgrade OpenCV
pip install --upgrade "opencv-python>=4.5.1"

# verify version
python -c "import cv2; print(cv2.__version__)"
```

### Q6: PaddleOCR first run is slow

Cause: The first run downloads model files (≈100–200MB).

Solution:

- Ensure a working network connection
- Wait for the model download to complete (one-time)
- If the download fails, consider manual model download per PaddleOCR docs

### Q7: Virtual environment activation fails (Windows)

Solution:

```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# then reactivate the virtual environment
.\venv\Scripts\Activate.ps1
```

---

## Quick install script

### macOS / Linux

Create `install.sh`:

```bash
#!/bin/bash

echo "Installing system dependencies..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install zbar libdmtx
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt-get update
    sudo apt-get install -y libzbar0 libzbar-dev libdmtx0a libdmtx-dev
fi

echo "Creating Python virtual environment..."
cd backend
python -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Installing Node.js dependencies..."
cd ..
npm install

echo "Installation complete!"
```

Run:

```bash
chmod +x install.sh
./install.sh
```

---

## Next steps

After installation, refer to:

- [SETUP.md](./SETUP.md) - project configuration and run guide
- [BARCODE_OPTIMIZATION.md](./BARCODE_OPTIMIZATION.md) - barcode recognition optimization notes

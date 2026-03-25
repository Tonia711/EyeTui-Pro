# =============================================
# Backend Dockerfile for EyeTui
# =============================================
# Uses Python 3.11 slim for pyrxing compatibility
# Includes system dependencies for OpenCV, OCR, barcode libs
# =============================================

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app

# Install system dependencies required by OpenCV, pdfplumber, pylibdmtx, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials
    gcc \
    g++ \
    # OpenCV dependencies (libgl1 replaces deprecated libgl1-mesa-glx)
    libgl1 \
    libglib2.0-0t64 \
    libsm6 \
    libxext6 \
    libxrender1 \
    # pylibdmtx (Data Matrix barcode)
    libdmtx-dev \
    libdmtx0t64 \
    # pyzbar (QR/1D barcode)
    libzbar0 \
    # Tesseract OCR
    tesseract-ocr \
    tesseract-ocr-eng \
    # PostgreSQL client libs for psycopg2
    libpq-dev \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY app ./app

# Copy default rules (pre-configured patterns for common suppliers)
# These are used to initialize learned_rules.json on first run
COPY default_rules.json ./default_rules.json

# Create empty learned_rules.json (will be mounted from host at runtime for persistence)
# If mounted file is empty, system will initialize from default_rules.json
RUN echo '{}' > ./learned_rules.json

# Expose port 8000 for uvicorn
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

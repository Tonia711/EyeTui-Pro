# EyeTui - Auckland Eye IOL Tracking and Reconciliation Platform


## 1. Overview

EyeTui is a hospital lens management and reconciliation system developed for Auckland Eye, an ophthalmology service provider in New Zealand.

The system is designed to align with existing clinical and administrative workflows, minimising additional workload for staff while improving efficiency at each stage of lens handling.

It supports the full lifecycle of intraocular lenses, from receiving and registration to usage recording, inventory management, and invoice reconciliation.

By integrating 1D and 2D barcode scanning, adaptive invoice data extraction, and structured data import, the system reduces manual errors and enables reliable payment validation.


## 2. Key Features

- **Guided Workflow Navigation**: Centralised entry point with built-in guidance for new and unfamiliar staff
- **Multi-Method Lens Receiving**: Flexible lens registration via camera scanning, barcode scanners, and Excel upload
- **Standardised Lens Information Management**: Consistent capture of serial number, supplier, lens type, and power
- **Surgical Usage Record Management**: Structured upload and management of surgical lens usage records
- **Automated Invoice Reconciliation**: Matching of received, used, and invoiced lenses at invoice level
- **Centralised Inventory Tracking**: Unified lens inventory with inter-clinic transfer records
- **Comprehensive Invoice Management**: Searchable, filterable, and auditable invoice records
- **Adaptive Pattern Learning**: Manual correction and pattern saving for unrecognised barcodes and invoice layouts
- **Cross-Role Workflow Support**: Coordinated workflows for nurses, administrative staff, and finance teams


## 3. Architecture

The system follows a local-first design to support on-premise deployment and data privacy requirements.

### Architecture Overview

- **Web Frontend (React)**
  Provides user interfaces for lens receiving, usage recording, inventory management, and invoice reconciliation.  
  Responsible for data input, file upload, workflow guidance, and result visualisation.

- **Backend API (FastAPI)**
  Centralises core business logic, including data validation, reconciliation rules, payment control, and workflow coordination.  
  Exposes RESTful APIs consumed by the frontend.

- **Processing Modules (Backend)**
  Implemented as independent modules under `backend/app`, responsible for:
  - Barcode decoding and parsing with pattern learning
  - Invoice PDF data extraction (see [INVOICE_LEARNING.md](docs/INVOICE_LEARNING.md) for details)
  - Excel usage record processing

- **Data Storage**
  - **PostgreSQL**: Stores lenses, invoices, reconciliation results, and operational records  
  - **JSON Files**: Persist learned patterns for barcode recognition and invoice PDF layout rules

### Core Data Flow

1. Staff upload images, Excel files, or PDF invoices through the frontend
2. The backend validates inputs and invokes relevant processing modules
3. Extracted and structured data is stored in the database
4. The reconciliation engine matches received, used, and invoiced records
5. Results and payment status are returned to the frontend

This layered design ensures clear separation between presentation, processing, and data management, improving maintainability and reliability.

### Adaptive Pattern Learning

**Barcode Recognition**: The system learns to recognize unrecognized barcodes through user corrections. When a barcode cannot be decoded, users can manually input the serial number, which is then saved as a learned pattern for future reference.

**Invoice PDF Extraction**: The system learns supplier-specific invoice layouts and extraction rules from user corrections. See [INVOICE_LEARNING.md](docs/INVOICE_LEARNING.md) for detailed information on how the system learns and applies invoice extraction rules.

---## 4. Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **OCR Engine**: PaddleOCR (primary), Tesseract (fallback) — used for barcode recognition and layout analysis
- **Invoice Learning**: Rule-based pattern extraction with user feedback loop (see [INVOICE_LEARNING.md](docs/INVOICE_LEARNING.md))
- **Barcode Libraries**: 
  - `pyzbar` (ZBar) for standard barcodes
  - `pylibdmtx` for Data Matrix barcodes
- **PDF Processing**: pdfplumber
- **Data Processing**: pandas, openpyxl

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Barcode Scanning**: ZXing browser library
- **Form Handling**: React Hook Form

### Infrastructure & Tooling
- **Server**: Uvicorn
- **Environment**: python-dotenv
- **Documentation**: Mermaid diagrams


## 5. Quick Start
Follow the steps below to set up and run the EyeTui system locally.

### 5.1. Clone the Repository
```bash
git clone <repository-url>
cd EyeTui
```

### 5.2. Install frontend dependencies
```bash
npm install
```

### 5.3. Initialise database
```bash
node scripts/db-apply.sh
```

### 5.4. Set up backend environment
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp env.example .env
```

### 5.5. Start backend
```bash
./start_server.sh
```

### 5.6. Start frontend (in a new terminal)
```bash
cd ..
npm run dev
```

### 5.7. Access the System
| Service              | URL                              |
|----------------------|----------------------------------|
| Frontend             | http://localhost:3000            |
| Backend API          | http://localhost:8000            |
| API Docs (Swagger)   | http://localhost:8000/docs       |
| API Docs (ReDoc)     | http://localhost:8000/redoc      |

### 5.8. Note
- Barcode and OCR features require additional system libraries.
  See `docs/SETUP.md` for details.

- Windows users should activate the virtual environment using:
```powershell
  .\venv\Scripts\Activate.ps1
```

## 6. Data Model & Relationships

EyeTui uses a unified, lens-centric data model, where each intraocular lens is represented by a single persistent record throughout its lifecycle.

### Persisted Data (Database)

The following core entities are stored in PostgreSQL:

- **Lens**: Central entity identified by a unique serial number. Stores receiving, usage, and reconciliation status.
- **Invoice**: Stores invoice metadata and links invoiced lenses.
- **Supplier**: Maintains supplier information.
- **Company**: Represents lens manufacturers.
- **LensType**: Defines lens models and specifications.
- **Site**: Represents clinic locations.

Each lens progresses through receiving, usage, and reconciliation stages within the same database record.

### Processing Data (Transient)

During reconciliation, the system processes temporary datasets that are not persisted:

- Usage records extracted from surgical Excel files
- Invoice records extracted from PDF files via OCR
- In-memory matching results used for validation

These datasets are processed in memory and applied to the database after verification.

### Reconciliation Logic

1. Register received lenses in the system
2. Upload surgical usage records
3. Extract invoice data using OCR
4. Match serial numbers across datasets
5. Update lens status and invoice associations
6. Validate payment eligibility

This unified design ensures data consistency, traceability, and efficient lifecycle management.


## 7. API 

EyeTui provides a RESTful API to support lens management, invoice processing, and reconciliation workflows.

The main API modules include:

- Invoice extraction and OCR processing
- Lens registration and lifecycle management
- Invoice and supplier management
- Surgical usage data processing
- Barcode decoding and validation

All API endpoints are documented using OpenAPI and can be accessed via:

- **Swagger UI**: http://localhost:8000/docs  
- **ReDoc**: http://localhost:8000/redoc  

Please refer to the interactive documentation for detailed request/response formats and usage examples.


## 8. Supported Invoice Companies

The system currently supports automated recognition for the following suppliers:

- Alcon Laboratories (New Zealand) Ltd
- Carl Zeiss (NZ) Ltd
- Toomac Holdings Ltd
- Medix 21 New Zealand
- Device Technologies New Zealand Ltd
- SurgiVision Pty Ltd
- AMO Australia Pty Limited

Additional suppliers can be added through the adaptive learning module.

## 9. Documentation

Additional setup and development guides are available in the `docs/` directory.


## 10. Development

### Backend

- Activate virtual environment and install dependencies:
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```
- To add new dependencies:
```bash
pip install package_name
pip freeze > requirements.txt
```

### Database

Database schema is managed manually using SQLAlchemy models and SQL scripts.

To apply schema changes:

#### 1.Update backend/app/models.py

#### 2.Update db/schema.sql

#### 3.Run:
```bash
psql -U postgres -d hospital_lens -f db/schema.sql
```

### Frontend

```bash
npm run dev
npm run build
```




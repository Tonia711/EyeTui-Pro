from pydantic import BaseModel
from datetime import date
from typing import Optional


# ============================================================
# Company and Type Schemas
# ============================================================

class CompanyCreate(BaseModel):
    name: str


class CompanyUpdate(BaseModel):
    name: Optional[str] = None


class CompanyOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class SupplierCreate(BaseModel):
    name: str


class SupplierUpdate(BaseModel):
    name: Optional[str] = None


class SupplierOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class SiteCreate(BaseModel):
    name: str


class SiteUpdate(BaseModel):
    name: Optional[str] = None


class SiteOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class LensTypeCreate(BaseModel):
    name: str
    company_id: int


class LensTypeUpdate(BaseModel):
    name: Optional[str] = None
    company_id: Optional[int] = None


class LensTypeOut(BaseModel):
    id: int
    name: str
    company_id: int
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# Lens (Core Entity) Schemas
# ============================================================

class LensCreate(BaseModel):
    serial_number: str
    received_date: Optional[date] = None

    is_used: Optional[bool] = None
    is_matched: Optional[bool] = None

    type: Optional[str] = None
    type_id: Optional[int] = None
    power: Optional[str] = None   # power may contain letters/units (e.g., "+21.0D", "Plano")
    site: Optional[str] = None    # Clinic that receives the lens (name)
    site_id: Optional[int] = None
    company: Optional[str] = None
    invoice_id: Optional[int] = None


class LensUpdate(BaseModel):
    serial_number: Optional[str] = None
    received_date: Optional[date] = None
    used_date: Optional[date] = None

    is_used: Optional[bool] = None
    is_matched: Optional[bool] = None

    type: Optional[str] = None
    type_id: Optional[int] = None
    power: Optional[str] = None
    site: Optional[str] = None    # Clinic that receives the lens (name)
    site_id: Optional[int] = None
    company: Optional[str] = None
    invoice_id: Optional[int] = None


class LensOut(BaseModel):
    id: int
    serial_number: str
    received_date: date
    used_date: Optional[date] = None

    is_used: bool
    is_matched: bool

    type: Optional[str] = None
    type_id: Optional[int] = None
    power: Optional[str] = None
    site: Optional[str] = None    # Clinic that receives the lens (name)
    site_id: Optional[int] = None
    company: Optional[str] = None
    move_from_clinic: Optional[str] = None  # Previous clinic before move
    invoice_id: Optional[int] = None

    class Config:
        from_attributes = True


class LensBulkCreate(BaseModel):
    items: list[LensCreate]


class LensBulkResponse(BaseModel):
    created_ids: list[int]
    duplicates: list[str]


# ============================================================
# Backward-compatible aliases (optional but recommended during refactor)
# - This allows your existing main.py imports to keep working
#   while you transition naming from ReceivedLens -> Lens.
# ============================================================

ReceivedLensCreate = LensCreate
ReceivedLensUpdate = LensUpdate
ReceivedLensOut = LensOut
ReceivedLensBulkCreate = LensBulkCreate
ReceivedLensBulkResponse = LensBulkResponse


# ============================================================
# Invoice Extraction Schemas
# ============================================================

class InvoiceExtractedData(BaseModel):
    """Single extracted invoice data"""
    file_name: str
    company: Optional[str] = None
    issuer_company_name: Optional[str] = None
    invoice_number: Optional[str] = None
    serial_numbers: list[str] = []
    pdf_text: Optional[str] = None
    layout_data: Optional[str] = None    
    error: Optional[str] = None


class InvoiceExtractedRow(BaseModel):
    """Single row of extracted invoice data (one per serial number)"""
    file_name: str
    issuer_company_name: str
    invoice_number: str
    serial_number: str
    error: str


class InvoiceExtractionResponse(BaseModel):
    """Response for invoice extraction endpoint"""
    success: bool
    data: list[InvoiceExtractedData]
    total_files: int
    successful_extractions: int
    failed_extractions: int


# ============================================================
# Excel Extraction Schemas
# ============================================================

class ExcelExtractedRow(BaseModel):
    """Single row from Excel with serial number"""
    serial_number: str
    sheet_name: Optional[str] = None  # Brand name


class ExcelExtractionResponse(BaseModel):
    """Response for Excel extraction endpoint"""
    success: bool
    data: list[ExcelExtractedRow]
    total_rows: int
    error: Optional[str] = None


# ============================================================
# Lens Status Update Schemas
# ============================================================

class LensStatusUpdate(BaseModel):
    """Single lens status update - both fields are optional to allow updating only one status"""
    serial_number: str
    is_used: Optional[bool] = None
    is_matched: Optional[bool] = None


class LensUsedUpdate(BaseModel):
    """Update only is_used status"""
    serial_number: str
    is_used: bool
    used_date: Optional[date] = None


class BulkUsedUpdate(BaseModel):
    """Bulk is_used status update request"""
    updates: list[LensUsedUpdate]


class BulkStatusUpdate(BaseModel):
    """Bulk status update request"""
    updates: list[LensStatusUpdate]


class BulkStatusUpdateResponse(BaseModel):
    """Response for bulk status update"""
    updated_count: int
    not_found: list[str]
    errors: list[str] = []


class BulkUsedUpdateResponse(BaseModel):
    """Response for bulk is_used update"""
    updated_count: int
    not_found: list[str]
    duplicates: list[str] = []
    errors: list[str] = []


# ============================================================
# Invoice Schemas
# ============================================================

class InvoiceCreate(BaseModel):
    upload_date: Optional[date] = None
    invoice_number: str
    serial_number: str  # SN from invoice
    supplier_id: Optional[int] = None


class InvoiceUpdate(BaseModel):
    upload_date: Optional[date] = None
    invoice_number: Optional[str] = None
    serial_number: Optional[str] = None
    supplier_id: Optional[int] = None


class InvoiceOut(BaseModel):
    id: int
    upload_date: date
    invoice_number: str
    serial_number: str
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    is_matched: Optional[bool] = None

    class Config:
        from_attributes = True


# ============================================================
# Invoice Learning Schemas
# ============================================================

# class InvoiceLearnRequest(BaseModel):
#     """Request to learn from user correction"""
#     company: str
#     field_type: str  # 'invoice_number', 'serial_number', 'company_name'
#     pdf_text: Optional[str] = None
#     layout_data: Optional[str] = None  # JSON string of word coordinates
#     correct_value: str
# 
# 
# class InvoiceLearnResponse(BaseModel):
#     """Response for learning request"""
#     success: bool
#     message: str
#     pattern_id: Optional[int] = None
# 
# 
# class InvoiceExtractionRule(BaseModel):
#     """Single extraction rule/pattern"""
#     id: int
#     company: str
#     field_type: str
#     prefix: str
#     suffix: str
#     value_pattern: str
#     examples_count: int
#     match_count: int
#     created_at: Optional[str] = None
# 
# 
# class InvoiceExtractionRulesResponse(BaseModel):
#     """Response for listing extraction rules"""
#     rules: list[InvoiceExtractionRule]
#     total: int


class InvoiceExtractedDataWithText(BaseModel):
    """Single extracted invoice data with PDF text for learning"""
    file_name: str
    company: Optional[str] = None
    issuer_company_name: Optional[str] = None
    invoice_number: Optional[str] = None
    serial_numbers: list[str] = []
    pdf_text: Optional[str] = None  # Full PDF text for learning context
    layout_data: Optional[str] = None  # JSON string of word coordinates
    layout_fingerprint: Optional[str] = None  # Fingerprint for layout identification
    confidence: Optional[str] = None  # 'high', 'medium', 'low'
    # used_learned_patterns: bool = False
    exists_in_db: bool = False  # Whether invoice number already exists in database
    error: Optional[str] = None


class InvoiceExtractionResponseWithText(BaseModel):
    """Response for invoice extraction with PDF text"""
    success: bool
    data: list[InvoiceExtractedDataWithText]
    total_files: int
    successful_extractions: int
    failed_extractions: int


class InvoiceSaveRequest(BaseModel):
    """Request to save corrected invoice data to database and learn patterns"""
    invoice_number: str
    supplier_name: str
    serial_numbers: list[str]
    overwrite: bool = True  # Whether to overwrite existing records
    # Learning data - required for the system to learn from corrections
    pdf_text: Optional[str] = None  # Full PDF text
    layout_data: Optional[str] = None  # JSON string of word coordinates
    layout_fingerprint: Optional[str] = None  # Fingerprint from extraction for learning


class InvoiceCheckExistsRequest(BaseModel):
    """Request to check if invoice exists"""
    invoice_number: str


class InvoiceCheckExistsResponse(BaseModel):
    """Response for checking if invoice exists"""
    exists: bool
    invoice_number: str
    serial_numbers: list[str] = []


class InvoiceSaveResponse(BaseModel):
    """Response for saving invoice data"""
    success: bool
    message: str
    saved_count: int


# ============================================================
# Move To Clinic Schema
# ============================================================

class MoveToClinicRequest(BaseModel):
    """Request to move lens to a new clinic"""
    new_clinic: str  # New clinic site name

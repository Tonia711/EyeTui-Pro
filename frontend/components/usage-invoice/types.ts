export interface ExcelExtractedRow {
  serial_number: string;
  sheet_name: string | null;
}

export interface ExcelExtractionResponse {
  success: boolean;
  data: ExcelExtractedRow[];
  total_rows: number;
  error: string | null;
}

export interface ExtractedUsageRow {
  serial_number: string;
  used_date: string;
}

export interface SerialNumberStatus {
  sn: string;
  inReceive: boolean;
  inUse: boolean;
}

export interface Invoice {
  invoiceNumber: string;
  company: string;
  issuerCompanyName: string;
  fileName: string;
  serialNumbers: SerialNumberStatus[];
  pdfText: string;
  layoutData?: string;
  layoutFingerprint?: string;
  confidence: string;
  usedLearnedPatterns: boolean;
  existsInDb: boolean;
}

export interface InvoiceExtractedData {
  file_name: string;
  company: string | null;
  issuer_company_name: string | null;
  invoice_number: string | null;
  serial_numbers: string[];
  pdf_text?: string | null;
  layout_data?: string;
  layout_fingerprint?: string;
  confidence?: string | null;
  used_learned_patterns?: boolean;
  exists_in_db?: boolean;
  error: string | null;
}

export interface InvoiceExtractionResponse {
  success: boolean;
  data: InvoiceExtractedData[];
  total_files: number;
  successful_extractions: number;
  failed_extractions: number;
}

export interface LensOut {
  id: number;
  serial_number: string;
  received_date: string;
  used_date?: string;
  is_used: boolean;
  is_matched: boolean;
}

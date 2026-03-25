export interface InvoiceRecord {
  uploadDate: string;
  supplier: string;
  invoiceNumber: string;
  serialNumbers: Array<{ sn: string; isMatched: boolean | null }>;
}

export interface InvoiceFromAPI {
  id: number;
  upload_date: string;
  invoice_number: string;
  serial_number: string;
  supplier_id: number | null;
  supplier_name: string | null;
  is_matched: boolean | null;
}

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader,
  Download,
  AlertCircle,
  X,
  Sparkles,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { InvoiceExtractionEditor } from "./InvoiceExtractionEditor";

interface ExcelExtractedRow {
  serial_number: string;
  sheet_name: string | null;
}

interface ExcelExtractionResponse {
  success: boolean;
  data: ExcelExtractedRow[];
  total_rows: number;
  error: string | null;
}

interface ExtractedUsageRow {
  serial_number: string;
  used_date: string;
}

interface SerialNumberStatus {
  sn: string;
  inReceive: boolean;
  inUse: boolean;
}

interface Invoice {
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

interface InvoiceExtractedData {
  file_name: string;
  company: string | null;
  issuer_company_name: string | null;
  invoice_number: string | null;
  serial_numbers: string[];
  pdf_text?: string | null;
  layout_data?: string; // JSON string of word coordinates
  layout_fingerprint?: string; // Fingerprint for layout identification
  confidence?: string | null;
  used_learned_patterns?: boolean;
  exists_in_db?: boolean;
  error: string | null;
}

interface InvoiceExtractionResponse {
  success: boolean;
  data: InvoiceExtractedData[];
  total_files: number;
  successful_extractions: number;
  failed_extractions: number;
}

interface LensOut {
  id: number;
  serial_number: string;
  received_date: string;
  used_date?: string;
  is_used: boolean;
  is_matched: boolean;
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";

export function UsageAndInvoicePanel() {
  // Excel/Usage states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isExcelDragging, setIsExcelDragging] = useState(false);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const [extractedRows, setExtractedRows] = useState<ExtractedUsageRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [usageSummaryMessage, setUsageSummaryMessage] = useState<string | null>(null);
  const [usageMissingMessage, setUsageMissingMessage] = useState<string | null>(null);
  const [totalExtractedCount, setTotalExtractedCount] = useState(0);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  // Invoice states
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [isInvoiceDragging, setIsInvoiceDragging] = useState(false);
  const [isInvoiceScanning, setIsInvoiceScanning] = useState(false);
  const [isInvoiceUploading, setIsInvoiceUploading] = useState(false);
  const [isInvoiceUploaded, setIsInvoiceUploaded] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const invoiceFileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState<number | null>(null);
  const [showExtractionEditor, setShowExtractionEditor] = useState(false);

  // Shared states
  const [receivedSerialNumbers, setReceivedSerialNumbers] = useState<Set<string>>(new Set());
  const [usedSerialNumbers, setUsedSerialNumbers] = useState<Set<string>>(new Set());
  const [lensDataMap, setLensDataMap] = useState<Map<string, LensOut>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatedInvoices, setUpdatedInvoices] = useState<Set<string>>(new Set());

  // Fetch received lens data and used status from database on component mount
  useEffect(() => {
    fetchLensData();
  }, []);

  const fetchLensData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/lens`);
      if (!response.ok) {
        throw new Error("Failed to fetch lens data");
      }
      const data: LensOut[] = await response.json();

      // Extract received and used serial numbers from database
      const receivedSNs = new Set(data.map((item) => item.serial_number));
      const usedSNs = new Set(
        data.filter((item) => item.is_used).map((item) => item.serial_number)
      );

      // Create a map of serial numbers to lens data for detailed export
      const lensMap = new Map<string, LensOut>();
      data.forEach((item) => {
        lensMap.set(item.serial_number, item);
      });

      setReceivedSerialNumbers(receivedSNs);
      setUsedSerialNumbers(usedSNs);
      setLensDataMap(lensMap);

      console.log(`📋 Loaded ${receivedSNs.size} received lenses, ${usedSNs.size} used`);
    } catch (err) {
      console.error("Error fetching lens data:", err);
    }
  };

  // Handle Excel file upload
  const handleExcelFileChange = async (selectedFile: File | null) => {
    if (
      selectedFile &&
      (selectedFile.name.endsWith(".xlsx") ||
        selectedFile.name.endsWith(".xls"))
    ) {
      setExcelFile(selectedFile);
      setIsExcelProcessing(true);
      setError(null);
      setSuccessMessage(null);
      setUsageSummaryMessage(null);
      setUsageMissingMessage(null);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch(
          `${API_BASE_URL}/extract-excel-serial-numbers`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to extract Excel data");
        }

        const result: ExcelExtractionResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to process Excel file");
        }

        const allSerialNumbers = result.data.map((r) => r.serial_number);
        console.log(
          `✅ Excel File Processed: ${selectedFile.name} (${result.total_rows} serial numbers)`
        );
        console.log("📋 Serial Numbers:", allSerialNumbers);

        const today = new Date().toISOString().slice(0, 10);
        const rows = allSerialNumbers.map((sn) => ({
          serial_number: sn,
          used_date: today,
        }));
        setExtractedRows(rows);
        setTotalExtractedCount(allSerialNumbers.length);
        await handleUploadToDatabase(rows);
      } catch (err) {
        console.error("Excel extraction error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process Excel file"
        );
        setExtractedRows([]);
        setTotalExtractedCount(0);
        setUsageSummaryMessage(null);
        setUsageMissingMessage(null);
      } finally {
        setIsExcelProcessing(false);
        if (excelFileInputRef.current) {
          excelFileInputRef.current.value = "";
        }
      }
    }
  };

  // Helper function to update invoices with used status
  const updateInvoicesWithUsedStatus = (usedSNs: Set<string>) => {
    const updatedInvoices = invoices.map((invoice) => ({
      ...invoice,
      serialNumbers: invoice.serialNumbers.map((item) => ({
        ...item,
        inReceive: receivedSerialNumbers.has(item.sn),
        inUse: usedSNs.has(item.sn),
      })),
    }));
    setInvoices(updatedInvoices);
    console.log("✅ Updated invoices with new used status");
  };

  const handleExcelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsExcelDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (
      droppedFile &&
      (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))
    ) {
      handleExcelFileChange(droppedFile);
    }
  };

  const handleClearUsageUpload = () => {
    if (isUploading) {
      return;
    }
    setExcelFile(null);
    setExtractedRows([]);
    setTotalExtractedCount(0);
    setError(null);
    setSuccessMessage(null);
    setUsageSummaryMessage(null);
    setUsageMissingMessage(null);
    if (excelFileInputRef.current) {
      excelFileInputRef.current.value = "";
    }
  };

  const handleClearInvoices = () => {
    if (isInvoiceUploading) {
      return;
    }
    setInvoiceFiles([]);
    setInvoices([]);
    setIsInvoiceUploaded(false);
    setError(null);
    setSuccessMessage(null);
    setSelectedInvoiceIndex(null);
    setShowExtractionEditor(false);
    if (invoiceFileInputRef.current) {
      invoiceFileInputRef.current.value = "";
    }
  };

  const handleRemoveInvoice = (invoiceIndex: number) => {
    // Remove the invoice from the list
    setInvoices((prev) => prev.filter((_, index) => index !== invoiceIndex));

    // If the removed invoice was selected, close the editor
    if (selectedInvoiceIndex === invoiceIndex) {
      setShowExtractionEditor(false);
      setSelectedInvoiceIndex(null);
    } else if (selectedInvoiceIndex !== null && selectedInvoiceIndex > invoiceIndex) {
      // Adjust the selected index if it's after the removed invoice
      setSelectedInvoiceIndex(selectedInvoiceIndex - 1);
    }
  };

  const handleUploadToDatabase = async (rowsToUpload?: ExtractedUsageRow[]) => {
    const rows = rowsToUpload ?? extractedRows;
    if (rows.length === 0) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);
    setUsageSummaryMessage(null);
    setUsageMissingMessage(null);

    try {
      const trimmedRows = rows
        .map((row) => ({
          serial_number: row.serial_number.trim(),
          used_date: row.used_date.trim(),
        }))
        .filter((row) => row.serial_number.length > 0);

      if (trimmedRows.length === 0) {
        throw new Error("No valid serial numbers to upload");
      }

      console.log("📤 Updating is_used status in database...");
      const updatePayload = {
        updates: trimmedRows.map((row) => ({
          serial_number: row.serial_number,
          is_used: true,
          used_date: row.used_date || null,
        })),
      };

      const updateResponse = await fetch(`${API_BASE_URL}/lens/update-used`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update is_used status in database");
      }

      const updateResult = await updateResponse.json();
      console.log(
        `✅ Updated is_used status for ${updateResult.updated_count} lenses`
      );

      const serialDateMap = new Map(
        trimmedRows.map((row) => [row.serial_number, row.used_date])
      );
      const notFoundRows = updateResult.not_found.map((sn: string) => ({
        serial_number: sn,
        used_date: serialDateMap.get(sn) || "",
      }));

      if (updateResult.not_found.length > 0) {
        console.warn(
          "⚠️ SNs not found in database:",
          updateResult.not_found
        );
      }

      if (updateResult.duplicates.length > 0) {
        console.warn(
          "⚠️ SNs already marked as used:",
          updateResult.duplicates
        );
      }

      if (updateResult.errors && updateResult.errors.length > 0) {
        console.warn("⚠️ Errors during update:", updateResult.errors);
      }

      // Update used serial numbers set with only successfully updated ones
      const successfullyUpdatedSNs = trimmedRows
        .map((row) => row.serial_number)
        .filter((sn) =>
          !updateResult.not_found.includes(sn) &&
          !updateResult.duplicates.includes(sn)
        );
      const mergedUsedSNs = new Set([
        ...Array.from(usedSerialNumbers),
        ...successfullyUpdatedSNs,
      ]);
      setUsedSerialNumbers(mergedUsedSNs);

      if (invoices.length > 0) {
        updateInvoicesWithUsedStatus(mergedUsedSNs);
      }

      setExtractedRows(notFoundRows);
      setUsageSummaryMessage(
        `Extracted ${trimmedRows.length} serial number(s). Uploaded ${updateResult.updated_count}. Skipped ${updateResult.duplicates.length} already used.`
      );
      setUsageMissingMessage(
        updateResult.not_found.length > 0
          ? `Missing ${updateResult.not_found.length} ( shown below ).`
          : null
      );
      // Keep messages displayed until manually cleared
      // No longer auto-clear after 3 seconds

      if (updateResult.updated_count === 0 && updateResult.not_found.length === 0) {
        setError(null);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to upload usage data"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Invoice PDF upload
  const handleInvoiceFileChange = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    handleClearUsageUpload();

    const pdfFiles = Array.from(selectedFiles).filter(
      (file) => file.type === "application/pdf"
    );

    if (pdfFiles.length === 0) {
      setError("Please select PDF files only");
      return;
    }

    setInvoiceFiles(pdfFiles);
    setIsInvoiceScanning(true);
    setIsInvoiceUploaded(false);
    setError(null);
    setSuccessMessage(null);

    // Fix Bug 5: Collapse any open editor when uploading new files
    setSelectedInvoiceIndex(null);
    setShowExtractionEditor(false);

    try {
      const formData = new FormData();
      pdfFiles.forEach((file) => {
        formData.append("files", file);
      });

      const endpoint = `${API_BASE_URL}/extract-invoices-with-learning?persist=false`;
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to extract invoice data");
      }

      const result: InvoiceExtractionResponse = await response.json();

      console.log("📦 [Usage Panel] Extraction result:", result);
      console.log("📦 [Usage Panel] Total files:", result.total_files, "Data items:", result.data.length);

      let existingInvoiceNumbers: Set<string> | null = null;
      try {
        const existingResponse = await fetch(`${API_BASE_URL}/invoice`);
        if (existingResponse.ok) {
          const existingData: Array<{ invoice_number: string }> = await existingResponse.json();
          existingInvoiceNumbers = new Set(
            existingData
              .map((item) => item.invoice_number)
              .filter((value) => typeof value === "string" && value.length > 0)
          );
        }
      } catch (err) {
        console.warn("Unable to fetch existing invoices for duplicate check:", err);
      }

      const validInvoices = result.data
        .map((item) => {
          console.log("📄 [Usage Panel] Processing:", item.file_name, "Error:", item.error, "SNs:", item.serial_numbers?.length || 0);
          console.log("📄 [Usage Panel] Has pdf_text:", !!item.pdf_text, "Has layout_data:", !!item.layout_data);
          console.log("📄 [Usage Panel] Full item:", item);
          // If there's an error but we have text, it's a "Failed/New Layout" that user can fix
          if (item.error && item.pdf_text) {
            console.log("⚠️ [Usage Panel] Error with text - showing editable invoice");
            return {
              fileName: item.file_name,
              invoiceNumber: item.invoice_number || "?",
              company: item.company || item.issuer_company_name || "?",
              issuerCompanyName: item.issuer_company_name || "?",
              serialNumbers: item.serial_numbers.map((sn: any) => ({
                sn,
                inReceive: receivedSerialNumbers.has(sn),
                inUse: usedSerialNumbers.has(sn),
              })),
              pdfText: item.pdf_text,
              layoutData: item.layout_data,
              layoutFingerprint: item.layout_fingerprint,
              confidence: "low",
              usedLearnedPatterns: false,
              existsInDb: false,
            };
          }
          // If there's an error and no text (e.g. not a PDF), catch it below in filter
          if (item.error) {
            console.log("❌ [Usage Panel] Error without text - filtering out");
            return null;
          }

          return {
            fileName: item.file_name,
            invoiceNumber: item.invoice_number || "",
            company: item.company || item.issuer_company_name || "",
            issuerCompanyName: item.issuer_company_name || item.company || "",
            serialNumbers: item.serial_numbers.map((sn: any) => ({
              sn,
              inReceive: receivedSerialNumbers.has(sn),
              inUse: usedSerialNumbers.has(sn),
            })),
            pdfText: item.pdf_text || "",
            layoutData: item.layout_data,
            layoutFingerprint: item.layout_fingerprint,
            confidence: item.confidence || "low",
            usedLearnedPatterns: item.used_learned_patterns ?? false,
            existsInDb:
              item.exists_in_db ??
              (existingInvoiceNumbers ? existingInvoiceNumbers.has(item.invoice_number || "") : false),
          };
        })
        .filter((item) => item !== null) as Invoice[];

      const sortedInvoices = validInvoices.sort((a, b) => {
        // Duplicates come first
        if (a.existsInDb && !b.existsInDb) return -1;
        if (!a.existsInDb && b.existsInDb) return 1;
        // If both are duplicates or both are not, maintain original order
        return 0;
      });

      console.log("✅ [Usage Panel] Final invoices:", sortedInvoices.length, "invoices");
      setInvoices(sortedInvoices);

      if (result.failed_extractions > 0) {
        // Only show error for files that truly failed (no text extracted)
        const trueFailures = result.data.filter(item => item.error && !item.pdf_text);

        if (trueFailures.length > 0) {
          const failedFiles = trueFailures
            .map((item) => `${item.file_name}: ${item.error}`)
            .join("; ");
          setError(`Extraction failed: ${failedFiles}`);
        }
      }
    } catch (err) {
      console.error("Invoice extraction error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to connect to server"
      );
      setInvoices([]);
    } finally {
      setIsInvoiceScanning(false);
    }
  };

  const handleInvoiceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsInvoiceDragging(false);
    handleInvoiceFileChange(e.dataTransfer.files);
  };

  const handleOpenExtractionEditor = (invoiceIndex: number) => {
    if (showExtractionEditor && selectedInvoiceIndex === invoiceIndex) {
      setShowExtractionEditor(false);
      setSelectedInvoiceIndex(null);
      return;
    }
    setSelectedInvoiceIndex(invoiceIndex);
    setShowExtractionEditor(true);
  };

  const handleCloseExtractionEditor = () => {
    setShowExtractionEditor(false);
    setSelectedInvoiceIndex(null);
  };

  const handleSaveAndLearn = async (
    invoice: Invoice,
    corrections: {
      invoiceNumber?: string;
      companyName?: string;
      serialNumbers?: string[];
    }
  ) => {
    const companyName =
      corrections.companyName || invoice.issuerCompanyName || invoice.company || "unknown";
    const invoiceNumber = corrections.invoiceNumber || invoice.invoiceNumber;
    const serialNumbers = corrections.serialNumbers && corrections.serialNumbers.length > 0
      ? corrections.serialNumbers
      : invoice.serialNumbers.map((sn) => sn.sn);

    // Call /invoice/learn to ONLY learn layout patterns (no DB save)
    // Database save happens separately via "Upload All" button
    const response = await fetch(`${API_BASE_URL}/invoice/learn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_number: invoiceNumber,
        supplier_name: companyName,
        serial_numbers: serialNumbers,
        pdf_text: invoice.pdfText || "",
        layout_data: invoice.layoutData || null,
        layout_fingerprint: invoice.layoutFingerprint || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to learn patterns. Please try again.");
    }

    // Update the invoice in the list with the corrected values
    // This updates the UI to show the learned data
    setInvoices((prev) =>
      prev.map((item) => {
        if (item.fileName !== invoice.fileName) return item;

        const nextSerialNumbers =
          corrections.serialNumbers && corrections.serialNumbers.length > 0
            ? corrections.serialNumbers
            : item.serialNumbers.map((sn) => sn.sn);

        return {
          ...item,
          invoiceNumber: invoiceNumber,
          issuerCompanyName: companyName,
          company: companyName,
          serialNumbers: nextSerialNumbers.map((sn) => ({
            sn,
            inReceive: receivedSerialNumbers.has(sn),
            inUse: usedSerialNumbers.has(sn),
          })),
        };
      })
    );
  };

  // Bulk save all invoices to database
  const handleUploadAllInvoices = async () => {
    if (invoices.length === 0) {
      return;
    }

    setIsInvoiceUploading(true);
    setError(null);

    try {
      let successCount = 0;
      let failCount = 0;

      const invoicesToUpdate = invoices.filter(
        (invoice) =>
          invoice.invoiceNumber !== "?" &&
          invoice.company !== "?" &&
          invoice.serialNumbers.length > 0
      );

      for (const invoice of invoicesToUpdate) {
        // Skip invoices with missing data
        try {
          const response = await fetch(`${API_BASE_URL}/invoice/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoice_number: invoice.invoiceNumber,
              supplier_name: invoice.company || invoice.issuerCompanyName,
              serial_numbers: invoice.serialNumbers.map(sn => sn.sn),
              overwrite: true, // Always overwrite existing records
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to save invoice");
          }

          successCount++;
        } catch (err) {
          console.error(`Failed to save invoice ${invoice.invoiceNumber}:`, err);
          failCount++;
        }
      }

      await Promise.all(invoicesToUpdate.map((invoice) => checkAndUpdateInvoice(invoice)));

      if (successCount > 0) {
        setSuccessMessage(`Successfully uploaded ${successCount} invoice(s) to database`);
        setIsInvoiceUploaded(true);
        // Keep success message displayed until manually cleared
      }

      if (failCount > 0) {
        setError(`Failed to upload ${failCount} invoice(s). Please check for missing data.`);
        // Keep error message displayed until manually cleared
      }

      // Refresh lens data
      await fetchLensData();

    } catch (err) {
      console.error("Error uploading invoices:", err);
      setError(err instanceof Error ? err.message : "Failed to upload invoices");
      // Keep error message displayed until manually cleared
    } finally {
      setIsInvoiceUploading(false);
    }
  };

  // Check if an invoice is fully matched and auto-update
  const checkAndUpdateInvoice = async (invoice: Invoice) => {
    if (updatedInvoices.has(invoice.invoiceNumber)) {
      return;
    }

    // Skip auto-update for duplicate invoices - user should manually decide
    if (invoice.existsInDb) {
      console.log(`⚠️ Invoice ${invoice.invoiceNumber}: Duplicate detected, skipping auto-update`);
      return;
    }

    const allMatched = invoice.serialNumbers.every(
      item => item.inReceive && item.inUse
    );

    if (!allMatched) {
      console.log(`⏸️ Invoice ${invoice.invoiceNumber}: Not all SNs matched, skipping auto-update`);
      return;
    }

    console.log(`✅ Invoice ${invoice.invoiceNumber}: All SNs matched, auto-updating...`);

    try {
      const updates = invoice.serialNumbers.map(item => ({
        serial_number: item.sn,
        is_matched: true,
      }));

      const response = await fetch(`${API_BASE_URL}/lens/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update database status");
      }

      const result = await response.json();

      console.log(`✅ Invoice ${invoice.invoiceNumber}: Updated ${result.updated_count} records`);

      setUpdatedInvoices(prev => new Set([...prev, invoice.invoiceNumber]));

      await fetchLensData();

      // Keep success message displayed until manually cleared

    } catch (err) {
      console.error(`❌ Invoice ${invoice.invoiceNumber} update error:`, err);
      setError(
        `Invoice ${invoice.invoiceNumber}: ${err instanceof Error ? err.message : "Failed to update"}`
      );
      // Keep error message displayed until manually cleared
    }
  };

  const getStatusText = (inReceive: boolean, inUse: boolean) => {
    if (inReceive && inUse) return { text: "Matched", color: "text-[#0dcaf0]" };
    if (inReceive && !inUse) return { text: "Not Used", color: "text-red-600" };
    return { text: "Missing", color: "text-red-600" };
  };

  const exportExcel = () => {
    if (invoices.length === 0) {
      return;
    }

    // Get upload date (today's date)
    const uploadDate = new Date();
    const uploadDateStr = `${String(uploadDate.getDate()).padStart(2, "0")}${String(
      uploadDate.getMonth() + 1
    ).padStart(2, "0")}${uploadDate.getFullYear()}`;

    // Prepare data for Excel - combine all invoices
    const excelData: string[][] = [];

    // Add header row
    excelData.push([
      "Upload Date",
      "Invoice Number",
      "Supplier",
      "Serial Number",
      "Received Date",
      "Used Date",
      "Is Matched",
    ]);

    // Add data rows from all invoices
    invoices.forEach((invoice) => {
      invoice.serialNumbers.forEach((item) => {
        const lensData = lensDataMap.get(item.sn);
        excelData.push([
          uploadDateStr,
          invoice.invoiceNumber || "N/A",
          invoice.company || "N/A",
          item.sn,
          lensData?.received_date || "N/A",
          lensData?.used_date || "N/A",
          lensData?.is_matched ? "Yes" : "No",
        ]);
      });
    });

    // Create worksheet and workbook
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reconciliation");

    // Generate filename
    const filename = `reconciliation_result_${uploadDateStr}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-8">
      {/* Instruction Text */}
      <p className="!text-gray-400 !text-sm !font-bold mb-2">
        You can upload either used lens records or an invoice. You do not need to upload both.
      </p>

      {/* Upload Sections - Side by Side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Section: Lens Usage (Excel Upload) */}
        <div
          onDrop={handleExcelDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsExcelDragging(true);
          }}
          onDragLeave={() => setIsExcelDragging(false)}
          className={`border-2 border-dashed p-10 transition-colors ${isExcelDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300"
            }`}
        >
          <div className="flex flex-col items-center">
            <label className="cursor-pointer">
              <div className="inline-flex items-center gap-2 px-6 py-2 h-10 border-2 border-gray-400 text-gray-600 text-sm font-bold rounded-full bg-white hover:border-gray-400 hover:text-gray-900 transition-colors justify-center">
                <FileSpreadsheet className="h-4 w-4" />
                Upload used lens records
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                ref={excelFileInputRef}
                onChange={(e) =>
                  handleExcelFileChange(e.target.files?.[0] || null)
                }
              />
            </label>
            <p className="text-gray-600 text-sm text-center mt-4">
              Upload an Excel file containing used lens information.
            </p>
          </div>
        </div>

        {/* Right Section: Invoice PDF Upload */}
        <div
          onDrop={handleInvoiceDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsInvoiceDragging(true);
          }}
          onDragLeave={() => setIsInvoiceDragging(false)}
          className={`border-2 border-dashed p-10 transition-colors ${isInvoiceDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
        >
          <div className="flex flex-col items-center w-full">
            <label className="cursor-pointer">
              <div className="inline-flex items-center gap-2 px-6 py-2 h-10 border-2 border-gray-400 text-gray-600 text-sm font-bold rounded-full bg-white hover:border-gray-400 hover:text-gray-900 transition-colors justify-center">
                <FileText className="h-4 w-4" />
                Upload invoice PDF
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf"
                multiple
                ref={invoiceFileInputRef}
                onChange={(e) => handleInvoiceFileChange(e.target.files)}
              />
            </label>
            <p className="text-gray-600 text-sm text-center mt-4">
              Upload one or more PDF invoices for reconciliation.
            </p>
          </div>
        </div>
      </div>

      {/* Uploaded Excel File */}
      {excelFile && (
        <div className="flex items-center gap-3 p-3 bg-gray-100">
          {isExcelProcessing ? (
            <Loader className="h-5 w-5 text-gray-600 animate-spin flex-shrink-0" />
          ) : (
            <FileSpreadsheet className="h-5 w-5 text-gray-600 flex-shrink-0" />
          )}
          <span className="flex-1 text-gray-900 text-sm">{excelFile.name}</span>
          <span className="text-gray-600 text-sm">
            {(excelFile.size / 1024).toFixed(1)} KB
          </span>
          {!isExcelProcessing && totalExtractedCount > 0 && (
            <span className="text-[#0dcaf0] text-sm font-bold">
              ✓ {totalExtractedCount} serial numbers loaded
            </span>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-300 mt-4">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <span className="text-yellow-800 text-sm flex-1 whitespace-pre-line">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 rounded-full text-yellow-600 hover:text-yellow-800 hover:bg-yellow-200 transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
            aria-label="Close warning"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Display Extracted Serial Numbers */}
      {totalExtractedCount > 0 && (
          <div className="mt-6 space-y-4">
            {usageSummaryMessage && (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-200">
                <span className="text-gray-600 text-sm font-bold" style={{ fontFamily: "Jost, sans-serif" }}>{usageSummaryMessage}</span>
              </div>
            )}
            {usageMissingMessage && (
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <span className="text-red-600 text-sm font-bold" style={{ fontFamily: "Jost, sans-serif" }}>{usageMissingMessage}</span>
              </div>
            )}
            {extractedRows.length > 0 && (
              <>
                <h3 className="text-gray-900 font-semibold">
                  Missing Serial Numbers ({totalExtractedCount})
                </h3>
                <div className="border border-gray-200 bg-white rounded-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-900 hover:bg-transparent">
                        <th className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 text-left" style={{ width: '80px' }}>#</th>
                        <th className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 text-left" style={{ width: '50%' }}>
                          Serial Number
                        </th>
                        <th className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 text-left" style={{ width: '50%' }}>
                          Used Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {extractedRows.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50 border-b border-gray-100 group">
                          <td className="text-gray-600 text-sm font-bold px-6 py-4" style={{ fontFamily: 'Jost, sans-serif' }}>
                            {index + 1}
                          </td>
                          <td className="text-gray-600 text-sm font-bold px-6 py-4" style={{ fontFamily: 'Jost, sans-serif' }}>
                            {row.serial_number}
                          </td>
                          <td className="text-gray-600 text-sm font-bold px-6 py-4" style={{ fontFamily: 'Jost, sans-serif' }}>
                            {row.used_date}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

        </div>
      )}

      {/* Invoice Results Section */}
      <div className="space-y-4">
        {/* Scanning Indicator */}
        {isInvoiceScanning && (
          <div className="flex items-center justify-center gap-3 p-4 bg-white">
            <Loader className="h-5 w-5 text-gray-600 animate-spin" />
            <span className="text-gray-900">
              Matching invoice and lens records…
            </span>
          </div>
        )}

        {/* Reconciliation Result */}
        {invoiceFiles.length > 0 && !isInvoiceScanning && invoices.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-gray-900 font-semibold">Reconciliation Result</h3>

            {invoices.map((invoice, invoiceIndex) => {
              const isEditorOpen = showExtractionEditor && selectedInvoiceIndex === invoiceIndex;
              const pdfFileForInvoice =
                invoiceFiles.find((file) => file.name === invoice.fileName) ||
                invoiceFiles[invoiceIndex] ||
                null;

              const isMissingData =
                !invoice.invoiceNumber || invoice.invoiceNumber === "?" ||
                !invoice.issuerCompanyName || invoice.issuerCompanyName === "?" ||
                invoice.serialNumbers.length === 0;

              return (
                <div
                  key={invoiceIndex}
                  className="border border-gray-200 overflow-hidden"
                >
                  {/* Duplicate warning banner */}
                  {invoice.existsInDb && (
                    <div className="bg-red-50 border border-red-200 px-6 py-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-red-600 font-bold" style={{ fontFamily: "Jost, sans-serif" }}>
                            Invoice already exists. Proceed to overwrite, or remove this line to preserve the original.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Invoice Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-2 gap-4 flex-1">
                        <div>
                          <p className="text-black text-xs uppercase tracking-wider font-semibold">Invoice Number</p>
                          {!invoice.invoiceNumber || invoice.invoiceNumber === "?" ? (
                            <p className="text-red-600 font-bold">-</p>
                          ) : (
                            <p className="text-gray-900 font-bold">
                              {invoice.invoiceNumber}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-black text-xs uppercase tracking-wider font-semibold">Supplier</p>
                          {!invoice.issuerCompanyName || invoice.issuerCompanyName === "?" ? (
                            <p className="text-red-600 font-bold">-</p>
                          ) : (
                            <p className="text-gray-900 font-bold">{invoice.issuerCompanyName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOpenExtractionEditor(invoiceIndex)}
                          className={`inline-flex items-center gap-2 px-6 py-2 h-10 text-sm font-bold border-2 rounded-full transition-colors ${isMissingData ? "glow-border border-gray-300 text-purple-600 hover:border-purple-400 hover:text-purple-700" : "border-gray-400 text-gray-600 hover:border-gray-900 hover:text-gray-900"}`}
                          title="View PDF and edit extraction"
                        >
                          <Sparkles className="h-5 w-5" />
                          Edit/Learn
                        </button>
                        <button
                          onClick={() => handleRemoveInvoice(invoiceIndex)}
                          className="inline-flex items-center gap-2 px-6 py-2 h-10 text-sm font-bold text-gray-600 border-2 border-gray-400 rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors"
                          title="Remove this invoice"
                        >
                          <Trash2 className="h-5 w-5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Serial Numbers */}
                  <div className="bg-white">
                    <div className="px-6 py-3 border-b border-gray-200 bg-gray-200">
                      <div className="grid grid-cols-[minmax(120px,_2fr)_minmax(100px,_1fr)_minmax(100px,_1fr)_140px] items-center gap-4">
                        <span className="text-black text-xs uppercase tracking-wider font-semibold">sn</span>
                        <span className="text-black text-xs uppercase tracking-wider font-semibold">received</span>
                        <span className="text-black text-xs uppercase tracking-wider font-semibold">used</span>
                        <span className="text-black text-xs uppercase tracking-wider font-semibold">status</span>
                      </div>
                    </div>
                    <div>
                      {invoice.serialNumbers.length === 0 ? (
                        <div className="px-6 py-4 border-b border-gray-200 bg-white">
                          <div className="grid grid-cols-[minmax(120px,_2fr)_minmax(100px,_1fr)_minmax(100px,_1fr)_140px] items-center gap-4">
                            <span className="text-red-600 text-sm font-bold">-</span>
                            <span className="text-gray-500 text-sm font-bold">-</span>
                            <span className="text-gray-500 text-sm font-bold">-</span>
                            <span className="text-gray-500 text-sm font-bold">-</span>
                          </div>
                        </div>
                      ) : (
                        invoice.serialNumbers.map((item, snIndex) => {
                          const status = getStatusText(item.inReceive, item.inUse);

                          return (
                            <div key={snIndex} className="px-6 py-4 border-b border-gray-200 bg-white">
                              <div className="grid grid-cols-[minmax(120px,_2fr)_minmax(100px,_1fr)_minmax(100px,_1fr)_140px] items-center gap-4">
                                <span className="text-gray-900 text-sm font-bold" style={{ fontFamily: "Jost, sans-serif" }}>
                                  {item.sn}
                                </span>
                                <span className={`text-sm font-bold ${item.inReceive ? "text-gray-900" : "text-gray-500"}`}>
                                  {item.inReceive ? "Yes" : "No"}
                                </span>
                                <span className={`text-sm font-bold ${item.inUse ? "text-gray-900" : "text-gray-500"}`}>
                                  {item.inUse ? "Yes" : "No"}
                                </span>
                                <div className={`inline-flex items-center gap-2 text-sm font-bold ${status.color}`}>
                                  {status.text === "Matched" ? (
                                    <CheckCircle className="h-5 w-5" />
                                  ) : (
                                    <XCircle className="h-5 w-5" />
                                  )}
                                  <span>{status.text}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {isEditorOpen && (
                    <div className="border-t border-gray-200 bg-white">
                      <InvoiceExtractionEditor
                        invoice={invoice}
                        pdfFile={pdfFileForInvoice}
                        onSaveAndLearn={handleSaveAndLearn}
                        onClose={handleCloseExtractionEditor}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Upload Success Message */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-white border border-gray-200">
            <CheckCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <span
              className="text-gray-600 text-sm whitespace-pre-line font-bold"
              style={{ fontFamily: "Jost, sans-serif" }}
            >
              {successMessage}
            </span>
          </div>
        )}

        {/* Button Section */}
        {invoiceFiles.length > 0 && !isInvoiceScanning && invoices.length > 0 && (
          <div className="flex justify-end gap-4">
            <button
              onClick={handleClearInvoices}
              disabled={isInvoiceUploading}
              className="inline-flex items-center gap-2 px-6 py-2 h-10 border-2 border-gray-400 text-gray-600 text-sm font-bold rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-5 w-5" />
              Clear
            </button>
            {!isInvoiceUploaded ? (
              <button
                onClick={handleUploadAllInvoices}
                disabled={isInvoiceUploading}
                className="inline-flex items-center gap-2 px-6 py-2 h-10 bg-[#0dcaf0] text-white border-2 border-[#0dcaf0] rounded-full hover:bg-[#0bb8d9] hover:border-[#0bb8d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
              >
                <Upload className="h-5 w-5" />
                {isInvoiceUploading ? "Uploading..." : "Upload"}
              </button>
            ) : invoices.length > 0 ? (
              <button
                className="inline-flex items-center gap-2 px-6 py-2 h-10 border-2 border-gray-400 text-gray-600 text-sm font-bold rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors"
                onClick={exportExcel}
              >
                <Download className="h-5 w-5" />
                Export Results
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

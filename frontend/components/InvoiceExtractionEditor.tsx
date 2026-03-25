import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "./ui/input";
import { type Invoice } from "./usage-invoice/types";

interface InvoiceExtractionEditorProps {
  invoice: Invoice;
  pdfFile: File | null;
  onSaveAndLearn: (
    invoice: Invoice,
    corrections: {
      invoiceNumber?: string;
      companyName?: string;
      serialNumbers?: string[];
    }
  ) => Promise<void>;
  onClose: () => void;
}

function generateLayoutId(pdfText: string, company: string): string {
  const textSample = pdfText.substring(0, 200).replace(/\s+/g, "");
  let hash = 0;
  for (let i = 0; i < textSample.length; i++) {
    const char = textSample.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `${company.toLowerCase().substring(0, 4)}${Math.abs(hash)
    .toString(16)
    .substring(0, 8)}`;
}

export function InvoiceExtractionEditor({
  invoice,
  pdfFile,
  onSaveAndLearn,
  onClose,
}: InvoiceExtractionEditorProps) {
  const [editedInvoiceNumber, setEditedInvoiceNumber] = useState("");
  const [editedCompanyName, setEditedCompanyName] = useState("");
  const [editedSerialNumbers, setEditedSerialNumbers] = useState<string[]>([]);
  const [newSerialNumber, setNewSerialNumber] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Bug 2: Track if we have successfully saved to hide warnings
  const [hasSaved, setHasSaved] = useState(false);
  // Track the values at the time of save to detect new changes
  const savedValuesRef = useRef<{
    invoiceNumber: string;
    companyName: string;
    serialNumbers: string[];
  } | null>(null);

  const pdfUrl = useMemo(() => {
    if (pdfFile) {
      return URL.createObjectURL(pdfFile);
    }
    return null;
  }, [pdfFile]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    // Only reset state when switching to a DIFFERENT invoice (by fileName)
    // Don't reset if invoice was just updated after save
    // Don't prefill "?" - leave empty for placeholder to show
    const invoiceNum = invoice.invoiceNumber === "?" ? "" : (invoice.invoiceNumber || "");
    const companyName = (invoice.issuerCompanyName === "?" ? "" : invoice.issuerCompanyName) || 
                        (invoice.company === "?" ? "" : invoice.company) || "";
    setEditedInvoiceNumber(invoiceNum);
    setEditedCompanyName(companyName);
    setEditedSerialNumbers(invoice.serialNumbers.map((s) => s.sn));
    setSaveMessage(null);
    // Don't reset hasSaved here - it will be handled by the save logic
  }, [invoice.fileName]); // Only trigger when switching to a different invoice file

  // Reset hasSaved and savedValuesRef when switching to a new invoice
  useEffect(() => {
    setHasSaved(false);
    savedValuesRef.current = null;
  }, [invoice.fileName]);

  const layoutId = useMemo(
    () => generateLayoutId(invoice.pdfText, invoice.company || "unknown"),
    [invoice.pdfText, invoice.company]
  );

  const handleAddSerialNumber = () => {
    const value = newSerialNumber.trim();
    if (value && !editedSerialNumbers.includes(value)) {
      setEditedSerialNumbers([...editedSerialNumbers, value]);
      setNewSerialNumber("");
    }
  };

  const handleRemoveSerialNumber = (index: number) => {
    setEditedSerialNumbers(editedSerialNumbers.filter((_, i) => i !== index));
  };

  const handleUpdateSerialNumber = (index: number, value: string) => {
    const updated = [...editedSerialNumbers];
    updated[index] = value;
    setEditedSerialNumbers(updated);
  };

  const handleSaveAndLearn = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const corrections: {
        invoiceNumber?: string;
        companyName?: string;
        serialNumbers?: string[];
      } = {};

      if (editedInvoiceNumber !== (invoice.invoiceNumber || "")) {
        corrections.invoiceNumber = editedInvoiceNumber;
      }
      if (editedCompanyName !== (invoice.issuerCompanyName || "")) {
        corrections.companyName = editedCompanyName;
      }
      if (
        editedSerialNumbers.join("|") !==
        invoice.serialNumbers.map((s) => s.sn).join("|")
      ) {
        corrections.serialNumbers = editedSerialNumbers;
      }

      // Bug 3: If there is a pending serial number in the input box, add it now
      let finalSerialNumbers = editedSerialNumbers;
      if (newSerialNumber.trim()) {
        const snToAdd = newSerialNumber.trim();
        if (!editedSerialNumbers.includes(snToAdd)) {
          finalSerialNumbers = [...editedSerialNumbers, snToAdd];
          corrections.serialNumbers = finalSerialNumbers;
          // Also update local state so UI reflects it
          setEditedSerialNumbers(finalSerialNumbers);
          setNewSerialNumber("");
        }
      }

      await onSaveAndLearn(invoice, corrections);

      // Record the values at save time to detect future changes
      savedValuesRef.current = {
        invoiceNumber: editedInvoiceNumber,
        companyName: editedCompanyName,
        serialNumbers: finalSerialNumbers,
      };
      setHasSaved(true); // Mark as saved

      setSaveMessage({
        type: "success",
        text: "Saved extraction pattern.",
      });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: "Failed to save changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show warning only when extracted data is incomplete (missing invoice number, supplier, or serial numbers)
  const isMissingData = 
    !invoice.invoiceNumber || 
    invoice.invoiceNumber === "?" || 
    !invoice.issuerCompanyName || 
    invoice.issuerCompanyName === "?" ||
    !invoice.company ||
    invoice.company === "?" ||
    invoice.serialNumbers.length === 0;

  // Check if there are changes from original values
  const hasChanges = useMemo(() => {
    // If we just saved, consider "no changes" until user edits something again
    // But wait, if user edits, hasSaved should be reset? 
    // Actually, we can just check if current values differ from original.
    // If we saved, the parent component might have updated the "original" invoice prop, or not?
    // In UsageAndInvoicePanel, we update the state. So `invoice` prop changes.
    // So hasSaved will be reset to false by the useEffect above.
    // HOWEVER, if we want to disable the button immediately after save without parent update causing a reset loop:
    // We need to ensure logic is sound.

    // When parent updates invoice, useEffect calls setHasSaved(false).
    // So if the parent update happens, hasSaved goes to false, which is typically what we want (reset for next edit).
    // But the user wants: "Button becomes grey/disabled because already saved, unless edited again".
    // If parent updates `invoice` prop to match `edited...` values, then `hasChanges` becomes false naturally.
    // So we rely on `hasChanges` being false.

    // BUT what if parent doesn't update immediately or we want to force "Saved" state?
    // Let's rely on standard comparison first.

    const invoiceNumberChanged = editedInvoiceNumber !== (invoice.invoiceNumber || "");
    const companyNameChanged = editedCompanyName !== (invoice.issuerCompanyName || "");
    const serialNumbersChanged = editedSerialNumbers.join("|") !== invoice.serialNumbers.map((s) => s.sn).join("|");
    return invoiceNumberChanged || companyNameChanged || serialNumbersChanged;
  }, [editedInvoiceNumber, editedCompanyName, editedSerialNumbers, invoice]);

  // Reset hasSaved only when user edits values DIFFERENT from what was saved
  useEffect(() => {
    if (hasSaved && savedValuesRef.current) {
      const saved = savedValuesRef.current;
      const invoiceNumberDiffers = editedInvoiceNumber !== saved.invoiceNumber;
      const companyNameDiffers = editedCompanyName !== saved.companyName;
      const serialNumbersDiffer = editedSerialNumbers.join("|") !== saved.serialNumbers.join("|");
      const hasNewPendingSN = newSerialNumber.trim().length > 0;
      
      if (invoiceNumberDiffers || companyNameDiffers || serialNumbersDiffer || hasNewPendingSN) {
        setHasSaved(false);
        savedValuesRef.current = null;
      }
    }
  }, [editedInvoiceNumber, editedCompanyName, editedSerialNumbers, newSerialNumber, hasSaved]);

  // Bug 1 Refinement: Button should be disabled if fields are empty
  // User Requirement: Must have Invoice #, Supplier, AND at least one Serial Number (or pending input)
  const hasSerialNumber = editedSerialNumbers.length > 0 || newSerialNumber.trim().length > 0;
  const areRequiredFieldsFilled = Boolean(editedInvoiceNumber && editedCompanyName && hasSerialNumber);

  // Check if user has pending new serial number to add
  const hasPendingNewSN = newSerialNumber.trim().length > 0;

  // canSave logic:
  // - Required fields must be filled
  // - Not currently saving
  // - Not already saved (button becomes disabled after successful save)
  // - User has made changes OR has pending new serial number
  const canSave = areRequiredFieldsFilled && !isSaving && !hasSaved && (hasChanges || hasPendingNewSN);

  return (
    <div className="w-full bg-white rounded-none border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Invoice Extraction: {invoice.fileName}
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-6 bg-white p-4" style={{ minHeight: "560px" }}>
        <div className="flex-1 bg-white border border-gray-200 rounded-none overflow-hidden">
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#view=FitH`}
              className="block w-full"
              style={{ height: 720 }}
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-[720px] text-gray-500">
              <p>PDF preview not available</p>
            </div>
          )}
        </div>

        <div className="w-[420px] bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="text-2xl font-bold text-gray-800">Extracted Data</h4>
            {isMissingData && !hasSaved && (
              <p
                className="text-sm mt-1 font-medium"
                style={{ color: '#ea580c' }}
              >
                New layout detected. Please verify and correct the extracted data.
              </p>
            )}
            {invoice.existsInDb && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-600 font-bold" style={{ fontFamily: "Jost, sans-serif" }}>
                      Invoice already exists. Proceed to overwrite, or close to preserve the original.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 space-y-6">
            <div>
              <label className="block text-base font-bold text-gray-700 mb-1.5">
                Invoice Number
              </label>
              <Input
                value={editedInvoiceNumber}
                onChange={(e) => setEditedInvoiceNumber(e.target.value)}
                placeholder="Add invoice number"
                className="w-full text-lg font-semibold rounded-lg"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-gray-800 mb-2">
                Supplier Name
              </label>
              <Input
                value={editedCompanyName}
                onChange={(e) => setEditedCompanyName(e.target.value)}
                placeholder="Add supplier name"
                className="w-full text-lg font-semibold rounded-lg"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-gray-800 mb-2">
                Serial Numbers
              </label>
              <div className="space-y-2">
                {editedSerialNumbers.map((sn, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={sn}
                      onChange={(e) => handleUpdateSerialNumber(index, e.target.value)}
                      className="flex-1 text-lg font-semibold rounded-lg"
                    />
                    <button
                      onClick={() => handleRemoveSerialNumber(index)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Remove serial number"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <Input
                    value={newSerialNumber}
                    onChange={(e) => setNewSerialNumber(e.target.value)}
                    placeholder="Add serial number"
                    className="flex-1 text-lg font-semibold rounded-lg"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSerialNumber();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddSerialNumber}
                    disabled={!newSerialNumber.trim()}
                    className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    aria-label="Add serial number"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="text-gray-400" style={{ fontSize: '12px' }}>
              Layout ID: {layoutId}
            </div>

            {saveMessage && (
              <div
                className={`flex items-center gap-2 p-4 text-sm font-bold border ${saveMessage.type === "success"
                  ? "bg-white border-gray-200 text-gray-600"
                  : "bg-red-50 border-red-200 text-red-700"
                  }`}
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                {saveMessage.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-gray-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span>{saveMessage.text}</span>
              </div>
            )}

            <button
              onClick={handleSaveAndLearn}
              disabled={isSaving || !canSave}
              className={`w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full shadow-sm transition-all font-bold text-sm border-2 disabled:opacity-50 disabled:cursor-not-allowed ${canSave
                ? "bg-[#0dcaf0] text-white border-[#0dcaf0] hover:bg-[#0bb8d9] hover:border-[#0bb8d9] hover:scale-[1.02]"
                : "bg-gray-200 text-gray-400 border-gray-300"
                }`}
            >
              {isSaving && <Loader className="h-4 w-4 animate-spin mr-2" />}
              Save Pattern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

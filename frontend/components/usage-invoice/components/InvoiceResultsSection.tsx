import {
  AlertCircle,
  CheckCircle,
  Loader,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { InvoiceExtractionEditor } from "../../InvoiceExtractionEditor";
import { type Invoice } from "../types";

interface InvoiceResultsSectionProps {
  isInvoiceScanning: boolean;
  invoiceFiles: File[];
  invoices: Invoice[];
  showExtractionEditor: boolean;
  selectedInvoiceIndex: number | null;
  onOpenExtractionEditor: (invoiceIndex: number) => void;
  onCloseExtractionEditor: () => void;
  onRemoveInvoice: (invoiceIndex: number) => void;
  onSaveAndLearn: (
    invoice: Invoice,
    corrections: {
      invoiceNumber?: string;
      companyName?: string;
      serialNumbers?: string[];
    },
  ) => Promise<void>;
  getStatusText: (inReceive: boolean, inUse: boolean) => {
    text: string;
    color: string;
  };
  successMessage: string | null;
}

export const InvoiceResultsSection = ({
  isInvoiceScanning,
  invoiceFiles,
  invoices,
  showExtractionEditor,
  selectedInvoiceIndex,
  onOpenExtractionEditor,
  onCloseExtractionEditor,
  onRemoveInvoice,
  onSaveAndLearn,
  getStatusText,
  successMessage,
}: InvoiceResultsSectionProps) => {
  return (
    <div className="space-y-4">
      {isInvoiceScanning && (
        <div className="flex items-center justify-center gap-3 p-4 bg-white">
          <Loader className="h-5 w-5 text-gray-600 animate-spin" />
          <span className="text-gray-900">
            Matching invoice and lens records…
          </span>
        </div>
      )}

      {invoiceFiles.length > 0 && !isInvoiceScanning && invoices.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-gray-900 font-semibold">Reconciliation Result</h3>

          {invoices.map((invoice, invoiceIndex) => {
            const isEditorOpen =
              showExtractionEditor && selectedInvoiceIndex === invoiceIndex;
            const pdfFileForInvoice =
              invoiceFiles.find((file) => file.name === invoice.fileName) ||
              invoiceFiles[invoiceIndex] ||
              null;

            const isMissingData =
              !invoice.invoiceNumber || 
              invoice.invoiceNumber === "?" || 
              invoice.invoiceNumber === "" ||
              !invoice.company || 
              invoice.company === "?" ||
              invoice.company === "" ||
              invoice.serialNumbers.length === 0;

            return (
              <div
                key={invoiceIndex}
                className="border border-gray-200 overflow-hidden"
              >
                {invoice.existsInDb && (
                  <div className="bg-red-50 border border-red-200 px-6 py-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p
                          className="text-sm text-red-600 font-bold"
                          style={{ fontFamily: "Jost, sans-serif" }}
                        >
                          Invoice already exists. Proceed to overwrite, or remove this line to preserve the original.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-2 gap-4 flex-1">
                      <div>
                        <p className="text-black text-xs uppercase tracking-wider font-semibold">
                          Invoice Number
                        </p>
                        {!invoice.invoiceNumber || invoice.invoiceNumber === "?" || invoice.invoiceNumber === "" ? (
                          <p className="text-red-500 font-bold text-lg">-</p>
                        ) : (
                          <p className="text-gray-900 font-bold">
                            {invoice.invoiceNumber}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-black text-xs uppercase tracking-wider font-semibold">
                          Supplier
                        </p>
                        {!invoice.company || invoice.company === "?" || invoice.company === "" ? (
                          <p className="text-red-500 font-bold text-lg">-</p>
                        ) : (
                          <p className="text-gray-900 font-bold">
                            {invoice.company}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onOpenExtractionEditor(invoiceIndex)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-all ${
                          isMissingData
                            ? "glow-border text-purple-600 hover:text-purple-700"
                            : "text-gray-600 border-2 border-gray-300 hover:border-gray-400 hover:text-gray-900"
                        }`}
                        title="View PDF and edit extraction"
                      >
                        <Sparkles className={`h-4 w-4 ${isMissingData ? "text-purple-500" : ""}`} />
                        Edit/Learn
                      </button>
                      <button
                        onClick={() => onRemoveInvoice(invoiceIndex)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border-2 border-gray-300 rounded-full hover:border-gray-400 hover:text-gray-900 transition-colors"
                        title="Remove this invoice"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white">
                  <div className="px-6 py-3 bg-gray-100">
                    <p className="text-black text-xs uppercase tracking-wider font-semibold">
                      Serial Number
                    </p>
                  </div>
                  <div>
                    {invoice.serialNumbers.length === 0 ? (
                      <div className="px-6 py-4 border-b border-gray-200 bg-white">
                        <p className="text-red-500 font-bold text-lg">-</p>
                      </div>
                    ) : (
                    invoice.serialNumbers.map((item, snIndex) => {
                      const status = getStatusText(item.inReceive, item.inUse);

                      return (
                        <div
                          key={snIndex}
                          className="px-6 py-4 border-b border-gray-200 bg-white"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <span
                                className="text-gray-600 text-sm font-bold min-w-[120px]"
                                style={{ fontFamily: "Jost, sans-serif" }}
                              >
                                {item.sn}
                              </span>
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                  {item.inReceive ? (
                                    <CheckCircle className="h-4 w-4 text-[#0dcaf0]" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-[#FFAA07]" />
                                  )}
                                  <span className="text-gray-600 text-sm">
                                    Received
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.inUse ? (
                                    <CheckCircle className="h-4 w-4 text-[#0dcaf0]" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-[#FFAA07]" />
                                  )}
                                  <span className="text-gray-600 text-sm">
                                    Used
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              disabled
                              className={`px-4 py-1 rounded-full text-sm text-white w-28 ${
                                status.color === "text-[#0dcaf0]"
                                  ? "bg-[#0dcaf0]"
                                  : "bg-[#FFAA07]"
                              } cursor-default`}
                            >
                              {status.text}
                            </button>
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
                      onSaveAndLearn={onSaveAndLearn}
                      onClose={onCloseExtractionEditor}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
};

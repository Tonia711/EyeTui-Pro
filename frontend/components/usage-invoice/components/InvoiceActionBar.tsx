import { Download, Upload, X } from "lucide-react";

interface InvoiceActionBarProps {
  show: boolean;
  isInvoiceUploading: boolean;
  isInvoiceUploaded: boolean;
  onClearInvoices: () => void;
  onUploadAllInvoices: () => void;
  onExportResults: () => void;
}

export const InvoiceActionBar = ({
  show,
  isInvoiceUploading,
  isInvoiceUploaded,
  onClearInvoices,
  onUploadAllInvoices,
  onExportResults,
}: InvoiceActionBarProps) => {
  if (!show) return null;

  return (
    <div className="flex justify-end gap-4">
      <button
        onClick={onClearInvoices}
        disabled={isInvoiceUploading}
        className="inline-flex items-center gap-2 px-6 py-2 border-2 border-gray-400 text-gray-600 rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <X className="h-5 w-5" />
        Clear
      </button>
      {!isInvoiceUploaded ? (
        <button
          onClick={onUploadAllInvoices}
          disabled={isInvoiceUploading}
          className="inline-flex items-center gap-2 px-6 py-2 bg-[#0dcaf0] text-white rounded-full hover:bg-[#0bb8d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Upload className="h-5 w-5" />
          {isInvoiceUploading ? "Uploading..." : "Upload"}
        </button>
      ) : (
        <button
          className="inline-flex items-center gap-2 px-6 py-2 border-2 border-gray-400 text-gray-600 rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors"
          onClick={onExportResults}
        >
          <Download className="h-5 w-5" />
          Export Results
        </button>
      )}
    </div>
  );
};

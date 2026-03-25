import type { DragEvent, RefObject } from "react";
import { FileText } from "lucide-react";

interface InvoiceUploadSectionProps {
  isInvoiceDragging: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (files: FileList | null) => void;
  invoiceFileInputRef: RefObject<HTMLInputElement>;
}

export const InvoiceUploadSection = ({
  isInvoiceDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  invoiceFileInputRef,
}: InvoiceUploadSectionProps) => {

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`border-2 border-dashed p-10 transition-colors ${
        isInvoiceDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
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
            onChange={(e) => onFileChange(e.target.files)}
          />
        </label>
        <p className="mt-5 text-gray-600 text-sm">
          Upload one or more PDF invoices for reconciliation.
        </p>
      </div>
    </div>
  );
};

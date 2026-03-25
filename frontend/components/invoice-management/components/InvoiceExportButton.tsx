import { Download } from "lucide-react";

interface InvoiceExportButtonProps {
  onExport: () => void;
}

export const InvoiceExportButton = ({ onExport }: InvoiceExportButtonProps) => {
  return (
    <div className="flex justify-end">
      <button
        onClick={onExport}
        className="inline-flex items-center gap-2 px-6 py-2 h-10 border-2 border-gray-400 text-gray-600 text-sm font-bold rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors"
      >
        <Download className="h-5 w-5" />
        Export to Excel
      </button>
    </div>
  );
};

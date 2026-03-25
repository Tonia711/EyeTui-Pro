import type { DragEvent, RefObject } from "react";
import { FileSpreadsheet } from "lucide-react";

interface UsageUploadSectionProps {
  isExcelDragging: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (file: File | null) => void;
  excelFileInputRef: RefObject<HTMLInputElement>;
}

export const UsageUploadSection = ({
  isExcelDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  excelFileInputRef,
}: UsageUploadSectionProps) => {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`border-2 border-dashed p-10 transition-colors ${
        isExcelDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
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
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
        </label>
        <p className="text-gray-600 text-sm text-center mt-4">
          Upload an Excel file containing used lens information.
        </p>
      </div>
    </div>
  );
};

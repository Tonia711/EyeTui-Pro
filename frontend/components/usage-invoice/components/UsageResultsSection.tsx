import { AlertCircle, FileSpreadsheet, Loader, X } from "lucide-react";
import { type ExtractedUsageRow } from "../types";

interface UsageResultsSectionProps {
  excelFile: File | null;
  isExcelProcessing: boolean;
  totalExtractedCount: number;
  error: string | null;
  onClearError: () => void;
  usageSummaryMessage: string | null;
  usageMissingMessage: string | null;
  extractedRows: ExtractedUsageRow[];
}

export const UsageResultsSection = ({
  excelFile,
  isExcelProcessing,
  totalExtractedCount,
  error,
  onClearError,
  usageSummaryMessage,
  usageMissingMessage,
  extractedRows,
}: UsageResultsSectionProps) => {
  return (
    <>
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

      {error && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-300 mt-4">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <span className="text-yellow-800 text-sm flex-1 whitespace-pre-line">
            {error}
          </span>
          <button
            onClick={onClearError}
            className="p-1 rounded-full text-yellow-600 hover:text-yellow-800 hover:bg-yellow-200 transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
            aria-label="Close warning"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {totalExtractedCount > 0 && (
        <div className="mt-6 space-y-4">
          {usageSummaryMessage && (
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-200">
              <span
                className="text-gray-600 text-sm font-bold"
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                {usageSummaryMessage}
              </span>
            </div>
          )}
          {usageMissingMessage && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span
                className="text-red-600 text-sm font-bold"
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                {usageMissingMessage}
              </span>
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
                      <th
                        className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 text-left"
                        style={{ width: "80px" }}
                      >
                        #
                      </th>
                      <th
                        className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 text-left"
                        style={{ width: "50%" }}
                      >
                        Serial Number
                      </th>
                      <th
                        className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 text-left"
                        style={{ width: "50%" }}
                      >
                        Used Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {extractedRows.map((row, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 border-b border-gray-100 group"
                      >
                        <td
                          className="text-gray-600 text-sm font-bold px-6 py-4"
                          style={{ fontFamily: "Jost, sans-serif" }}
                        >
                          {index + 1}
                        </td>
                        <td
                          className="text-gray-600 text-sm font-bold px-6 py-4"
                          style={{ fontFamily: "Jost, sans-serif" }}
                        >
                          {row.serial_number}
                        </td>
                        <td
                          className="text-gray-600 text-sm font-bold px-6 py-4"
                          style={{ fontFamily: "Jost, sans-serif" }}
                        >
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
    </>
  );
};

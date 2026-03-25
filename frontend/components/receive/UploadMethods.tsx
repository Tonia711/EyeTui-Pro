import { Upload, Camera, ScanLine } from "lucide-react";
import { useMemo, type DragEvent, type RefObject } from "react";

interface UploadMethodsProps {
  selectedSite: string;
  showCamera: boolean;
  showBarcodeScannerInput: boolean;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  hoveredButton: "camera" | "scanner" | "upload" | null;
  setHoveredButton: (value: "camera" | "scanner" | "upload" | null) => void;
  startCamera: () => void;
  startBarcodeScanner: () => void;
  showStudyMode: boolean;
  showUploadFileTooltip: boolean;
  setShowUploadFileTooltip: (value: boolean) => void;
  handleFileChange: (file: File | null) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  onDrop: (e: DragEvent) => void;
}

export function UploadMethods({
  selectedSite,
  showCamera,
  showBarcodeScannerInput,
  isDragging,
  setIsDragging,
  hoveredButton,
  setHoveredButton,
  startCamera,
  startBarcodeScanner,
  showStudyMode,
  showUploadFileTooltip,
  setShowUploadFileTooltip,
  handleFileChange,
  fileInputRef,
  onDrop,
}: UploadMethodsProps) {
  const uploadButtonStyles = useMemo(() => {
    return {
      base:
        "flex items-center justify-center gap-2 px-6 py-2 h-10 rounded-full text-sm font-bold text-gray-600 border-2 flex-shrink-0 flex-grow-0 transition-colors",
      widthStyles: {
        width: "300px",
        minWidth: "300px",
        maxWidth: "300px",
        boxSizing: "border-box" as const,
        fontFamily: "Jost, sans-serif",
      },
    };
  }, []);

  return (
    <div>
      <p className="text-gray-400 text-sm font-bold mb-6 text-left">
        Use one of the following methods to upload the received lens information
      </p>
      <div
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed p-4 transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
      >
        <div>
          {/* Capture barcode */}
          <div className="flex items-center gap-4 py-3">
            <button
              onClick={startCamera}
              disabled={!selectedSite}
              onMouseEnter={() => selectedSite && setHoveredButton("camera")}
              onMouseLeave={() => setHoveredButton(null)}
              style={uploadButtonStyles.widthStyles}
              className={`${uploadButtonStyles.base} ${
                !selectedSite
                  ? "!bg-gray-100 !text-gray-300 !border-gray-200 cursor-not-allowed"
                  : showCamera || hoveredButton === "camera"
                    ? "bg-[#0dcaf0] text-white border-[#0dcaf0] cursor-pointer"
                    : showBarcodeScannerInput
                      ? "bg-white text-gray-500 border-gray-400 hover:bg-[#0dcaf0] hover:text-white hover:border-[#0dcaf0] cursor-pointer"
                      : hoveredButton === "scanner" || hoveredButton === "upload"
                        ? "bg-white text-gray-500 border-gray-400 cursor-pointer"
                        : "bg-[#0dcaf0] text-white border-[#0dcaf0] hover:bg-[#0bb8d9] hover:border-[#0bb8d9] cursor-pointer"
              }`}
            >
              <Camera className="h-5 w-5 transition-colors" style={{ color: "inherit" }} />
              Capture barcode
            </button>
            <p className="text-gray-400 text-sm font-bold">
              Automatically extract lens details from the barcode.
            </p>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Scan barcode */}
          <div className="flex items-center gap-4 py-3">
            <button
              onClick={startBarcodeScanner}
              disabled={!selectedSite}
              onMouseEnter={() => selectedSite && setHoveredButton("scanner")}
              onMouseLeave={() => setHoveredButton(null)}
              style={uploadButtonStyles.widthStyles}
              className={`${uploadButtonStyles.base} ${
                !selectedSite
                  ? "!bg-gray-100 !text-gray-300 !border-gray-200 cursor-not-allowed"
                  : showBarcodeScannerInput || hoveredButton === "scanner"
                    ? "bg-[#0dcaf0] text-white border-[#0dcaf0] cursor-pointer"
                    : "bg-white text-gray-500 border-gray-400 hover:bg-[#0dcaf0] hover:text-white hover:border-[#0dcaf0] cursor-pointer"
              }`}
            >
              <ScanLine className="h-5 w-5 transition-colors" style={{ color: "inherit" }} />
              Scan barcode
            </button>
            <p className="text-gray-400 text-sm font-bold">
              Scan lens barcodes using a handheld scanner.
            </p>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Upload file */}
          <div className="flex items-center gap-4 py-3">
            <div
              style={{
                position: "relative",
                display: "inline-block",
                cursor: !selectedSite || showStudyMode ? "not-allowed" : undefined,
              }}
              onMouseEnter={() => {
                if (selectedSite && !showStudyMode) {
                  setHoveredButton("upload");
                }
                if (showStudyMode) {
                  setShowUploadFileTooltip(true);
                }
              }}
              onMouseLeave={() => {
                setHoveredButton(null);
                if (showStudyMode) {
                  setShowUploadFileTooltip(false);
                }
              }}
            >
              <label
                className={`inline-block ${
                  !selectedSite || showStudyMode ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                style={!selectedSite || showStudyMode ? { pointerEvents: "none" } : {}}
              >
                <span
                  style={{
                    width: "300px",
                    minWidth: "300px",
                    maxWidth: "300px",
                    boxSizing: "border-box",
                    backgroundColor:
                      !selectedSite || showStudyMode
                        ? undefined
                        : hoveredButton === "upload"
                          ? "#0dcaf0"
                          : undefined,
                    color:
                      !selectedSite || showStudyMode
                        ? undefined
                        : hoveredButton === "upload"
                          ? "white"
                          : undefined,
                    borderColor:
                      !selectedSite || showStudyMode
                        ? undefined
                        : hoveredButton === "upload"
                          ? "#0dcaf0"
                          : undefined,
                    pointerEvents: !selectedSite || showStudyMode ? "none" : "auto",
                    fontFamily: "Jost, sans-serif",
                  }}
                  className={`${uploadButtonStyles.base} ${
                    !selectedSite || showStudyMode
                      ? "!bg-gray-100 !text-gray-300 !border-gray-200 cursor-not-allowed"
                      : hoveredButton === "upload"
                        ? ""
                        : "bg-white text-gray-500 border-gray-400"
                  }`}
                >
                  <Upload className="h-5 w-5 transition-colors" style={{ color: "inherit" }} />
                  Upload file
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  disabled={!selectedSite || showStudyMode}
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>
              {showStudyMode && showUploadFileTooltip && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#1f2937",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    zIndex: 1000,
                    pointerEvents: "none",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                >
                  There is no learning mode for uploading files.
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: "6px solid #1f2937",
                    }}
                  />
                </div>
              )}
            </div>
            <p className="text-gray-400 text-sm font-bold">
              Choose files or drag & drop it here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

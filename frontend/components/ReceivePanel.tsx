import { useEffect, useMemo, useState, type DragEvent } from "react";
import { FileSpreadsheet, X, Loader, AlertCircle } from "lucide-react";
import { type ComboboxOption } from "./ui/combobox";
import { ClinicSelector } from "./receive/ClinicSelector";
import { EntriesTable } from "./receive/EntriesTable";
import { LearningModeTable } from "./receive/LearningModeTable";
import { UploadMethods } from "./receive/UploadMethods";
import { useReceiveMappings } from "./receive/hooks/useReceiveMappings";
import { useClinicMenu } from "./receive/hooks/useClinicMenu";
import { useReceiveEntries } from "./receive/hooks/useReceiveEntries";
import { useBarcodeScanner } from "./receive/hooks/useBarcodeScanner";
import { useCameraCapture } from "./receive/hooks/useCameraCapture";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";
const REFERENCE_DATA_CHANGED_EVENT = "eyetui:reference-data-changed";

// Power options: 18-24 with step 0.5
const POWER_OPTIONS: ComboboxOption[] = (() => {
  const options: ComboboxOption[] = [];
  for (let i = 18; i <= 24; i += 0.5) {
    const value = i.toFixed(1);
    options.push({ value: `+${value}D`, label: `+${value}D` });
  }
  return options;
})();

interface ReceivePanelProps {
  onUploadSuccess?: () => void;
}

export function ReceivePanel({ onUploadSuccess }: ReceivePanelProps) {
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<
    "camera" | "scanner" | "upload" | null
  >(null);
  const [showLearningModeTooltip, setShowLearningModeTooltip] = useState(false);
  const [showUploadFileTooltip, setShowUploadFileTooltip] = useState(false);
  const {
    companyOptions,
    typeOptions,
    siteOptions,
    companyTypeMap,
    typeToCompanyMap,
  } = useReceiveMappings({
    apiBaseUrl: API_BASE_URL,
    referenceDataEvent: REFERENCE_DATA_CHANGED_EVENT,
    setErrorMessage,
  });

  const {
    clinicMenuOpen,
    setClinicMenuOpen,
    clinicMenuRect,
    setClinicMenuRect,
    clinicButtonRef,
    calculateRect,
  } = useClinicMenu();

  const {
    excelFiles,
    entries,
    editingId,
    editingField,
    duplicateSNs,
    serverDuplicates,
    uploadMessage,
    uploading,
    fileInputRef,
    addEntries,
    handleFileChange,
    updateSerialNumber,
    deleteSerialNumber,
    startEditing,
    stopEditing,
    handleSubmit,
    handleCancel,
    handleClearLearningEntries: clearLearningEntriesBase,
    handleUploadLearningMode,
    setEntries,
    setServerDuplicates,
    setUploadMessage,
  } = useReceiveEntries({
    apiBaseUrl: API_BASE_URL,
    typeToCompanyMap,
    setErrorMessage,
    onUploadSuccess,
  });

  const {
    showBarcodeScannerInput,
    barcodeInputRef,
    startBarcodeScanner,
    stopBarcodeScanner,
    handleBarcodeInput,
    handleBarcodePaste,
    handleBarcodeKeyDown,
    showStudyMode,
    isLearning,
    learnSuccess,
    setLearnSuccess,
    patternSaved,
    setPatternSaved,
    handleLearningModeToggle,
    handleSavePattern,
  } = useBarcodeScanner({
    apiBaseUrl: API_BASE_URL,
    entries,
    addEntries,
    setEntries,
    setErrorMessage,
    setUploadMessage,
  });

  const {
    showCamera,
    isScanning,
    lastScanned,
    capturedDataUrl,
    processing,
    availableDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    isFrontCamera,
    videoRef,
    startCamera,
    stopCamera,
    handleCaptureAndScan,
    handleRetake,
  } = useCameraCapture({
    apiBaseUrl: API_BASE_URL,
    showStudyMode,
    addEntries,
    setErrorMessage,
    setUploadMessage,
  });

  const handleStopBarcodeScanner = () => {
    setHoveredButton(null);
    stopBarcodeScanner();
  };

  const handleClearLearningEntries = () => {
    clearLearningEntriesBase();
    setPatternSaved(false);
    setLearnSuccess(false);
    setErrorMessage("");
  };

  const handleSubmitSelected = () => handleSubmit(selectedSite);
  const handleUploadLearningModeSelected = async () => {
    const hasDuplicates = await handleUploadLearningMode(selectedSite);
    if (hasDuplicates === false) {
      setPatternSaved(false);
    }
  };

  // Keep upload messages visible until user clears them.

  useEffect(() => {
    if (!showBarcodeScannerInput) {
      setHoveredButton(null);
    }
  }, [showBarcodeScannerInput]);

  const clinicOptions: { value: string; label: string }[] = useMemo(() => {
    return siteOptions.map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }, [siteOptions]);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (
      droppedFile &&
      (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".csv"))
    ) {
      handleFileChange(droppedFile);
    }
  };


  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div className="space-y-6">
      <ClinicSelector
        selectedSite={selectedSite}
        setSelectedSite={setSelectedSite}
        clinicMenuOpen={clinicMenuOpen}
        setClinicMenuOpen={setClinicMenuOpen}
        clinicMenuRect={clinicMenuRect}
        setClinicMenuRect={setClinicMenuRect}
        clinicButtonRef={clinicButtonRef}
        calculateRect={calculateRect}
        clinicOptions={clinicOptions}
        entriesCount={entries.length}
        learningEntriesCount={entries.filter((e) => e.originalBarcode).length}
        showStudyMode={showStudyMode}
        showLearningModeTooltip={showLearningModeTooltip}
        setShowLearningModeTooltip={setShowLearningModeTooltip}
        handleLearningModeToggle={handleLearningModeToggle}
      />


      {/* File Upload Area */}
      {!showCamera && !showBarcodeScannerInput && (
        <UploadMethods
          selectedSite={selectedSite}
          showCamera={showCamera}
          showBarcodeScannerInput={showBarcodeScannerInput}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          hoveredButton={hoveredButton}
          setHoveredButton={setHoveredButton}
          startCamera={startCamera}
          startBarcodeScanner={startBarcodeScanner}
          showStudyMode={showStudyMode}
          showUploadFileTooltip={showUploadFileTooltip}
          setShowUploadFileTooltip={setShowUploadFileTooltip}
          handleFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          onDrop={handleDrop}
        />
      )}

      {/* Learning Mode Table (show under the 3 buttons when scan is closed) */}
      {!showCamera && !showBarcodeScannerInput && (
        <LearningModeTable
          entries={entries}
          showStudyMode={showStudyMode}
          patternSaved={patternSaved}
          isLearning={isLearning}
          uploading={uploading}
          selectedSite={selectedSite}
          companyOptions={companyOptions}
          typeOptions={typeOptions}
          companyTypeMap={companyTypeMap}
          typeToCompanyMap={typeToCompanyMap}
          powerOptions={POWER_OPTIONS}
          editingId={editingId}
          editingField={editingField}
          updateSerialNumber={updateSerialNumber}
          startEditing={startEditing}
          stopEditing={stopEditing}
          deleteSerialNumber={deleteSerialNumber}
          setEntries={setEntries}
          setErrorMessage={setErrorMessage}
          handleClearLearningEntries={handleClearLearningEntries}
          handleSavePattern={handleSavePattern}
          handleUploadLearningMode={handleUploadLearningModeSelected}
          learnSuccess={learnSuccess}
          outerClassName="mt-6 space-y-4"
        />
      )}

      {/* Barcode Scanner Input Mode (USB HID) */}
      {showBarcodeScannerInput && (
        <div>
          <div className="mb-2 flex justify-end gap-2">
            <button
              onClick={handleStopBarcodeScanner}
              className="px-6 py-2 h-10 bg-white text-gray-600 border-2 border-gray-400 rounded-full hover:bg-gray-50 transition-colors text-sm font-bold inline-flex items-center gap-1"
              style={{ fontFamily: "Jost, sans-serif" }}
              title="Close Scanner"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
          </div>

          <div className="pb-6 bg-white">

          <div className="space-y-2">
            {/* Normal Mode: Auto-processing */}
            <input
              ref={barcodeInputRef}
              type="text"
              onChange={handleBarcodeInput}
              onKeyDown={handleBarcodeKeyDown}
              onPaste={handleBarcodePaste}
              placeholder="Scan barcode here... (or type manually)"
              className="w-full px-4 py-3 text-xl text-gray-600 font-semibold border-2 border-gray-300 focus:border-[#0dcaf0] focus:outline-none focus:ring-2 focus:ring-[#0dcaf0]/20 placeholder:text-sm placeholder:text-gray-400"
              style={{ fontFamily: "Jost, sans-serif" }}
              autoFocus
            />

            </div>
          </div>

          <LearningModeTable
            entries={entries}
            showStudyMode={showStudyMode}
            patternSaved={patternSaved}
            isLearning={isLearning}
            uploading={uploading}
            selectedSite={selectedSite}
            companyOptions={companyOptions}
            typeOptions={typeOptions}
            companyTypeMap={companyTypeMap}
            typeToCompanyMap={typeToCompanyMap}
            powerOptions={POWER_OPTIONS}
            editingId={editingId}
            editingField={editingField}
            updateSerialNumber={updateSerialNumber}
            startEditing={startEditing}
            stopEditing={stopEditing}
            deleteSerialNumber={deleteSerialNumber}
            setEntries={setEntries}
            setErrorMessage={setErrorMessage}
            handleClearLearningEntries={handleClearLearningEntries}
            handleSavePattern={handleSavePattern}
            handleUploadLearningMode={handleUploadLearningModeSelected}
            learnSuccess={learnSuccess}
          />
        </div>
      )}

      {/* Camera View */}
      {showCamera && (
        <div>
          <div className="mb-2 flex justify-end gap-2">
            {!capturedDataUrl ? (
              <button
                onClick={handleCaptureAndScan}
                className="px-6 py-2 h-10 bg-[#0dcaf0] text-white border-2 border-[#0dcaf0] rounded-full hover:bg-[#0bb8d9] hover:border-[#0bb8d9] transition-colors text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
                style={{ fontFamily: "Jost, sans-serif" }}
                disabled={processing}
              >
                {processing ? "Processing…" : "Capture and Scan"}
              </button>
            ) : (
              <button
                onClick={handleRetake}
                className="px-6 py-2 h-10 bg-white text-gray-600 border-2 border-gray-400 rounded-full hover:bg-gray-50 transition-colors text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
                style={{ fontFamily: "Jost, sans-serif" }}
                disabled={processing}
              >
                Retake
              </button>
            )}

            <button
              onClick={stopCamera}
              className="px-6 py-2 h-10 bg-white text-gray-600 border-2 border-gray-400 rounded-full hover:bg-gray-50 transition-colors text-sm font-bold inline-flex items-center gap-1"
              style={{ fontFamily: "Jost, sans-serif" }}
              title="Close"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
          </div>

          <div className="px-4 bg-black">
            <div
              className="overflow-hidden bg-black mx-auto"
              style={{ maxWidth: "900px" }}
            >
              <div
                className="relative w-full"
                style={{ aspectRatio: "16/9", maxHeight: "60vh" }}
              >
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-contain"
                  autoPlay
                  muted
                  playsInline
                  style={{
                    transform: isFrontCamera ? "scaleX(-1)" : undefined,
                  }}
                />
                {capturedDataUrl && (
                  <img
                    src={capturedDataUrl}
                    alt="Captured"
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{
                      transform: isFrontCamera ? "scaleX(-1)" : undefined,
                    }}
                  />
                )}

                {availableDevices.length > 1 && (
                  <div className="absolute top-4 left-4 z-20">
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="bg-white text-gray-600 text-sm px-2 py-1 rounded"
                    >
                      {availableDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${d.deviceId.slice(0, 4)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(isScanning || processing) && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                    <div className="flex items-center gap-3 text-white">
                      <Loader className="h-6 w-6 animate-spin" />
                      <span>
                        {processing
                          ? "Processing..."
                          : "Scanning serial number..."}
                      </span>
                    </div>
                  </div>
                )}

                {lastScanned && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
                    <div className="px-4 py-2 bg-emerald-500 text-white rounded-full shadow text-sm font-medium">
                      ✓ Detected: {lastScanned}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <LearningModeTable
            entries={entries}
            showStudyMode={showStudyMode}
            patternSaved={patternSaved}
            isLearning={isLearning}
            uploading={uploading}
            selectedSite={selectedSite}
            companyOptions={companyOptions}
            typeOptions={typeOptions}
            companyTypeMap={companyTypeMap}
            typeToCompanyMap={typeToCompanyMap}
            powerOptions={POWER_OPTIONS}
            editingId={editingId}
            editingField={editingField}
            updateSerialNumber={updateSerialNumber}
            startEditing={startEditing}
            stopEditing={stopEditing}
            deleteSerialNumber={deleteSerialNumber}
            setEntries={setEntries}
            setErrorMessage={setErrorMessage}
            handleClearLearningEntries={handleClearLearningEntries}
            handleSavePattern={handleSavePattern}
            handleUploadLearningMode={handleUploadLearningModeSelected}
            learnSuccess={learnSuccess}
          />
        </div>
      )}

      {/* Uploaded File Display */}
      {excelFiles.length > 0 && !showCamera && (
        <div className="space-y-2">
          {excelFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-100"
            >
              <FileSpreadsheet className="h-5 w-5 text-gray-600" />
              <span className="flex-1 text-gray-600 text-sm font-bold" style={{ fontFamily: "Jost, sans-serif" }}>{file.name}</span>
              <span className="text-gray-600 text-sm font-bold" style={{ fontFamily: "Jost, sans-serif" }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      {errorMessage && (
        <div
          className={`flex items-center gap-3 p-4 ${
            errorMessage.includes("No barcode detected") ||
            errorMessage.includes("OCR extraction failed") ||
            errorMessage.includes("Serial number from") ||
            errorMessage.includes("Some entries have dates in the future") ||
            errorMessage.includes("Duplicate serial numbers found locally")
              ? "bg-red-50 border border-red-200"
              : "bg-amber-50 border border-amber-200"
            }`}
        >
          <AlertCircle
            className={`h-5 w-5 flex-shrink-0 ${errorMessage.includes("No barcode detected") ||
                errorMessage.includes("OCR extraction failed") ||
                errorMessage.includes("Serial number from") ||
                errorMessage.includes("Some entries have dates in the future") ||
                errorMessage.includes("Duplicate serial numbers found locally")
                ? "text-red-500"
                : "text-amber-500"
              }`}
          />
          <span
            className={`text-sm font-bold ${errorMessage.includes("No barcode detected") ||
                errorMessage.includes("OCR extraction failed") ||
                errorMessage.includes("Serial number from") ||
                errorMessage.includes("Some entries have dates in the future") ||
                errorMessage.includes("Duplicate serial numbers found locally")
                ? "text-red-600"
                : "text-gray-600"
              }`}
            style={{ fontFamily: "Jost, sans-serif" }}
          >
            {errorMessage}
          </span>
        </div>
      )}

      {(uploadMessage || serverDuplicates.length > 0) && (
        <div className="p-4 bg-white border border-gray-200">
          <div className="space-y-2">
            {uploadMessage && (
              <div className="text-gray-600 text-sm font-bold" style={{ fontFamily: "Jost, sans-serif" }}>{uploadMessage}</div>
            )}
            {serverDuplicates.length > 0 && (
              <div className="flex items-start gap-2 text-gray-600 text-sm font-bold" style={{ fontFamily: "Jost, sans-serif" }}>
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>
                  Skipped duplicates on server: {serverDuplicates.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Serial Numbers Table */}
      {!showStudyMode && (
        <EntriesTable
          entries={entries}
          editingId={editingId}
          editingField={editingField}
          duplicateSNs={duplicateSNs}
          serverDuplicates={serverDuplicates}
          companyOptions={companyOptions}
          typeOptions={typeOptions}
          companyTypeMap={companyTypeMap}
          typeToCompanyMap={typeToCompanyMap}
          powerOptions={POWER_OPTIONS}
          updateSerialNumber={updateSerialNumber}
          startEditing={startEditing}
          stopEditing={stopEditing}
          deleteSerialNumber={deleteSerialNumber}
          setEntries={setEntries}
          setErrorMessage={setErrorMessage}
          onCancel={handleCancel}
          onSubmit={handleSubmitSelected}
          uploading={uploading}
          excelFilesCount={excelFiles.length}
        />
      )}
    </div>
  );
}

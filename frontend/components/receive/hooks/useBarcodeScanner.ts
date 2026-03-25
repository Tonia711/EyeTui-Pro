import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import type { SerialNumberEntry } from "../types";
import { extractSerialNumberSmart } from "../utils/barcodeApi";

interface UseBarcodeScannerParams {
  apiBaseUrl: string;
  entries: SerialNumberEntry[];
  addEntries: (
    items: {
      sn: string;
      date?: string;
      company?: string;
      type?: string;
      power?: string;
      originalBarcode?: string;
    }[],
  ) => void;
  setEntries: Dispatch<SetStateAction<SerialNumberEntry[]>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setUploadMessage: Dispatch<SetStateAction<string>>;
}

export const useBarcodeScanner = ({
  apiBaseUrl,
  entries,
  addEntries,
  setEntries,
  setErrorMessage,
  setUploadMessage,
}: UseBarcodeScannerParams) => {
  const [showBarcodeScannerInput, setShowBarcodeScannerInput] = useState(false);
  const [lastBarcodeInput, setLastBarcodeInput] = useState<string>("");
  const [selectedSNStart, setSelectedSNStart] = useState<number | null>(null);
  const [selectedSNEnd, setSelectedSNEnd] = useState<number | null>(null);
  const [isLearning, setIsLearning] = useState(false);
  const [learnSuccess, setLearnSuccess] = useState(false);
  const [showStudyMode, setShowStudyMode] = useState(false);
  const [studyBarcode, setStudyBarcode] = useState<string>("");
  const [studySerialNumber, setStudySerialNumber] = useState<string>("");
  const [studyCompany, setStudyCompany] = useState<string>("");
  const [studyType, setStudyType] = useState<string>("");
  const [studyPower, setStudyPower] = useState<string>("");
  const [patternSaved, setPatternSaved] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeInputValueRef = useRef<string>("");
  const barcodeInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startBarcodeScanner = () => {
    setShowBarcodeScannerInput(true);
    setUploadMessage("");
    setErrorMessage("");
    barcodeInputValueRef.current = "";
  };

  const stopBarcodeScanner = () => {
    setShowBarcodeScannerInput(false);

    setStudyBarcode("");
    setStudySerialNumber("");
    setStudyType("");
    setStudyPower("");
    setLastBarcodeInput("");
    setSelectedSNStart(null);
    setSelectedSNEnd(null);
    setLearnSuccess(false);
    setErrorMessage("");

    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = "";
    }
    barcodeInputValueRef.current = "";
    if (barcodeInputTimeoutRef.current) {
      clearTimeout(barcodeInputTimeoutRef.current);
      barcodeInputTimeoutRef.current = null;
    }
  };

  const startStudyMode = () => {
    setShowStudyMode(true);
    setStudyBarcode("");
    setStudySerialNumber("");
    setStudyType("");
    setStudyPower("");
    setLastBarcodeInput("");
    setSelectedSNStart(null);
    setSelectedSNEnd(null);
    setLearnSuccess(false);
    setErrorMessage("");

    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = "";
    }
    barcodeInputValueRef.current = "";

    if (barcodeInputTimeoutRef.current) {
      clearTimeout(barcodeInputTimeoutRef.current);
      barcodeInputTimeoutRef.current = null;
    }
  };

  const handleLearningModeToggle = () => {
    if (!showStudyMode) {
      startStudyMode();
      setPatternSaved(false);
    } else {
      const hasLearningEntries = entries.filter((e) => e.originalBarcode).length > 0;
      if (hasLearningEntries) {
        setErrorMessage(
          "Please clear or upload all serial numbers before closing learning mode.",
        );
        return;
      }
      setShowStudyMode(false);
      setStudyBarcode("");
      setStudySerialNumber("");
      setStudyType("");
      setStudyPower("");
      setLastBarcodeInput("");
      setSelectedSNStart(null);
      setSelectedSNEnd(null);
      setLearnSuccess(false);
      setErrorMessage("");
      setPatternSaved(false);
    }
  };

  const handleSavePattern = async () => {
    const entriesWithBarcode = entries.filter(
      (entry) => entry.originalBarcode && entry.sn,
    );

    if (entriesWithBarcode.length === 0) {
      setErrorMessage("No entries with barcode found. Please scan some barcodes first.");
      return;
    }

    setIsLearning(true);
    setErrorMessage("");
    setLearnSuccess(false);

    try {
      const learnPromises = entriesWithBarcode.map((entry) =>
        fetch(`${apiBaseUrl}/barcode/learn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: entry.originalBarcode,
            serial_number: entry.sn,
            company: entry.company || undefined,
            type: entry.type || undefined,
            power: entry.power || undefined,
          }),
        }),
      );

      await Promise.all(learnPromises);
      setPatternSaved(true);
      setLearnSuccess(true);
      setErrorMessage("");
      console.log(
        `[LEARNING MODE] Patterns learned for ${entriesWithBarcode.length} entries`,
      );
    } catch (error) {
      setErrorMessage(
        `Failed to learn patterns: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      console.error("[LEARNING MODE] Learning failed:", error);
    } finally {
      setIsLearning(false);
    }
  };

  const processBarcodeInput = async (barcode: string) => {
    if (!barcode) return;

    console.log("[BARCODE SCANNER] Received:", barcode);

    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = "";
    }
    barcodeInputValueRef.current = "";

    let extractionResult: {
      sn: string | null;
      type?: string;
      power?: string;
    } | null = null;

    try {
      extractionResult = await extractSerialNumberSmart(apiBaseUrl, barcode.trim());
    } catch (error) {
      console.warn("[BARCODE SCANNER] Smart parser failed:", error);
    }

    const serialNumber = extractionResult?.sn || null;
    const extractedType = extractionResult?.type;
    const extractedPower = extractionResult?.power;

    if (serialNumber) {
      addEntries([
        {
          sn: serialNumber,
          type: extractedType,
          power: extractedPower,
          originalBarcode: showStudyMode ? barcode.trim() : undefined,
        },
      ]);
      console.log(
        "[BARCODE SCANNER] Extracted SN:",
        serialNumber,
        "Type:",
        extractedType,
        "Power:",
        extractedPower,
      );

      setErrorMessage("");

      if (!showStudyMode) {
        try {
          await fetch(`${apiBaseUrl}/barcode/learn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              barcode: barcode.trim(),
              serial_number: serialNumber,
              type: extractedType,
              power: extractedPower,
            }),
          });
          console.log("[BARCODE SCANNER] Pattern learned automatically");
        } catch (error) {
          console.warn("[BARCODE SCANNER] Failed to learn pattern:", error);
        }
      }
    } else {
      addEntries([
        {
          sn: barcode.trim(),
          originalBarcode: showStudyMode ? barcode.trim() : undefined,
        },
      ]);
      setErrorMessage("");
      console.warn("[BARCODE SCANNER] No serial number found in:", barcode);
    }

    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  const handleBarcodeInput = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    barcodeInputValueRef.current = value;

    if (barcodeInputTimeoutRef.current) {
      clearTimeout(barcodeInputTimeoutRef.current);
      barcodeInputTimeoutRef.current = null;
    }
  };

  const handleBarcodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    setTimeout(() => {
      const value =
        barcodeInputRef.current?.value.trim() ||
        barcodeInputValueRef.current.trim();
      if (value) {
        processBarcodeInput(value);
      }
    }, 10);
  };

  const handleBarcodeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value =
        barcodeInputRef.current?.value.trim() ||
        barcodeInputValueRef.current.trim();
      if (value) {
        processBarcodeInput(value);
      }
    }
    if (e.key === "Escape") {
      if (showStudyMode && !showBarcodeScannerInput) {
        handleLearningModeToggle();
      } else {
        stopBarcodeScanner();
      }
    }
  };

  const handleBarcodeTextSelect = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectedSNStart(null);
        setSelectedSNEnd(null);
        return;
      }

      const selectedText = selection.toString().trim();

      if (!selectedText || !lastBarcodeInput) {
        setSelectedSNStart(null);
        setSelectedSNEnd(null);
        return;
      }

      const foundIndex = lastBarcodeInput.indexOf(selectedText);

      if (foundIndex >= 0) {
        setSelectedSNStart(foundIndex);
        setSelectedSNEnd(foundIndex + selectedText.length);
      } else {
        const barcodeElement = document.querySelector("[data-barcode-text]");
        if (barcodeElement) {
          const range = selection.getRangeAt(0);
          const startContainer = range.startContainer;

          const spans = Array.from(barcodeElement.querySelectorAll("span"));
          let startPos = 0;

          for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            if (span.contains(startContainer) || span === startContainer.parentElement) {
              startPos = i;
              break;
            }
          }

          const endContainer = range.endContainer;
          let endPos = startPos + 1;

          for (let i = startPos; i < spans.length; i++) {
            const span = spans[i];
            if (span.contains(endContainer) || span === endContainer.parentElement) {
              endPos = i + 1;
              break;
            }
          }

          if (
            startPos >= 0 &&
            endPos > startPos &&
            endPos <= lastBarcodeInput.length
          ) {
            setSelectedSNStart(startPos);
            setSelectedSNEnd(endPos);
          }
        }
      }
    }, 50);
  };

  const handleLearnPattern = async () => {
    if (showStudyMode) {
      if (!studyBarcode || !studyBarcode.trim()) {
        setErrorMessage("Please enter a barcode.");
        return;
      }

      if (!studySerialNumber || !studySerialNumber.trim()) {
        setErrorMessage("Please enter a serial number.");
        return;
      }

      const barcode = studyBarcode.trim();
      const serialNumber = studySerialNumber.trim();

      if (serialNumber.length < 3) {
        setErrorMessage(
          "Serial number is too short. Please enter a valid serial number (at least 3 characters).",
        );
        return;
      }

      if (!/^[A-Za-z0-9]+$/.test(serialNumber)) {
        setErrorMessage("Serial number should only contain letters and numbers.");
        return;
      }

      setIsLearning(true);
      setErrorMessage("");
      setLearnSuccess(false);

      try {
        const res = await fetch(`${apiBaseUrl}/barcode/learn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: barcode,
            serial_number: serialNumber,
            company: studyCompany.trim() || undefined,
            type: studyType.trim() || undefined,
            power: studyPower.trim() || undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`Learning failed: ${res.status}`);
        }

        const result = await res.json();
        setLearnSuccess(true);
        setErrorMessage("");

        addEntries([
          {
            sn: serialNumber,
            company: studyCompany.trim() || undefined,
            type: studyType.trim() || undefined,
            power: studyPower.trim() || undefined,
          },
        ]);

        console.log("[BARCODE SCANNER] Pattern learned:", result);
      } catch (error) {
        setErrorMessage(
          `Failed to learn pattern: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
        console.error("[BARCODE SCANNER] Learning failed:", error);
      } finally {
        setIsLearning(false);
      }
      return;
    }

    if (!lastBarcodeInput || selectedSNStart === null || selectedSNEnd === null) {
      setErrorMessage(
        "Please select the serial number part in the barcode text above.",
      );
      return;
    }

    const serialNumber = lastBarcodeInput.substring(selectedSNStart, selectedSNEnd);
    if (!serialNumber || serialNumber.length < 3) {
      setErrorMessage(
        "Selected serial number is too short. Please select a valid serial number (at least 3 characters).",
      );
      return;
    }

    setIsLearning(true);
    setErrorMessage("");
    setLearnSuccess(false);

    try {
      const res = await fetch(`${apiBaseUrl}/barcode/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: lastBarcodeInput,
          serial_number: serialNumber,
        }),
      });

      if (!res.ok) {
        throw new Error(`Learning failed: ${res.status}`);
      }

      const result = await res.json();
      setLearnSuccess(true);
      setErrorMessage("");

      addEntries([{ sn: serialNumber }]);

      console.log("[BARCODE SCANNER] Pattern learned:", result);
    } catch (error) {
      setErrorMessage(
        `Failed to learn pattern: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      console.error("[BARCODE SCANNER] Learning failed:", error);
    } finally {
      setIsLearning(false);
    }
  };

  useEffect(() => {
    if (showBarcodeScannerInput && barcodeInputRef.current) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [showBarcodeScannerInput]);

  return {
    showBarcodeScannerInput,
    setShowBarcodeScannerInput,
    barcodeInputRef,
    startBarcodeScanner,
    stopBarcodeScanner,
    handleBarcodeInput,
    handleBarcodePaste,
    handleBarcodeKeyDown,
    handleBarcodeTextSelect,
    processBarcodeInput,
    lastBarcodeInput,
    setLastBarcodeInput,
    selectedSNStart,
    setSelectedSNStart,
    selectedSNEnd,
    setSelectedSNEnd,
    showStudyMode,
    setShowStudyMode,
    isLearning,
    learnSuccess,
    setLearnSuccess,
    patternSaved,
    setPatternSaved,
    handleLearningModeToggle,
    handleSavePattern,
    handleLearnPattern,
    studyBarcode,
    setStudyBarcode,
    studySerialNumber,
    setStudySerialNumber,
    studyCompany,
    setStudyCompany,
    studyType,
    setStudyType,
    studyPower,
    setStudyPower,
  };
};

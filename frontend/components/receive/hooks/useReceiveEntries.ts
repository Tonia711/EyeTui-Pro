import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as XLSX from "xlsx";
import { extractItemsFromSheet } from "../utils/excel";
import { isValidDate } from "../utils/date";
import { normalizeSN } from "../utils/serial";
import type { SerialNumberEntry, EditingField } from "../types";

interface UseReceiveEntriesParams {
  apiBaseUrl: string;
  typeToCompanyMap: Record<string, string>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  onUploadSuccess?: () => void;
  onLearningUploadComplete?: (hasDuplicates: boolean) => void;
}

export const useReceiveEntries = ({
  apiBaseUrl,
  typeToCompanyMap,
  setErrorMessage,
  onUploadSuccess,
  onLearningUploadComplete,
}: UseReceiveEntriesParams) => {
  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [entries, setEntries] = useState<SerialNumberEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [duplicateSNs, setDuplicateSNs] = useState<string[]>([]);
  const [serverDuplicates, setServerDuplicates] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const uploadAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addEntries = (
    items: {
      sn: string;
      date?: string;
      company?: string;
      type?: string;
      power?: string;
      originalBarcode?: string;
    }[],
  ) => {
    setServerDuplicates([]);
    setUploadMessage("");

    const cleaned = items
      .map(({ sn, date, company, type, power, originalBarcode }) => {
        let finalCompany = company;
        if (type && (!company || company.trim() === "")) {
          const mappedCompany = typeToCompanyMap[type];
          if (mappedCompany) {
            console.log(
              `[AUTO-SELECT] Type "${type}" -> Company "${mappedCompany}" (in addEntries)`,
            );
            finalCompany = mappedCompany;
          }
        }

        return {
          sn: normalizeSN(sn),
          date,
          company: finalCompany,
          type,
          power,
          originalBarcode,
        };
      })
      .filter((item) => Boolean(item.sn));

    if (!cleaned.length) return;

    setEntries((prev) => {
      const existing = new Set(prev.map((item) => item.sn));
      const next: SerialNumberEntry[] = [...prev];

      cleaned.forEach((item, idx) => {
        if (existing.has(item.sn)) return;

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        let finalDate = item.date || today;

        if (item.date && !isValidDate(item.date)) {
          finalDate = today;
          setErrorMessage(
            "Some dates were in the future and have been set to today.",
          );
        }

        next.push({
          id: `${Date.now()}-${idx}`,
          sn: item.sn,
          date: finalDate,
          company: item.company,
          type: item.type,
          power: item.power,
          originalBarcode: item.originalBarcode,
        });
      });

      return next;
    });
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    setExcelFiles((prev) => [...prev, selectedFile]);
    setErrorMessage("");
    setUploadMessage("");

    if (fileInputRef.current) fileInputRef.current.value = "";

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          setErrorMessage("Failed to read file");
          return;
        }

        const workbook = XLSX.read(data, { type: "array" });
        const allItems: {
          sn: string;
          date?: string;
          type?: string;
          power?: string;
        }[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
          }) as any[][];
          const items = extractItemsFromSheet(rows);
          if (items.length) allItems.push(...items);
        });

        if (!allItems.length) {
          setErrorMessage(
            "No serial numbers found in Excel. Please check the file format.",
          );
          return;
        }

        addEntries(allItems);
      } catch (error) {
        setErrorMessage(
          `Error reading Excel file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    };
    reader.onerror = () =>
      setErrorMessage("Failed to read file. Please try again.");
    reader.readAsArrayBuffer(selectedFile);
  };

  const updateSerialNumber = (
    id: string,
    field: "sn" | "date" | "company" | "type" | "power",
    value: string,
  ) => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const deleteSerialNumber = (id: string) =>
    setEntries((prev) => prev.filter((item) => item.id !== id));

  const startEditing = (
    id: string,
    field: "sn" | "date" | "company" | "type" | "power",
  ) => {
    setEditingId(id);
    setEditingField(field);
  };

  const stopEditing = () => {
    setEditingId(null);
    setEditingField(null);
  };

  const handleSubmit = async (selectedSite: string) => {
    setErrorMessage("");
    setDuplicateSNs([]);
    setServerDuplicates([]);
    setUploadMessage("");

    if (!entries.length) {
      setErrorMessage("Please add serial numbers first.");
      return;
    }

    if (!selectedSite) {
      setErrorMessage("Please select a clinic site before uploading.");
      return;
    }

    const localMap = new Map<string, number>();
    entries.forEach((item) =>
      localMap.set(item.sn, (localMap.get(item.sn) || 0) + 1),
    );
    const localDup = Array.from(localMap.entries())
      .filter(([, count]) => count > 1)
      .map(([sn]) => sn);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const futureDates: string[] = [];

    entries.forEach((item) => {
      if (item.date) {
        const itemDateStr = item.date.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(itemDateStr)) {
          return;
        }
        if (itemDateStr > todayStr) {
          futureDates.push(item.sn);
        }
      }
    });

    const errorMessages: string[] = [];
    if (localDup.length) {
      setDuplicateSNs(localDup);
      errorMessages.push("Duplicate serial numbers found locally.");
    }
    if (futureDates.length > 0) {
      errorMessages.push(
        `Some entries have dates in the future: ${futureDates.join(", ")}`,
      );
    }

    if (errorMessages.length > 0) {
      setErrorMessage(errorMessages.join(" "));
      return;
    }

    setUploading(true);
    try {
      const payload = {
        items: entries.map((item) => ({
          serial_number: item.sn,
          received_date: item.date || undefined,
          company: item.company || undefined,
          type: item.type || undefined,
          power: item.power || undefined,
          site: selectedSite,
        })),
      };

      const controller = new AbortController();
      uploadAbortRef.current = controller;

      const res = await fetch(`${apiBaseUrl}/lens/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }

      const result: { created_ids: number[]; duplicates: string[] } =
        await res.json();

      setServerDuplicates(result.duplicates || []);
      setUploadMessage(`Uploaded ${result.created_ids.length} serial number(s).`);

      if (result.created_ids.length > 0) {
        onUploadSuccess?.();
      }

      setEntries([]);
      setExcelFiles([]);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setUploadMessage("Upload cancelled.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      setUploading(false);
      uploadAbortRef.current = null;
    }
  };

  const handleCancel = () => {
    if (uploading && uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      return;
    }
    setEntries([]);
    setExcelFiles([]);
    setDuplicateSNs([]);
    setServerDuplicates([]);
    setErrorMessage("");
    setUploadMessage("");
    setEditingId(null);
    setEditingField(null);
  };

  const handleClearLearningEntries = () => {
    setEntries((prev) => prev.filter((entry) => !entry.originalBarcode));
  };

  const handleUploadLearningMode = async (
    selectedSite: string,
  ): Promise<boolean | null> => {
    const learningEntries = entries.filter((e) => e.originalBarcode);

    if (learningEntries.length === 0) {
      setErrorMessage("No entries to upload.");
      return null;
    }

    if (!selectedSite) {
      setErrorMessage("Please select a clinic site first.");
      return null;
    }

    setErrorMessage("");
    setDuplicateSNs([]);
    setUploading(true);

    try {
      const payload = {
        items: learningEntries.map((item) => ({
          serial_number: item.sn,
          received_date: item.date || undefined,
          company: item.company || undefined,
          type: item.type || undefined,
          power: item.power || undefined,
          site: selectedSite,
        })),
      };

      const controller = new AbortController();
      uploadAbortRef.current = controller;

      const res = await fetch(`${apiBaseUrl}/lens/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }

      const result: { created_ids: number[]; duplicates: string[] } =
        await res.json();
      setServerDuplicates(result.duplicates || []);
      setUploadMessage(`Uploaded ${result.created_ids.length} serial number(s).`);

      const hasDuplicates = Boolean(result.duplicates && result.duplicates.length);
      onLearningUploadComplete?.(hasDuplicates);
      if (!hasDuplicates) {
        setEntries((prev) => prev.filter((entry) => !entry.originalBarcode));
      }
      return hasDuplicates;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setUploadMessage("Upload cancelled.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      }
      return null;
    } finally {
      setUploading(false);
      uploadAbortRef.current = null;
    }
  };

  return {
    excelFiles,
    setExcelFiles,
    entries,
    setEntries,
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
    handleClearLearningEntries,
    handleUploadLearningMode,
    setDuplicateSNs,
    setServerDuplicates,
    setUploadMessage,
  };
};

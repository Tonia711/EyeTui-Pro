import { normalizeSN } from "./serial";
import { parseDateValue } from "./date";

export interface ExcelItem {
  sn: string;
  date?: string;
  type?: string;
  power?: string;
}

const cleanHeaderText = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]/g, "");

const detectSerialColumn = (header: string[], dataRows: any[][]): number => {
  const cleanedHeader = header.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const matchIdx = cleanedHeader.findIndex(
    (h) =>
      h.includes("serial") ||
      h === "sn" ||
      h.startsWith("sn") ||
      h.includes("serialno"),
  );
  if (matchIdx >= 0) return matchIdx;

  let bestIdx = 0;
  let bestScore = -1;
  const rowCount = Math.min(dataRows.length, 200);

  const isLikelySN = (v: unknown) => {
    if (v === undefined || v === null || v === "") return false;
    const s = normalizeSN(v);
    if (s.length < 5 || s.length > 30) return false;
    const digitRatio = (s.match(/[0-9]/g)?.length || 0) / s.length;
    return digitRatio > 0.5;
  };

  const colCount = Math.max(
    ...dataRows.slice(0, rowCount).map((r) => r.length),
    header.length,
  );

  for (let c = 0; c < colCount; c++) {
    let score = 0;
    for (let r = 0; r < rowCount; r++) {
      if (isLikelySN(dataRows[r]?.[c])) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = c;
    }
  }
  return bestIdx;
};

const detectDateColumn = (header: string[]): number | null => {
  for (let i = 0; i < header.length; i++) {
    const clean = cleanHeaderText(header[i]);
    if (
      clean.includes("date") ||
      clean.includes("received") ||
      clean.includes("time") ||
      clean.includes("day") ||
      clean === "date" ||
      clean === "datetime" ||
      clean.includes("created")
    ) {
      return i;
    }
  }
  return null;
};

const detectTypeColumn = (header: string[]): number | null => {
  for (let i = 0; i < header.length; i++) {
    const clean = cleanHeaderText(header[i]);
    if (clean.includes("model") || clean === "type" || clean.includes("brand"))
      return i;
  }
  return null;
};

const detectPowerColumn = (header: string[]): number | null => {
  for (let i = 0; i < header.length; i++) {
    const clean = cleanHeaderText(header[i]);
    if (
      clean.includes("power") ||
      clean === "se" ||
      clean.includes("sphere") ||
      clean.includes("diopter")
    )
      return i;
  }
  return null;
};

const detectColumnsFromData = (
  header: string[],
  dataRowsSample: any[][],
): {
  snIdx: number;
  dateIdx: number | null;
  typeIdx: number | null;
  powerIdx: number | null;
} => {
  const snIdx = detectSerialColumn(header, dataRowsSample);
  let dateIdx = detectDateColumn(header);
  let typeIdx = detectTypeColumn(header);
  let powerIdx = detectPowerColumn(header);

  if (typeIdx === null) {
    for (let c = 0; c < header.length; c++) {
      if (c === snIdx || c === dateIdx || c === powerIdx) continue;
      let isType = true;
      for (let r = 0; r < Math.min(5, dataRowsSample.length); r++) {
        const val = dataRowsSample[r]?.[c];
        if (val === null || val === undefined || String(val).trim() === "")
          continue;
        const str = String(val).trim();
        if (str.length < 3 || str.length > 20 || !/[a-zA-Z]/.test(str)) {
          isType = false;
          break;
        }
      }
      if (isType) {
        typeIdx = c;
        break;
      }
    }
  }

  if (powerIdx === null) {
    for (let c = 0; c < header.length; c++) {
      if (c === snIdx || c === dateIdx || c === typeIdx) continue;
      let isPower = false;
      for (let r = 0; r < Math.min(5, dataRowsSample.length); r++) {
        const val = dataRowsSample[r]?.[c];
        if (val === null || val === undefined || String(val).trim() === "")
          continue;
        const str = String(val).trim();
        if (/[dD][\d\.\+\-]/i.test(str) || /[\d\.\+\-][dD]/i.test(str)) {
          isPower = true;
          break;
        }
      }
      if (isPower) {
        powerIdx = c;
        break;
      }
    }
  }

  return { snIdx, dateIdx, typeIdx, powerIdx };
};

export const extractItemsFromSheet = (rows: any[][]): ExcelItem[] => {
  if (!rows.length) return [];

  let headerRowIdx = 0;
  let header = rows[0].map((cell) => normalizeSN(cell));

  const firstRowText = header.join(" ").toLowerCase();
  const firstRowNonEmpty = header.filter(Boolean).length;

  if (
    firstRowNonEmpty <= 2 &&
    !firstRowText.includes("serial") &&
    !firstRowText.includes("sn")
  ) {
    if (rows.length > 1) {
      headerRowIdx = 1;
      header = rows[1].map((cell) => normalizeSN(cell));
    }
  }

  const dataRowsSample = rows.slice(headerRowIdx + 1);
  const { snIdx, dateIdx, typeIdx, powerIdx } = detectColumnsFromData(
    header,
    dataRowsSample,
  );

  const hasHeader = snIdx >= 0 && header.some(Boolean);
  const dataRows = hasHeader ? rows.slice(headerRowIdx + 1) : rows;

  const items: ExcelItem[] = [];
  let lastDate: string | undefined = undefined;

  dataRows.forEach((row) => {
    const rowJoined = row.map(normalizeSN).join(" ").toLowerCase();

    const headerKeywords = [
      "serial",
      "date",
      "type",
      "company",
      "power",
      "number",
      "received",
    ];
    const cellsWithHeaderKeywords = row.filter((cell) => {
      const cellStr = String(cell ?? "").toLowerCase();
      return headerKeywords.some(
        (keyword) => cellStr.includes(keyword) && cellStr.length < 30,
      );
    }).length;

    const looksLikeHeader =
      cellsWithHeaderKeywords >= 2 ||
      (rowJoined.includes("serial") && rowJoined.includes("number")) ||
      rowJoined.startsWith("serial");

    const rowHasNoData = row.every(
      (cell) =>
        cell === null || cell === undefined || String(cell).trim() === "",
    );

    if (looksLikeHeader || rowHasNoData) return;

    const snValue = row[snIdx];
    if (snValue === undefined || snValue === null || snValue === "") return;

    const dateValue = dateIdx !== null ? row[dateIdx] : undefined;
    const typeValue = typeIdx !== null ? row[typeIdx] : undefined;
    const powerValue = powerIdx !== null ? row[powerIdx] : undefined;

    const parsedDate = parseDateValue(dateValue);
    if (parsedDate) lastDate = parsedDate;

    items.push({
      sn: snValue,
      date: parsedDate || lastDate,
      type: typeValue ? String(typeValue).trim() : undefined,
      power: powerValue ? String(powerValue).trim() : undefined,
    });
  });
  return items;
};

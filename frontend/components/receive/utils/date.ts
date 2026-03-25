export const isValidDate = (isoDate: string): boolean => {
  if (!isoDate || typeof isoDate !== "string") return false;
  const date = new Date(isoDate + "T00:00:00");
  if (isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
};

export const parseDateValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return dt.toISOString().split("T")[0];
  }

  const raw = String(value).trim();
  const parts = raw.split(/[./-]/).filter(Boolean);

  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    const iso = `${year.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(
      2,
      "0",
    )}`;
    const dt = new Date(iso + "T00:00:00");
    if (!isNaN(dt.getTime())) return iso;
  }

  const dt = new Date(raw);
  if (!isNaN(dt.getTime())) return dt.toISOString().split("T")[0];
  return undefined;
};

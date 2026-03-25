export interface DetectedCode {
  text: string;
  format?: string;
}

export const correctBarcodeErrors = (barcode: string): string => {
  const corrected = barcode
    .replace(/O(?=\d)/g, "0")
    .replace(/l(?=\d)/g, "1");

  if (corrected !== barcode) {
    console.log(`[EXTRACT] Corrected barcode: "${barcode}" -> "${corrected}"`);
  }
  return corrected;
};

export const is2DCode = (format?: string): boolean => {
  if (!format) return false;
  const formatLower = format.toLowerCase().replace(/[_-]/g, "");
  return (
    formatLower === "qrcode" ||
    formatLower === "datamatrix" ||
    formatLower.includes("qr") ||
    formatLower.includes("data")
  );
};

export const is1DBarcode = (format?: string): boolean => {
  if (format) {
    const formatLower = format.toLowerCase().replace(/[_-]/g, "");
    if (is2DCode(format)) {
      return false;
    }
    if (
      [
        "code128",
        "code39",
        "code93",
        "ean13",
        "ean8",
        "upca",
        "upce",
        "ean",
        "upc",
        "code",
      ].some(
        (prefix) => formatLower === prefix || formatLower.startsWith(prefix),
      )
    ) {
      return true;
    }
  }
  return false;
};

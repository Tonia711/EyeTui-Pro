import { describe, expect, it, vi } from "vitest";
import {
  correctBarcodeErrors,
  is1DBarcode,
  is2DCode,
} from "@/components/receive/utils/barcode";

describe("receive/utils/barcode", () => {
  it("correctBarcodeErrors fixes common OCR mistakes only when followed by digits", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(correctBarcodeErrors("O123")).toBe("0123");
    expect(correctBarcodeErrors("l234")).toBe("1234");
    expect(correctBarcodeErrors("ABC")).toBe("ABC");
    expect(correctBarcodeErrors("OABC")).toBe("OABC");

    logSpy.mockRestore();
  });

  it("is2DCode detects QR/DataMatrix formats", () => {
    expect(is2DCode("QR_CODE")).toBe(true);
    expect(is2DCode("qrcode")).toBe(true);
    expect(is2DCode("DataMatrix")).toBe(true);
    expect(is2DCode("code_128")).toBe(false);
    expect(is2DCode(undefined)).toBe(false);
  });

  it("is1DBarcode detects common 1D formats and excludes 2D formats", () => {
    expect(is1DBarcode("CODE_128")).toBe(true);
    expect(is1DBarcode("EAN-13")).toBe(true);
    expect(is1DBarcode("UPC_A")).toBe(true);
    expect(is1DBarcode("qr_code")).toBe(false);
    expect(is1DBarcode(undefined)).toBe(false);
  });
});



import { describe, expect, it, vi } from "vitest";
import { extractSerialNumberSmart } from "@/components/receive/utils/barcodeApi";

describe("receive/utils/barcodeApi", () => {
  it("returns parsed response when API succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serial_number: "SN123",
        type: "DEN00V",
        power: "+12.3D",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractSerialNumberSmart("http://localhost:8000", "x");
    expect(result).toEqual({ sn: "SN123", type: "DEN00V", power: "+12.3D" });
  });

  it("maps missing serial_number to null", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "DEN00V",
        power: "+12.3D",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractSerialNumberSmart("http://localhost:8000", "x");
    expect(result).toEqual({ sn: null, type: "DEN00V", power: "+12.3D" });
  });

  it("returns null and warns when API fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractSerialNumberSmart("http://localhost:8000", "x");
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});



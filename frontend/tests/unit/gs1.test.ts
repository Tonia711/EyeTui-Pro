import { describe, expect, it, vi } from "vitest";
import { parseGS1Frontend } from "@/components/receive/utils/gs1";

describe("receive/utils/gs1", () => {
  it("returns null when data is not a GS1 starting with 01", () => {
    expect(parseGS1Frontend("")).toBeNull();
    expect(parseGS1Frontend("21ABC")).toBeNull();
  });

  it("parses SN + model + power from 21 + 240 encoded payload", () => {
    const gtin14 = "12345678901234";
    const payload = "1234567890" + "240" + "DEN00V" + "I00123";
    const data = "01" + gtin14 + "21" + payload;

    expect(parseGS1Frontend(data)).toEqual({
      sn: "1234567890",
      type: "DEN00V",
      power: "+12.3D",
    });
  });

  it("parses model + power from 24 0 branch (without SN)", () => {
    const gtin14 = "12345678901234";
    const data = "01" + gtin14 + "24" + "0" + "DEN00V" + "00123";

    expect(parseGS1Frontend(data)).toEqual({
      sn: undefined,
      type: "DEN00V",
      power: "+12.3D",
    });
  });

  it("throws when called with non-string input (defensive)", () => {
    expect(() => parseGS1Frontend(null as any)).toThrow();
  });
});



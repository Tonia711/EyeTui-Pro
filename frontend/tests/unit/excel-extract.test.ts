import { describe, expect, it } from "vitest";
import { extractItemsFromSheet } from "@/components/receive/utils/excel";

describe("receive/utils/excel", () => {
  it("extractItemsFromSheet extracts rows and carries forward last valid date", () => {
    const rows = [
      ["Serial Number", "Type", "Power", "Received Date"],
      ["25424111139", "CNWTT0", "+19.0D", "15/12/2025"],
      ["16014350048", "SN60WF", "+20.0D", ""], // should NOT be treated as header
      ["25579955045", "CNWTT3", "+22.0D", ""], // uses lastDate from first data row
    ];

    const items = extractItemsFromSheet(rows as any[][]);
    expect(items).toHaveLength(3);

    expect(items[0]).toMatchObject({
      sn: "25424111139",
      type: "CNWTT0",
      power: "+19.0D",
      date: "2025-12-15",
    });

    // Date is carried forward
    expect(items[1]).toMatchObject({
      sn: "16014350048",
      type: "SN60WF",
      power: "+20.0D",
      date: "2025-12-15",
    });
    expect(items[2]).toMatchObject({
      sn: "25579955045",
      date: "2025-12-15",
    });
  });

  it("detects header on the second row when the first row looks like a title", () => {
    const rows = [
      ["Inventory Upload"], // firstRowNonEmpty <= 2 and doesn't include serial/sn
      ["SN", "Type", "Received Date"],
      ["99900011122", "DEN00V", "01/01/2025"],
    ];

    const items = extractItemsFromSheet(rows as any[][]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sn: "99900011122",
      type: "DEN00V",
      date: "2025-01-01",
    });
  });

  it("infers type/power columns from sample data when headers are unknown", () => {
    const rows = [
      ["Serial", "ColA", "ColB", "ColC"],
      ["25424111139", "DEN00V", "+12.3D", "15/12/2025"],
      ["25579955045", "CNWTT0", "+19.0D", ""],
    ];

    const items = extractItemsFromSheet(rows as any[][]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sn: "25424111139",
      type: "DEN00V",
      power: "+12.3D",
    });
    expect(items[1]).toMatchObject({
      sn: "25579955045",
      type: "CNWTT0",
      power: "+19.0D",
    });
  });
});



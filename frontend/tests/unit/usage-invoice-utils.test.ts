import { describe, expect, it, vi } from "vitest";
import { getStatusText, exportReconciliationExcel } from "@/components/usage-invoice/utils";
import type { Invoice, LensOut } from "@/components/usage-invoice/types";

vi.mock("xlsx", () => {
  return {
    utils: {
      aoa_to_sheet: vi.fn(() => ({ __sheet: true })),
      book_new: vi.fn(() => ({ __workbook: true })),
      book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
  };
});

describe("usage-invoice/utils", () => {
  it("getStatusText returns correct labels", () => {
    expect(getStatusText(true, true).text).toBe("Matched");
    expect(getStatusText(true, false).text).toBe("Not Used");
    expect(getStatusText(false, true).text).toBe("Used Only");
    expect(getStatusText(false, false).text).toBe("Missing");
  });

  it("exportReconciliationExcel writes a file when invoices exist", async () => {
    const XLSX = await import("xlsx");
    const writeSpy = vi.spyOn(XLSX, "writeFile");

    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 2, 12, 0, 0));

    const invoices: Invoice[] = [
      {
        invoiceNumber: "INV-1",
        company: "Supplier A",
        serialNumbers: [{ sn: "SN1", isMatched: true }],
      } as any,
    ];
    const lensDataMap = new Map<string, LensOut>([
      [
        "SN1",
        {
          received_date: "2025-01-01",
          used_date: null,
          is_matched: true,
        } as any,
      ],
    ]);

    exportReconciliationExcel(invoices, lensDataMap);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const filename = (writeSpy.mock.calls[0] as any[])[1] as string;
    expect(filename).toBe("reconciliation_result_02012025.xlsx");

    vi.useRealTimers();
  });

  it("exportReconciliationExcel does nothing when invoices are empty", async () => {
    const XLSX = await import("xlsx");
    const writeSpy = vi.spyOn(XLSX, "writeFile");
    exportReconciliationExcel([], new Map());
    expect(writeSpy).not.toHaveBeenCalled();
  });
});



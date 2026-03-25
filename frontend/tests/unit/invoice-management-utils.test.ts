import { describe, expect, it, vi } from "vitest";
import { formatDate, groupInvoices, exportInvoicesToExcel } from "@/components/invoice-management/utils";
import type { InvoiceFromAPI, InvoiceRecord } from "@/components/invoice-management/types";

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

describe("invoice-management/utils", () => {
  it("formatDate outputs dd/mm/yyyy", () => {
    expect(formatDate("2025-01-02T00:00:00.000Z")).toBe("02/01/2025");
  });

  it("groupInvoices groups by invoice_number and de-dupes serial numbers", () => {
    const data: InvoiceFromAPI[] = [
      {
        id: 1,
        upload_date: "2025-01-02T00:00:00.000Z",
        invoice_number: "INV-1",
        serial_number: "SN1",
        supplier_id: 1,
        supplier_name: "Supplier A",
        is_matched: null,
      },
      {
        id: 2,
        upload_date: "2025-01-02T00:00:00.000Z",
        invoice_number: "INV-1",
        serial_number: "SN1",
        supplier_id: 1,
        supplier_name: "Supplier A",
        is_matched: true,
      },
      {
        id: 3,
        upload_date: "2025-01-03T00:00:00.000Z",
        invoice_number: "INV-2",
        serial_number: "SN2",
        supplier_id: null,
        supplier_name: null,
        is_matched: false,
      },
    ];

    const grouped = groupInvoices(data);
    expect(grouped).toHaveLength(2);

    const inv1 = grouped.find((g) => g.invoiceNumber === "INV-1")!;
    expect(inv1.uploadDate).toBe("02/01/2025");
    expect(inv1.supplier).toBe("Supplier A");
    expect(inv1.serialNumbers).toHaveLength(1);
    expect(inv1.serialNumbers[0]).toEqual({ sn: "SN1", isMatched: null });

    const inv2 = grouped.find((g) => g.invoiceNumber === "INV-2")!;
    expect(inv2.supplier).toBe("Unknown");
  });

  it("exportInvoicesToExcel writes a file when invoices exist", async () => {
    const XLSX = await import("xlsx");
    const writeSpy = vi.spyOn(XLSX, "writeFile");

    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 2, 12, 0, 0));

    const invoices: InvoiceRecord[] = [
      {
        uploadDate: "02/01/2025",
        supplier: "Supplier A",
        invoiceNumber: "INV-1",
        serialNumbers: [{ sn: "SN1", isMatched: true }],
      },
    ];
    exportInvoicesToExcel(invoices);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const filename = (writeSpy.mock.calls[0] as any[])[1] as string;
    expect(filename).toBe("invoice_list_02012025.xlsx");

    vi.useRealTimers();
  });

  it("exportInvoicesToExcel does nothing when invoices are empty", async () => {
    const XLSX = await import("xlsx");
    const writeSpy = vi.spyOn(XLSX, "writeFile");
    exportInvoicesToExcel([]);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});



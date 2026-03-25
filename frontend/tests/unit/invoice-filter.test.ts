import { describe, expect, it } from "vitest";
import { filterInvoices } from "@/components/invoice-management/filter";
import type { InvoiceRecord } from "@/components/invoice-management/types";

describe("invoice-management/filter", () => {
  const invoices: InvoiceRecord[] = [
    {
      uploadDate: "10/01/2025",
      supplier: "B Supplier",
      invoiceNumber: "INV-2",
      serialNumbers: [{ sn: "ABC123", isMatched: null }],
    },
    {
      uploadDate: "11/01/2025",
      supplier: "C Supplier",
      invoiceNumber: "inv-1",
      serialNumbers: [{ sn: "SN999", isMatched: true }],
    },
    {
      uploadDate: "11/01/2025",
      supplier: "A Supplier",
      invoiceNumber: "INV-3",
      serialNumbers: [{ sn: "ZZZ000", isMatched: false }],
    },
  ];

  it("filters by supplier / invoiceNumber / serialNumber and sorts by date desc then supplier asc", () => {
    const result = filterInvoices(invoices, {
      uploadDateFrom: "",
      uploadDateTo: "",
      selectedSupplier: "All Suppliers",
      invoiceNumberSearch: "",
      serialNumberSearch: "",
    });

    // 11/01/2025 first; within same date: A Supplier before C Supplier
    expect(result.map((r) => r.supplier)).toEqual([
      "A Supplier",
      "C Supplier",
      "B Supplier",
    ]);

    const supplierFiltered = filterInvoices(invoices, {
      uploadDateFrom: "",
      uploadDateTo: "",
      selectedSupplier: "B Supplier",
      invoiceNumberSearch: "",
      serialNumberSearch: "",
    });
    expect(supplierFiltered).toHaveLength(1);
    expect(supplierFiltered[0]?.supplier).toBe("B Supplier");

    const invoiceSearch = filterInvoices(invoices, {
      uploadDateFrom: "",
      uploadDateTo: "",
      selectedSupplier: "All Suppliers",
      invoiceNumberSearch: "inv-1",
      serialNumberSearch: "",
    });
    expect(invoiceSearch).toHaveLength(1);
    expect(invoiceSearch[0]?.invoiceNumber).toBe("inv-1");

    const serialSearch = filterInvoices(invoices, {
      uploadDateFrom: "",
      uploadDateTo: "",
      selectedSupplier: "All Suppliers",
      invoiceNumberSearch: "",
      serialNumberSearch: "999",
    });
    expect(serialSearch).toHaveLength(1);
    expect(serialSearch[0]?.supplier).toBe("C Supplier");
  });

  it("includes boundary dates for uploadDateFrom/uploadDateTo", () => {
    const fromInclusive = filterInvoices(invoices, {
      uploadDateFrom: "2025-01-11",
      uploadDateTo: "",
      selectedSupplier: "All Suppliers",
      invoiceNumberSearch: "",
      serialNumberSearch: "",
    });
    expect(fromInclusive.map((i) => i.uploadDate)).toEqual([
      "11/01/2025",
      "11/01/2025",
    ]);

    const toInclusive = filterInvoices(invoices, {
      uploadDateFrom: "",
      uploadDateTo: "2025-01-10",
      selectedSupplier: "All Suppliers",
      invoiceNumberSearch: "",
      serialNumberSearch: "",
    });
    expect(toInclusive.map((i) => i.uploadDate)).toEqual(["10/01/2025"]);
  });
});



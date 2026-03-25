import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useInvoiceFilters } from "@/components/invoice-management/hooks/useInvoiceFilters";

describe("invoice-management/hooks/useInvoiceFilters", () => {
  it("updates and clears filters", () => {
    const { result } = renderHook(() => useInvoiceFilters());

    act(() => {
      result.current.setUploadDateFrom("2025-01-01");
      result.current.setUploadDateTo("2025-01-31");
      result.current.setSelectedSupplier("Supplier A");
      result.current.setInvoiceNumberSearch("INV");
      result.current.setSerialNumberSearch("SN123");
    });

    expect(result.current.uploadDateFrom).toBe("2025-01-01");
    expect(result.current.uploadDateTo).toBe("2025-01-31");
    expect(result.current.selectedSupplier).toBe("Supplier A");
    expect(result.current.invoiceNumberSearch).toBe("INV");
    expect(result.current.serialNumberSearch).toBe("SN123");

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.uploadDateFrom).toBe("");
    expect(result.current.uploadDateTo).toBe("");
    expect(result.current.selectedSupplier).toBe("All Suppliers");
    expect(result.current.invoiceNumberSearch).toBe("");
    expect(result.current.serialNumberSearch).toBe("");
  });
});



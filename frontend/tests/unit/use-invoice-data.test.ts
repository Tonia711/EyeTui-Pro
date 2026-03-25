import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInvoiceData } from "@/components/invoice-management/hooks/useInvoiceData";

describe("invoice-management/hooks/useInvoiceData", () => {
  it("fetches suppliers and invoices on mount and exposes deleteInvoiceByNumber", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.endsWith("/supplier")) {
        return {
          ok: true,
          json: async () => [{ id: 1, name: "Supplier A" }],
        } as any;
      }
      if (url.endsWith("/invoice") && (!init || !init.method)) {
        return {
          ok: true,
          json: async () => [
            {
              id: 1,
              upload_date: "2025-01-02T00:00:00.000Z",
              invoice_number: "INV-1",
              serial_number: "SN1",
              supplier_id: 1,
              supplier_name: "Supplier A",
              is_matched: null,
            },
          ],
        } as any;
      }
      if (url.includes("/invoice/by-number/") && init?.method === "DELETE") {
        return { ok: true } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useInvoiceData({ apiBaseUrl: "http://api", isActive: false }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.supplierOptions).toEqual(["All Suppliers", "Supplier A"]);
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0]?.invoiceNumber).toBe("INV-1");

    await act(async () => {
      await result.current.deleteInvoiceByNumber("INV-1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api/invoice/by-number/INV-1",
      { method: "DELETE" },
    );
    // After delete, it refetches invoices
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/invoice"))).toBe(
      true,
    );
  });
});



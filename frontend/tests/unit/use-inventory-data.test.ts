import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInventoryData } from "@/components/inventory/hooks/useInventoryData";

describe("inventory/hooks/useInventoryData", () => {
  it("fetches lens/company/site on mount and supports move/delete + reference data refresh event", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);

      if (url.endsWith("/lens") && (!init || !init.method)) {
        return {
          ok: true,
          json: async () => [
            {
              id: 1,
              serial_number: "SN1",
              is_used: false,
              is_matched: false,
              type: null,
              power: null,
              received_date: "2025-01-01",
              used_date: null,
              site: null,
              company: null,
              move_from_clinic: null,
              invoice_id: null,
            },
          ],
        } as any;
      }

      if (url.endsWith("/company")) {
        return { ok: true, json: async () => [{ id: 1, name: "Company A" }] } as any;
      }

      if (url.endsWith("/site")) {
        return { ok: true, json: async () => [{ id: 1, name: "Clinic A" }] } as any;
      }

      if (url.endsWith("/lens/1/move-to-clinic") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            id: 1,
            serial_number: "SN1",
            is_used: false,
            is_matched: false,
            type: null,
            power: null,
            received_date: "2025-01-01",
            used_date: null,
            site: "Clinic A",
            company: null,
            move_from_clinic: null,
            invoice_id: null,
          }),
        } as any;
      }

      if (url.endsWith("/lens/1") && init?.method === "DELETE") {
        return { ok: true } as any;
      }

      return { ok: false, text: async () => "Unexpected" } as any;
    });

    vi.stubGlobal("fetch", fetchMock);

    const referenceDataEvent = "reference-data-changed-test";
    const { result } = renderHook(() =>
      useInventoryData({
        apiBaseUrl: "http://api",
        referenceDataEvent,
        isActive: false,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lensData).toHaveLength(1);
    expect(result.current.companies).toHaveLength(1);
    expect(result.current.sites).toHaveLength(1);

    await act(async () => {
      await result.current.moveLensToClinic(1, " Clinic A ");
    });
    expect(result.current.lensData[0]?.site).toBe("Clinic A");

    await act(async () => {
      await result.current.deleteLens(1);
    });
    expect(fetchMock).toHaveBeenCalledWith("http://api/lens/1", { method: "DELETE" });

    // Trigger reference data refresh event -> should fetch site + lens again
    await act(async () => {
      window.dispatchEvent(new Event(referenceDataEvent));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/site"))).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/lens"))).toBe(true);
  });
});



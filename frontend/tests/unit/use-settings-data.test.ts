import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSettingsData } from "@/components/settings/hooks/useSettingsData";

describe("settings/hooks/useSettingsData", () => {
  it("refreshes all settings data on mount", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.endsWith("/company")) return { ok: true, json: async () => [{ id: 1, name: "C1" }] } as any;
      if (url.endsWith("/supplier")) return { ok: true, json: async () => [{ id: 1, name: "S1" }] } as any;
      if (url.endsWith("/site")) return { ok: true, json: async () => [{ id: 1, name: "Site1" }] } as any;
      if (url.endsWith("/lens-type"))
        return {
          ok: true,
          json: async () => [{ id: 1, name: "T1", company_id: 1, company_name: "C1" }],
        } as any;
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSettingsData({
        apiBaseUrl: "http://api",
        referenceDataEvent: "ref-evt-settings",
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.companies).toHaveLength(1);
    expect(result.current.suppliers).toHaveLength(1);
    expect(result.current.sites).toHaveLength(1);
    expect(result.current.types).toHaveLength(1);
  });

  it("handleCreateCompany dispatches reference data event on success", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.endsWith("/company") && init?.method === "POST") return { ok: true, text: async () => "" } as any;
      // refreshAll calls
      if (url.endsWith("/company")) return { ok: true, json: async () => [] } as any;
      if (url.endsWith("/supplier")) return { ok: true, json: async () => [] } as any;
      if (url.endsWith("/site")) return { ok: true, json: async () => [] } as any;
      if (url.endsWith("/lens-type")) return { ok: true, json: async () => [] } as any;
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const referenceDataEvent = "ref-evt-settings-create";

    const { result } = renderHook(() =>
      useSettingsData({
        apiBaseUrl: "http://api",
        referenceDataEvent,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleCreateCompany("  NewCo  ");
    });

    expect(dispatchSpy.mock.calls.some((c) => (c[0] as Event).type === referenceDataEvent)).toBe(true);
  });

  it("create/update handlers call the right endpoints and dispatch reference data event", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);

      // Mount refreshAll calls (GET)
      if (!init?.method) {
        if (url.endsWith("/company")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/supplier")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/site")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/lens-type")) return { ok: true, json: async () => [] } as any;
      }

      // Create (POST)
      if (url.endsWith("/supplier") && init?.method === "POST") return { ok: true, text: async () => "" } as any;
      if (url.endsWith("/site") && init?.method === "POST") return { ok: true, text: async () => "" } as any;
      if (url.endsWith("/lens-type") && init?.method === "POST") return { ok: true, text: async () => "" } as any;

      // Update (PATCH)
      if (url.endsWith("/company/1") && init?.method === "PATCH") return { ok: true, text: async () => "" } as any;
      if (url.endsWith("/supplier/2") && init?.method === "PATCH") return { ok: true, text: async () => "" } as any;
      if (url.endsWith("/site/3") && init?.method === "PATCH") return { ok: true, text: async () => "" } as any;
      if (url.endsWith("/lens-type/4") && init?.method === "PATCH") return { ok: true, text: async () => "" } as any;

      throw new Error(`Unexpected fetch: ${url} (${init?.method || "GET"})`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const referenceDataEvent = "ref-evt-settings-multi";
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = renderHook(() =>
      useSettingsData({
        apiBaseUrl: "http://api",
        referenceDataEvent,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleCreateSupplier("  Supp  ");
      await result.current.handleCreateSite("  Site  ");
      await result.current.handleCreateType("  Type  ", "1");
      await result.current.handleUpdateCompany(1, "  C  ");
      await result.current.handleUpdateSupplier(2, "  S  ");
      await result.current.handleUpdateSite(3, "  Clinic  ");
      await result.current.handleUpdateType(4, "  T  ", "1");
    });

    // Ensure endpoints were hit
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/supplier") && (c[1] as any)?.method === "POST")).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/site") && (c[1] as any)?.method === "POST")).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/lens-type") && (c[1] as any)?.method === "POST")).toBe(true);

    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/company/1") && (c[1] as any)?.method === "PATCH")).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/supplier/2") && (c[1] as any)?.method === "PATCH")).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/site/3") && (c[1] as any)?.method === "PATCH")).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/lens-type/4") && (c[1] as any)?.method === "PATCH")).toBe(true);

    // Dispatch should happen for each successful mutation
    expect(dispatchSpy.mock.calls.filter((c) => (c[0] as Event).type === referenceDataEvent).length).toBeGreaterThanOrEqual(7);
  });

  it("handleDeleteCompany maps API detail 'Company is in use' to friendly message", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      // mount refreshAll
      if (!init?.method) {
        if (url.endsWith("/company")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/supplier")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/site")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/lens-type")) return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith("/company/1") && init?.method === "DELETE") {
        return { ok: false, text: async () => '{"detail":"Company is in use"}' } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSettingsData({
        apiBaseUrl: "http://api",
        referenceDataEvent: "ref-evt-settings-del",
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteCompany(1);
    });

    expect(result.current.error).toBe("Company is in use, delete failed.");
  });

  it("delete handlers map 'in use' errors to friendly messages", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      // mount refreshAll
      if (!init?.method) {
        if (url.endsWith("/company")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/supplier")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/site")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/lens-type")) return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith("/supplier/2") && init?.method === "DELETE") {
        return { ok: false, text: async () => '{"detail":"Supplier is in use"}' } as any;
      }
      if (url.endsWith("/site/3") && init?.method === "DELETE") {
        return { ok: false, text: async () => '{"detail":"Site is in use"}' } as any;
      }
      if (url.endsWith("/lens-type/4") && init?.method === "DELETE") {
        return { ok: false, text: async () => '{"detail":"Type is in use"}' } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSettingsData({
        apiBaseUrl: "http://api",
        referenceDataEvent: "ref-evt-settings-delmap",
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteSupplier(2);
    });
    expect(result.current.error).toBe("Supplier is in use, delete failed.");

    await act(async () => {
      await result.current.handleDeleteSite(3);
    });
    expect(result.current.error).toBe("Clinic is in use, delete failed.");

    await act(async () => {
      await result.current.handleDeleteType(4);
    });
    expect(result.current.error).toBe("Type is in use, delete failed.");
  });

  it("handleDeleteType requires payload.deleted === true", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      // mount refreshAll
      if (!init?.method) {
        if (url.endsWith("/company")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/supplier")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/site")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/lens-type")) return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith("/lens-type/1") && init?.method === "DELETE") {
        return { ok: true, json: async () => ({ deleted: false }) } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSettingsData({
        apiBaseUrl: "http://api",
        referenceDataEvent: "ref-evt-settings-deltype",
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteType(1);
    });
    expect(result.current.error).toBe("Failed to delete type");
  });

  it("handleDeleteType dispatches reference data event when deleted === true", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      // mount refreshAll
      if (!init?.method) {
        if (url.endsWith("/company")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/supplier")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/site")) return { ok: true, json: async () => [] } as any;
        if (url.endsWith("/lens-type")) return { ok: true, json: async () => [] } as any;
      }
      if (url.endsWith("/lens-type/1") && init?.method === "DELETE") {
        return { ok: true, json: async () => ({ deleted: true }) } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const referenceDataEvent = "ref-evt-settings-deltype-ok";
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = renderHook(() =>
      useSettingsData({
        apiBaseUrl: "http://api",
        referenceDataEvent,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteType(1);
    });

    expect(dispatchSpy.mock.calls.some((c) => (c[0] as Event).type === referenceDataEvent)).toBe(true);
  });
});



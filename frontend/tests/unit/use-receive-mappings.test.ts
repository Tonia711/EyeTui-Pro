import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReceiveMappings } from "@/components/receive/hooks/useReceiveMappings";

const createSetStringState = (initial = "") => {
  let value = initial;
  const setter = vi.fn((next: any) => {
    value = typeof next === "function" ? next(value) : next;
  });
  return { get: () => value, set: setter };
};

describe("receive/hooks/useReceiveMappings", () => {
  it("loads mappings on mount and refreshes on reference data event", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.endsWith("/company")) {
        return {
          ok: true,
          json: async () => [
            { id: 2, name: "B Company" },
            { id: 1, name: "A Company" },
          ],
        } as any;
      }
      if (url.endsWith("/lens-type")) {
        return {
          ok: true,
          json: async () => [
            { id: 10, name: "DEN00V", company_id: 1, company_name: null },
          ],
        } as any;
      }
      if (url.endsWith("/site")) {
        return {
          ok: true,
          json: async () => [
            { id: 2, name: "Clinic B" },
            { id: 1, name: "Clinic A" },
          ],
        } as any;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const errorState = createSetStringState("");
    const referenceDataEvent = "reference-data-changed-receive-test";

    const { result } = renderHook(() =>
      useReceiveMappings({
        apiBaseUrl: "http://api",
        referenceDataEvent,
        setErrorMessage: errorState.set as any,
      }),
    );

    await waitFor(() => expect(result.current.companyOptions.length).toBeGreaterThan(0));
    expect(result.current.companyOptions.map((o) => o.value)).toEqual([
      "A Company",
      "B Company",
    ]);
    expect(result.current.typeOptions.map((o) => o.value)).toEqual(["DEN00V"]);
    expect(result.current.siteOptions.map((o) => o.value)).toEqual([
      "Clinic A",
      "Clinic B",
    ]);

    // Refresh event triggers a reload
    const callsBefore = fetchMock.mock.calls.length;
    window.dispatchEvent(new Event(referenceDataEvent));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("sets error message only if previous error is empty", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => ({ ok: false } as any));
    vi.stubGlobal("fetch", fetchMock);

    const errorState = createSetStringState("already have error");
    renderHook(() =>
      useReceiveMappings({
        apiBaseUrl: "http://api",
        referenceDataEvent: "ref-evt",
        setErrorMessage: errorState.set as any,
      }),
    );

    await waitFor(() => expect(errorState.set).toHaveBeenCalled());
    expect(errorState.get()).toBe("already have error");
    errorSpy.mockRestore();
  });
});



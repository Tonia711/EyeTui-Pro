import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReceiveEntries } from "@/components/receive/hooks/useReceiveEntries";

const createSetStringState = (initial = "") => {
  let value = initial;
  const setter = vi.fn((next: any) => {
    value = typeof next === "function" ? next(value) : next;
  });
  return { get: () => value, set: setter };
};

describe("receive/hooks/useReceiveEntries", () => {
  it("addEntries auto-selects company from type mapping and normalizes future dates to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 2, 12, 0, 0)); // 2025-01-02

    const errorState = createSetStringState("");
    const { result } = renderHook(() =>
      useReceiveEntries({
        apiBaseUrl: "http://api",
        typeToCompanyMap: { DEN00V: "Company A" },
        setErrorMessage: errorState.set as any,
      }),
    );

    act(() => {
      result.current.addEntries([
        { sn: "  SN1  ", type: "DEN00V" }, // company inferred
        { sn: "SN2", date: "2099-01-01" }, // future date -> today, with error
        { sn: "SN1" }, // NOTE: same-batch duplicates are NOT deduped by current implementation
      ]);
    });

    // Current behavior: only de-dupes against existing entries, not within the same batch
    expect(result.current.entries).toHaveLength(3);
    const e1 = result.current.entries.find((e) => e.sn === "SN1")!;
    expect(e1.company).toBe("Company A");
    // missing date gets today's date
    expect(e1.date).toBe("2025-01-02");

    const e2 = result.current.entries.find((e) => e.sn === "SN2")!;
    expect(e2.date).toBe("2025-01-02");
    expect(errorState.get()).toContain("future");

    // But across batches, it will not add SN already present in entries
    act(() => {
      result.current.addEntries([{ sn: "SN1" }]);
    });
    expect(result.current.entries.filter((e) => e.sn === "SN1")).toHaveLength(2);

    vi.useRealTimers();
  });

  it("handleSubmit validates empty entries and missing site", async () => {
    const errorState = createSetStringState("");
    const { result } = renderHook(() =>
      useReceiveEntries({
        apiBaseUrl: "http://api",
        typeToCompanyMap: {},
        setErrorMessage: errorState.set as any,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit("Clinic A");
    });
    expect(errorState.get()).toBe("Please add serial numbers first.");

    act(() => {
      result.current.setEntries([{ id: "1", sn: "SN1", date: "2025-01-01" } as any]);
    });

    await act(async () => {
      await result.current.handleSubmit("");
    });
    expect(errorState.get()).toBe("Please select a clinic site before uploading.");
  });

  it("handleSubmit uploads payload, sets server duplicates/message, and clears entries on success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 2, 12, 0, 0));

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ created_ids: [1, 2], duplicates: ["SNX"] }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const onUploadSuccess = vi.fn();
    const errorState = createSetStringState("");

    const { result } = renderHook(() =>
      useReceiveEntries({
        apiBaseUrl: "http://api",
        typeToCompanyMap: {},
        setErrorMessage: errorState.set as any,
        onUploadSuccess,
      }),
    );

    act(() => {
      result.current.setEntries([
        { id: "1", sn: "SN1", date: "2025-01-01", company: "C", type: "T" } as any,
      ]);
    });

    await act(async () => {
      await result.current.handleSubmit("Clinic A");
    });

    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as any[];
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("serial_number");

    expect(result.current.serverDuplicates).toEqual(["SNX"]);
    expect(result.current.uploadMessage).toContain("Uploaded 2");
    expect(onUploadSuccess).toHaveBeenCalled();
    expect(result.current.entries).toHaveLength(0);

    vi.useRealTimers();
  });

  it("learning mode upload keeps learning entries when duplicates exist", async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ created_ids: [1], duplicates: ["DUP1"] }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const onLearningUploadComplete = vi.fn();
    const errorState = createSetStringState("");

    const { result } = renderHook(() =>
      useReceiveEntries({
        apiBaseUrl: "http://api",
        typeToCompanyMap: {},
        setErrorMessage: errorState.set as any,
        onLearningUploadComplete,
      }),
    );

    act(() => {
      result.current.setEntries([
        { id: "1", sn: "SN1", originalBarcode: "RAW" } as any,
        { id: "2", sn: "SN2" } as any,
      ]);
    });

    const hasDup = await act(async () => await result.current.handleUploadLearningMode("Clinic A"));
    expect(hasDup).toBe(true);
    expect(onLearningUploadComplete).toHaveBeenCalledWith(true);
    // learning entry remains because duplicates exist
    expect(result.current.entries.some((e) => e.originalBarcode)).toBe(true);
  });
});



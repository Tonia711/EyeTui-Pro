import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/receive/utils/barcodeApi", () => {
  return {
    extractSerialNumberSmart: vi.fn(),
  };
});

import { extractSerialNumberSmart } from "@/components/receive/utils/barcodeApi";
import { useBarcodeScanner } from "@/components/receive/hooks/useBarcodeScanner";

const createSetStringState = (initial = "") => {
  let value = initial;
  const setter = vi.fn((next: any) => {
    value = typeof next === "function" ? next(value) : next;
  });
  return { get: () => value, set: setter };
};

describe("receive/hooks/useBarcodeScanner", () => {
  it("handleLearningModeToggle enters study mode when closed", () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");

    const { result } = renderHook(() =>
      useBarcodeScanner({
        apiBaseUrl: "http://api",
        entries: [],
        addEntries: vi.fn(),
        setEntries: vi.fn() as any,
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    expect(result.current.showStudyMode).toBe(false);
    act(() => result.current.handleLearningModeToggle());
    expect(result.current.showStudyMode).toBe(true);
    expect(result.current.patternSaved).toBe(false);
  });

  it("handleLearningModeToggle refuses to close study mode when there are learning entries", () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");

    const { result, rerender } = renderHook(
      ({ entries }) =>
        useBarcodeScanner({
          apiBaseUrl: "http://api",
          entries,
          addEntries: vi.fn(),
          setEntries: vi.fn() as any,
          setErrorMessage: errorState.set as any,
          setUploadMessage: uploadState.set as any,
        }),
      {
        initialProps: { entries: [{ sn: "SN1", originalBarcode: "RAW", id: "1" } as any] },
      },
    );

    act(() => result.current.setShowStudyMode(true));

    // rerender with learning entries still present
    rerender({ entries: [{ sn: "SN1", originalBarcode: "RAW", id: "1" } as any] });
    act(() => result.current.handleLearningModeToggle());

    expect(errorState.get()).toContain("Please clear or upload");
    expect(result.current.showStudyMode).toBe(true);
  });

  it("processBarcodeInput adds extracted SN and auto-learns pattern when not in study mode", async () => {
    vi.useFakeTimers();

    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");
    const addEntries = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) } as any)),
    );

    (extractSerialNumberSmart as any).mockResolvedValue({
      sn: "SN123",
      type: "DEN00V",
      power: "+12.3D",
    });

    const { result } = renderHook(() =>
      useBarcodeScanner({
        apiBaseUrl: "http://api",
        entries: [],
        addEntries,
        setEntries: vi.fn() as any,
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    const input = document.createElement("input");
    result.current.barcodeInputRef.current = input;

    await act(async () => {
      await result.current.processBarcodeInput("  RAWBARCODE  ");
    });

    expect(addEntries).toHaveBeenCalledWith([
      { sn: "SN123", type: "DEN00V", power: "+12.3D", originalBarcode: undefined },
    ]);
    expect(errorState.get()).toBe("");

    // focus timeout
    act(() => {
      vi.runAllTimers();
    });

    vi.useRealTimers();
  });

  it("handleSavePattern errors when there are no entries with originalBarcode", async () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");

    const { result } = renderHook(() =>
      useBarcodeScanner({
        apiBaseUrl: "http://api",
        entries: [{ sn: "SN1", id: "1" } as any],
        addEntries: vi.fn(),
        setEntries: vi.fn() as any,
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    await act(async () => {
      await result.current.handleSavePattern();
    });

    expect(errorState.get()).toContain("No entries with barcode found");
  });

  it("handleSavePattern learns patterns for entries with originalBarcode", async () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) } as any));
    vi.stubGlobal("fetch", fetchMock);

    const entries = [
      { sn: "SN1", originalBarcode: "RAW1", id: "1", company: "C", type: "T", power: "+1.0D" } as any,
      { sn: "SN2", originalBarcode: "RAW2", id: "2" } as any,
    ];

    const { result } = renderHook(() =>
      useBarcodeScanner({
        apiBaseUrl: "http://api",
        entries,
        addEntries: vi.fn(),
        setEntries: vi.fn() as any,
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    await act(async () => {
      await result.current.handleSavePattern();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.patternSaved).toBe(true);
    expect(result.current.learnSuccess).toBe(true);
    expect(errorState.get()).toBe("");
  });

  it("handleLearnPattern in study mode validates inputs and can learn successfully", async () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");
    const addEntries = vi.fn();

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) } as any));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useBarcodeScanner({
        apiBaseUrl: "http://api",
        entries: [],
        addEntries,
        setEntries: vi.fn() as any,
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    // Enter study mode
    act(() => result.current.setShowStudyMode(true));

    await act(async () => {
      await result.current.handleLearnPattern();
    });
    expect(errorState.get()).toContain("Please enter a barcode.");

    act(() => {
      result.current.setStudyBarcode("RAW");
    });
    await act(async () => {
      await result.current.handleLearnPattern();
    });
    expect(errorState.get()).toContain("Please enter a serial number.");

    act(() => {
      result.current.setStudySerialNumber("!!");
    });
    await act(async () => {
      await result.current.handleLearnPattern();
    });
    expect(errorState.get()).toContain("too short");

    act(() => {
      result.current.setStudySerialNumber("A*1");
    });
    await act(async () => {
      await result.current.handleLearnPattern();
    });
    expect(errorState.get()).toContain("only contain letters and numbers");

    act(() => {
      result.current.setStudySerialNumber("SN123");
      result.current.setStudyCompany("  ACME  ");
      result.current.setStudyType("  DEN00V  ");
      result.current.setStudyPower("  +12.3D  ");
    });

    await act(async () => {
      await result.current.handleLearnPattern();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.learnSuccess).toBe(true);
    expect(addEntries).toHaveBeenCalledWith([
      { sn: "SN123", company: "ACME", type: "DEN00V", power: "+12.3D" },
    ]);
  });

  it("handleLearnPattern outside study mode requires a selected SN range and learns from selection", async () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");
    const addEntries = vi.fn();

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) } as any));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useBarcodeScanner({
        apiBaseUrl: "http://api",
        entries: [],
        addEntries,
        setEntries: vi.fn() as any,
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    await act(async () => {
      await result.current.handleLearnPattern();
    });
    expect(errorState.get()).toContain("Please select the serial number part");

    act(() => {
      result.current.setLastBarcodeInput("XXSN123YY");
      result.current.setSelectedSNStart(2);
      result.current.setSelectedSNEnd(7);
    });

    await act(async () => {
      await result.current.handleLearnPattern();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(addEntries).toHaveBeenCalledWith([{ sn: "SN123" }]);
    expect(result.current.learnSuccess).toBe(true);
  });

  it("handleBarcodePaste triggers processing of pasted text and handleBarcodeKeyDown Escape stops scanner", async () => {
    vi.useFakeTimers();

    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");
    const addEntries = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) } as any)),
    );
    (extractSerialNumberSmart as any).mockResolvedValue({ sn: "SN999" });

    const { result } = renderHook(() =>
      useBarcodeScanner({
        apiBaseUrl: "http://api",
        entries: [],
        addEntries,
        setEntries: vi.fn() as any,
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    // Start scanner and simulate paste
    act(() => result.current.startBarcodeScanner());
    const input = document.createElement("input");
    input.value = "  PASTED  ";
    result.current.barcodeInputRef.current = input;

    act(() => {
      result.current.handleBarcodePaste({} as any);
      vi.advanceTimersByTime(20);
    });

    // processBarcodeInput is async; flush microtasks
    await act(async () => {
      await Promise.resolve();
    });

    expect(addEntries).toHaveBeenCalledWith([{ sn: "SN999", type: undefined, power: undefined, originalBarcode: undefined }]);

    // Escape should stop barcode scanner when scanner input is showing
    act(() => {
      result.current.handleBarcodeKeyDown({ key: "Escape" } as any);
    });
    expect(result.current.showBarcodeScannerInput).toBe(false);

    vi.useRealTimers();
  });
});



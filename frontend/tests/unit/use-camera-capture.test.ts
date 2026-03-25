import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@zxing/browser", () => {
  class BrowserMultiFormatReader {
    static listVideoInputDevices = vi.fn(async () => [
      { deviceId: "dev1", label: "Camera 1" },
      { deviceId: "dev2", label: "Camera 2" },
    ]);
    decodeFromVideoElement = vi.fn();
  }
  return { BrowserMultiFormatReader };
});

import { useCameraCapture } from "@/components/receive/hooks/useCameraCapture";

const createSetStringState = (initial = "") => {
  let value = initial;
  const setter = vi.fn((next: any) => {
    value = typeof next === "function" ? next(value) : next;
  });
  return { get: () => value, set: setter };
};

describe("receive/hooks/useCameraCapture", () => {
  it("startCamera early-returns with helpful error when mediaDevices is unavailable", () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");

    // Simulate unsupported environment
    (navigator as any).mediaDevices = undefined;

    const { result } = renderHook(() =>
      useCameraCapture({
        apiBaseUrl: "http://api",
        showStudyMode: false,
        addEntries: vi.fn(),
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    act(() => result.current.startCamera());
    expect(errorState.get()).toContain("Camera access is unavailable");
    expect(result.current.showCamera).toBe(false);
  });

  it("startCamera starts camera flow and populates device list when mocked getUserMedia succeeds", async () => {
    const errorState = createSetStringState("");
    const uploadState = createSetStringState("");

    const trackStop = vi.fn();
    const stream = {
      getTracks: () => [{ stop: trackStop }],
      getVideoTracks: () => [
        {
          getSettings: () => ({ facingMode: "environment" }),
        },
      ],
    } as any;

    (navigator as any).mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };

    const { result } = renderHook(() =>
      useCameraCapture({
        apiBaseUrl: "http://api",
        showStudyMode: false,
        addEntries: vi.fn(),
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    const video = document.createElement("video");
    // JSDOM may not have writable srcObject
    Object.defineProperty(video, "srcObject", { value: null, writable: true });
    result.current.videoRef.current = video;

    act(() => result.current.startCamera());

    await waitFor(() => expect(result.current.showCamera).toBe(true));
    await waitFor(() => expect(result.current.availableDevices.length).toBeGreaterThan(0));
    expect(result.current.selectedDeviceId).toBeTruthy();
    expect(errorState.get()).toBe("");

    act(() => result.current.stopCamera());
    expect(trackStop).toHaveBeenCalled();
  });

  it("stopCamera clears specific transient error messages", () => {
    const errorState = createSetStringState("No barcode detected. Please adjust angle/lighting");
    const uploadState = createSetStringState("");

    const { result } = renderHook(() =>
      useCameraCapture({
        apiBaseUrl: "http://api",
        showStudyMode: false,
        addEntries: vi.fn(),
        setErrorMessage: errorState.set as any,
        setUploadMessage: uploadState.set as any,
      }),
    );

    act(() => result.current.stopCamera());
    expect(errorState.get()).toBe("");
  });
});



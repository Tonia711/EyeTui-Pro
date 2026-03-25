import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIsMobile } from "@/components/ui/use-mobile";

describe("ui/use-mobile", () => {
  it("tracks viewport width using matchMedia change events", () => {
    let changeListener: (() => void) | undefined;

    const mql = {
      addEventListener: vi.fn((_event: string, cb: () => void) => {
        changeListener = cb;
      }),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal("matchMedia", vi.fn(() => mql as any));

    // Start desktop
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Switch to mobile
    act(() => {
      (window as any).innerWidth = 375;
      changeListener?.();
    });
    expect(result.current).toBe(true);

    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});



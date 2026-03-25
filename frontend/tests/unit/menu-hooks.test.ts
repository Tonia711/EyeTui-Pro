import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSupplierMenu } from "@/components/invoice-management/hooks/useSupplierMenu";
import { useInventoryMenus } from "@/components/inventory/hooks/useInventoryMenus";
import { useClinicMenu } from "@/components/receive/hooks/useClinicMenu";

const mockButtonRect = (el: HTMLButtonElement) => {
  el.getBoundingClientRect = () =>
    ({
      bottom: 200,
      left: 10,
      width: 300,
    }) as any;
};

describe("menu hooks (close on Escape/click; update rect on scroll/resize)", () => {
  it("useSupplierMenu closes on Escape and updates rect when open", () => {
    const { result } = renderHook(() => useSupplierMenu());
    const btn = document.createElement("button");
    mockButtonRect(btn);
    result.current.supplierButtonRef.current = btn;

    act(() => {
      result.current.setSupplierMenuOpen(true);
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.supplierMenuRect).toEqual({ top: 200, left: 10, width: 300 });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.supplierMenuOpen).toBe(false);
  });

  it("useInventoryMenus closes all menus on click and updates positions", () => {
    const { result } = renderHook(() => useInventoryMenus());
    const companyBtn = document.createElement("button");
    const statusBtn = document.createElement("button");
    const clinicBtn = document.createElement("button");
    mockButtonRect(companyBtn);
    mockButtonRect(statusBtn);
    mockButtonRect(clinicBtn);
    result.current.companyButtonRef.current = companyBtn;
    result.current.statusButtonRef.current = statusBtn;
    result.current.clinicButtonRef.current = clinicBtn;

    act(() => {
      result.current.setCompanyMenuOpen(true);
      result.current.setStatusMenuOpen(true);
      result.current.setClinicMenuOpen(true);
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.companyMenuRect).toEqual({ top: 200, left: 10, width: 300 });
    expect(result.current.statusMenuRect).toEqual({ top: 200, left: 10, width: 300 });
    expect(result.current.clinicMenuRect).toEqual({ top: 200, left: 10, width: 300 });

    act(() => {
      document.dispatchEvent(new MouseEvent("click"));
    });
    expect(result.current.companyMenuOpen).toBe(false);
    expect(result.current.statusMenuOpen).toBe(false);
    expect(result.current.clinicMenuOpen).toBe(false);
  });

  it("useClinicMenu closes on click and updates rect when open", () => {
    const { result } = renderHook(() => useClinicMenu());
    const btn = document.createElement("button");
    mockButtonRect(btn);
    result.current.clinicButtonRef.current = btn;

    act(() => {
      result.current.setClinicMenuOpen(true);
    });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.clinicMenuRect).toEqual({ top: 200, left: 10, width: 300 });

    act(() => {
      document.dispatchEvent(new MouseEvent("click"));
    });
    expect(result.current.clinicMenuOpen).toBe(false);
  });
});



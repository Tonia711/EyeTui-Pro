import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInventoryFilters } from "@/components/inventory/hooks/useInventoryFilters";

describe("inventory/hooks/useInventoryFilters", () => {
  it("toggles status and builds stable label ordering", () => {
    const onClinicChange = vi.fn();
    const { result } = renderHook(() => useInventoryFilters(onClinicChange));

    // Default includes In Stock + Used (no Invoiced)
    expect(result.current.selectedStatuses).toEqual(["In Stock", "Used"]);
    expect(result.current.statusLabel).toBe("In Stock, Used");

    act(() => {
      result.current.toggleStatus("In Stock");
    });
    expect(result.current.selectedStatuses).toEqual(["Used"]);
    expect(result.current.statusLabel).toBe("Used");

    act(() => {
      result.current.toggleStatus("Invoiced");
    });
    // label order should follow STATUS_OPTIONS order
    expect(result.current.selectedStatuses.sort()).toEqual(["Invoiced", "Used"]);
    expect(result.current.statusLabel).toBe("Used, Invoiced");
  });

  it("clearFilters resets and calls onClinicChange", () => {
    const onClinicChange = vi.fn();
    const { result } = renderHook(() => useInventoryFilters(onClinicChange));

    act(() => {
      result.current.setSearchSerial("x");
      result.current.setSearchType("y");
      result.current.setSearchPower("z");
      result.current.setSelectedCompany("Company A");
      result.current.toggleStatus("Invoiced");
    });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.searchSerial).toBe("");
    expect(result.current.searchType).toBe("");
    expect(result.current.searchPower).toBe("");
    expect(result.current.selectedCompany).toBe("All Companies");
    expect(result.current.selectedStatuses).toEqual(["In Stock", "Used"]);
    expect(onClinicChange).toHaveBeenCalledWith("All Clinics");
  });
});



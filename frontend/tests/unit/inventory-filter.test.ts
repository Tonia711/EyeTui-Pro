import { describe, expect, it } from "vitest";
import { filterLensData } from "@/components/inventory/filter";
import type { LensData, StatusOption } from "@/components/inventory/types";

describe("inventory/filter", () => {
  const lensData: LensData[] = [
    {
      id: 1,
      serial_number: "SN-AAA",
      is_used: false,
      is_matched: false,
      type: "TYPE1",
      power: "+10.0",
      received_date: "2025-01-01",
      used_date: null,
      site: "Clinic A",
      company: "Company A",
      move_from_clinic: null,
      invoice_id: null,
    },
    {
      id: 2,
      serial_number: "SN-BBB",
      is_used: true,
      is_matched: false,
      type: "TYPE2",
      power: "+11.0",
      received_date: "2025-01-02",
      used_date: "2025-01-10",
      site: null,
      company: "Company A",
      move_from_clinic: null,
      invoice_id: null,
    },
    {
      id: 3,
      serial_number: "SN-CCC",
      is_used: true,
      is_matched: true,
      type: null,
      power: null,
      received_date: "2025-01-03",
      used_date: null,
      site: "Clinic B",
      company: "Company B",
      move_from_clinic: null,
      invoice_id: 123,
    },
  ];

  const baseFilters = {
    searchSerial: "",
    searchType: "",
    searchPower: "",
    selectedCompany: "All Companies",
    selectedStatuses: [] as StatusOption[],
    selectedClinic: "All Clinics",
  };

  it("filters by status options (In Stock / Used / Invoiced)", () => {
    const usedOnly = filterLensData(lensData, {
      ...baseFilters,
      selectedStatuses: ["Used"],
    });
    expect(usedOnly.map((l) => l.id)).toEqual([2]);

    const invoicedOnly = filterLensData(lensData, {
      ...baseFilters,
      selectedStatuses: ["Invoiced"],
    });
    expect(invoicedOnly.map((l) => l.id)).toEqual([3]);

    const usedOrInvoiced = filterLensData(lensData, {
      ...baseFilters,
      selectedStatuses: ["Used", "Invoiced"],
    });
    expect(usedOrInvoiced.map((l) => l.id).sort()).toEqual([2, 3]);
  });

  it('treats null site as "Not Assigned" for clinic filtering', () => {
    const notAssigned = filterLensData(lensData, {
      ...baseFilters,
      selectedClinic: "Not Assigned",
    });
    expect(notAssigned.map((l) => l.id)).toEqual([2]);
  });

  it("filters by company", () => {
    const companyB = filterLensData(lensData, {
      ...baseFilters,
      selectedCompany: "Company B",
    });
    expect(companyB.map((l) => l.id)).toEqual([3]);
  });
});



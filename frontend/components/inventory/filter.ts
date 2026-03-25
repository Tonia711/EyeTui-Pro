import { type LensData, type StatusOption } from "./types";

interface InventoryFilters {
  searchSerial: string;
  searchType: string;
  searchPower: string;
  selectedCompany: string;
  selectedStatuses: StatusOption[];
  selectedClinic: string;
}

export const filterLensData = (
  lensData: LensData[],
  filters: InventoryFilters,
) => {
  const {
    searchSerial,
    searchType,
    searchPower,
    selectedCompany,
    selectedStatuses,
    selectedClinic,
  } = filters;

  return lensData.filter((lens) => {
    if (
      searchSerial &&
      !lens.serial_number.toLowerCase().includes(searchSerial.toLowerCase())
    ) {
      return false;
    }
    if (searchType) {
      const typeValue = lens.type || "";
      if (!typeValue.toLowerCase().includes(searchType.toLowerCase())) {
        return false;
      }
    }
    if (searchPower) {
      const powerValue = lens.power || "";
      if (!powerValue.toLowerCase().includes(searchPower.toLowerCase())) {
        return false;
      }
    }
    if (selectedCompany !== "All Companies") {
      if ((lens.company || "") !== selectedCompany) {
        return false;
      }
    }
    if (selectedStatuses.length > 0) {
      const inStockMatch =
        !lens.is_used &&
        !lens.is_matched &&
        selectedStatuses.includes("In Stock");
      // Treat "Invoiced" as a distinct state; do not include matched items in "Used"
      const usedMatch =
        lens.is_used && !lens.is_matched && selectedStatuses.includes("Used");
      const invoicedMatch =
        lens.is_matched && selectedStatuses.includes("Invoiced");
      if (!inStockMatch && !usedMatch && !invoicedMatch) {
        return false;
      }
    }
    if (selectedClinic !== "All Clinics") {
      if ((lens.site || "Not Assigned") !== selectedClinic) {
        return false;
      }
    }
    return true;
  });
};

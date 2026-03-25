import { useMemo, useState } from "react";
import { STATUS_OPTIONS, type StatusOption } from "../types";

export const useInventoryFilters = (onClinicChange: (clinic: string) => void) => {
  const [searchSerial, setSearchSerial] = useState("");
  const [searchType, setSearchType] = useState("");
  const [searchPower, setSearchPower] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("All Companies");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusOption[]>([
    "In Stock",
    "Used",
  ]);

  const clearFilters = () => {
    setSearchSerial("");
    setSearchType("");
    setSearchPower("");
    setSelectedCompany("All Companies");
    setSelectedStatuses(["In Stock", "Used"]);
    onClinicChange("All Clinics");
  };

  const toggleStatus = (status: StatusOption) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((item) => item !== status);
      }
      return [...prev, status];
    });
  };

  const statusLabel = useMemo(() => {
    if (selectedStatuses.length === 0) return "Select Status";
    // Show selected statuses directly in the trigger (stable order)
    const ordered = STATUS_OPTIONS.filter((s) => selectedStatuses.includes(s));
    return ordered.join(", ");
  }, [selectedStatuses]);

  return {
    searchSerial,
    setSearchSerial,
    searchType,
    setSearchType,
    searchPower,
    setSearchPower,
    selectedCompany,
    setSelectedCompany,
    selectedStatuses,
    toggleStatus,
    statusLabel,
    clearFilters,
  };
};

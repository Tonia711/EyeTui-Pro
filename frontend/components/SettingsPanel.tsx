import { useMemo, useState } from "react";
import { type ComboboxOption } from "./ui/combobox";
import { Accordion } from "./ui/accordion";
import { SettingsMessage } from "./settings/SettingsMessage";
import { SuppliersSection } from "./settings/sections/SuppliersSection";
import { CompaniesSection } from "./settings/sections/CompaniesSection";
import { LensTypesSection } from "./settings/sections/LensTypesSection";
import { ClinicsSection } from "./settings/sections/ClinicsSection";
import { useSettingsData } from "./settings/hooks/useSettingsData";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";
const REFERENCE_DATA_CHANGED_EVENT = "eyetui:reference-data-changed";

export function SettingsPanel() {
  // Accordion state - tracks which sections are open
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const {
    companies,
    suppliers,
    sites,
    types,
    message,
    error,
    setMessage,
    setError,
    handleCreateCompany,
    handleCreateSupplier,
    handleCreateSite,
    handleCreateType,
    handleUpdateCompany,
    handleUpdateSupplier,
    handleUpdateSite,
    handleUpdateType,
    handleDeleteCompany,
    handleDeleteSupplier,
    handleDeleteSite,
    handleDeleteType,
  } = useSettingsData({
    apiBaseUrl: API_BASE_URL,
    referenceDataEvent: REFERENCE_DATA_CHANGED_EVENT,
  });

  const companyOptionsById: ComboboxOption[] = useMemo(
    () =>
      [...companies]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((company) => ({
          value: String(company.id),
          label: company.name,
        })),
    [companies],
  );
  const ensureOpen = (value: string) => {
    setOpenAccordions((prev) =>
      prev.includes(value) ? prev : [...prev, value],
    );
  };

  return (
    <div
      className="space-y-10 text-gray-900"
      style={{ fontFamily: "Jost, sans-serif" }}
    >
      <SettingsMessage
        error={error}
        message={message}
        onDismiss={() => (error ? setError(null) : setMessage(null))}
      />

      <Accordion
        type="multiple"
        className="space-y-6"
        value={openAccordions}
        onValueChange={setOpenAccordions}
      >
        <SuppliersSection
          suppliers={suppliers}
          isOpen={openAccordions.includes("suppliers")}
          ensureOpen={() => ensureOpen("suppliers")}
          onCreate={handleCreateSupplier}
          onUpdate={handleUpdateSupplier}
          onDelete={handleDeleteSupplier}
        />

        <CompaniesSection
          companies={companies}
          isOpen={openAccordions.includes("companies")}
          ensureOpen={() => ensureOpen("companies")}
          onCreate={handleCreateCompany}
          onUpdate={handleUpdateCompany}
          onDelete={handleDeleteCompany}
        />

        <LensTypesSection
          types={types}
          companyOptionsById={companyOptionsById}
          isOpen={openAccordions.includes("lens-types")}
          ensureOpen={() => ensureOpen("lens-types")}
          onCreate={handleCreateType}
          onUpdate={handleUpdateType}
          onDelete={handleDeleteType}
        />

        <ClinicsSection
          sites={sites}
          isOpen={openAccordions.includes("clinics")}
          ensureOpen={() => ensureOpen("clinics")}
          onCreate={handleCreateSite}
          onUpdate={handleUpdateSite}
          onDelete={handleDeleteSite}
        />
      </Accordion>
    </div>
  );
}

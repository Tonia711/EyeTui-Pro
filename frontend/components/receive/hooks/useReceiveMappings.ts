import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ComboboxOption } from "../../ui/combobox";
import { buildTypeMappings, type CompanyRow, type LensTypeRow } from "../utils/mappings";

export type SiteRow = { id: number; name: string };

interface UseReceiveMappingsParams {
  apiBaseUrl: string;
  referenceDataEvent: string;
  setErrorMessage: Dispatch<SetStateAction<string>>;
}

export const useReceiveMappings = ({
  apiBaseUrl,
  referenceDataEvent,
  setErrorMessage,
}: UseReceiveMappingsParams) => {
  const [companyOptions, setCompanyOptions] = useState<ComboboxOption[]>([]);
  const [typeOptions, setTypeOptions] = useState<ComboboxOption[]>([]);
  const [siteOptions, setSiteOptions] = useState<ComboboxOption[]>([]);
  const [companyTypeMap, setCompanyTypeMap] = useState<
    Record<string, ComboboxOption[]>
  >({});
  const [typeToCompanyMap, setTypeToCompanyMap] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let cancelled = false;

    const loadMappings = async () => {
      try {
        const [companiesRes, typesRes, sitesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/company`),
          fetch(`${apiBaseUrl}/lens-type`),
          fetch(`${apiBaseUrl}/site`),
        ]);
        if (!companiesRes.ok || !typesRes.ok || !sitesRes.ok) {
          throw new Error("Failed to load company/type/site mapping");
        }
        const companies = (await companiesRes.json()) as CompanyRow[];
        const types = (await typesRes.json()) as LensTypeRow[];
        const sites = (await sitesRes.json()) as SiteRow[];
        if (cancelled) return;
        const mappings = buildTypeMappings(companies, types);
        setCompanyOptions(mappings.companyOptions);
        setTypeOptions(mappings.typeOptions);
        setCompanyTypeMap(mappings.companyTypeMap);
        setTypeToCompanyMap(mappings.typeToCompanyMap);
        const nextSiteOptions = [...sites]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((site) => ({ value: site.name, label: site.name }));
        setSiteOptions(nextSiteOptions);
      } catch (error) {
        console.error("[MAPPING] Failed to load company/type/site mapping:", error);
        setErrorMessage((prev) =>
          prev ? prev : "Failed to load company/type mapping from database.",
        );
      }
    };

    loadMappings();
    const onReferenceDataChanged = () => {
      loadMappings();
    };
    window.addEventListener(referenceDataEvent, onReferenceDataChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(referenceDataEvent, onReferenceDataChanged);
    };
  }, [apiBaseUrl, referenceDataEvent, setErrorMessage]);

  return {
    companyOptions,
    typeOptions,
    siteOptions,
    companyTypeMap,
    typeToCompanyMap,
  };
};

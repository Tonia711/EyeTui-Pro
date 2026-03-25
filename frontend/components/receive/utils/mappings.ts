import type { ComboboxOption } from "../../ui/combobox";

export type CompanyRow = { id: number; name: string };
export type LensTypeRow = {
  id: number;
  name: string;
  company_id: number;
  company_name?: string | null;
};

export const buildTypeMappings = (
  companies: CompanyRow[],
  types: LensTypeRow[],
) => {
  const companyNameById = new Map<number, string>();
  companies.forEach((company) => companyNameById.set(company.id, company.name));

  const companyOptions = [...companies]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((company) => ({ value: company.name, label: company.name }));

  const typeOptions = [...types]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((lensType) => ({ value: lensType.name, label: lensType.name }));

  const companyTypeMap: Record<string, ComboboxOption[]> = {};
  const typeToCompanyMap: Record<string, string> = {};

  const addTypeVariants = (typeValue: string, companyName: string) => {
    if (typeValue === "Other") return;
    if (!typeToCompanyMap[typeValue]) typeToCompanyMap[typeValue] = companyName;
    const upperCase = typeValue.toUpperCase();
    const lowerCase = typeValue.toLowerCase();
    const titleCase = typeValue
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    if (!typeToCompanyMap[upperCase]) typeToCompanyMap[upperCase] = companyName;
    if (!typeToCompanyMap[lowerCase]) typeToCompanyMap[lowerCase] = companyName;
    if (!typeToCompanyMap[titleCase]) typeToCompanyMap[titleCase] = companyName;
  };

  types.forEach((lensType) => {
    const companyName =
      lensType.company_name ||
      companyNameById.get(lensType.company_id) ||
      "Unknown";
    const option = { value: lensType.name, label: lensType.name };
    if (!companyTypeMap[companyName]) {
      companyTypeMap[companyName] = [];
    }
    companyTypeMap[companyName].push(option);
    addTypeVariants(lensType.name, companyName);
  });

  return { companyOptions, typeOptions, companyTypeMap, typeToCompanyMap };
};

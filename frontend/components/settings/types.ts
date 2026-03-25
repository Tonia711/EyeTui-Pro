export type CompanyRow = { id: number; name: string };
export type SupplierRow = { id: number; name: string };
export type SiteRow = { id: number; name: string };
export type LensTypeRow = {
  id: number;
  name: string;
  company_id: number;
  company_name?: string | null;
};

export type InlineEdit = {
  id: number;
  value: string;
};

export type EditingType = {
  id: number;
  name: string;
  companyId: string;
};

export type CompanyRow = { id: number; name: string };
export type SiteRow = { id: number; name: string };

export interface LensData {
  id: number;
  serial_number: string;
  is_used: boolean;
  is_matched: boolean;
  type: string | null;
  power: string | null;
  received_date: string;
  used_date?: string | null;
  site: string | null;
  company: string | null;
  move_from_clinic: string | null;
  invoice_id: number | null;
}

export const STATUS_OPTIONS = ["In Stock", "Used", "Invoiced"] as const;
export type StatusOption = (typeof STATUS_OPTIONS)[number];

export type EditingField = "sn" | "date" | "company" | "type" | "power" | null;

export interface SerialNumberEntry {
  id: string;
  sn: string;
  date?: string;
  company?: string;
  type?: string;
  power?: string;
  originalBarcode?: string;
}

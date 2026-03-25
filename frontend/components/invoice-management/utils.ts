import * as XLSX from "xlsx";
import { type InvoiceFromAPI, type InvoiceRecord } from "./types";

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const groupInvoices = (data: InvoiceFromAPI[]) => {
  const grouped = data.reduce((acc, item) => {
    const key = item.invoice_number;
    if (!acc[key]) {
      acc[key] = {
        uploadDate: formatDate(item.upload_date),
        supplier: item.supplier_name || "Unknown",
        invoiceNumber: item.invoice_number,
        serialNumbers: [],
      };
    }
    const existingSN = acc[key].serialNumbers.find(
      (sn) => sn.sn === item.serial_number,
    );
    if (!existingSN) {
      acc[key].serialNumbers.push({
        sn: item.serial_number,
        isMatched: item.is_matched,
      });
    }
    return acc;
  }, {} as Record<string, InvoiceRecord>);

  return Object.values(grouped);
};

export const exportInvoicesToExcel = (invoices: InvoiceRecord[]) => {
  if (invoices.length === 0) {
    return;
  }

  const rows: Array<Array<string>> = [
    ["Upload Date", "Invoice Number", "Supplier", "Serial Number", "Is Matched"],
  ];

  invoices.forEach((invoice) => {
    invoice.serialNumbers.forEach((item) => {
      rows.push([
        invoice.uploadDate,
        invoice.invoiceNumber,
        invoice.supplier,
        item.sn,
        item.isMatched ? "Yes" : "No",
      ]);
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice List");

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, "0")}${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}${today.getFullYear()}`;
  XLSX.writeFile(workbook, `invoice_list_${dateStr}.xlsx`);
};

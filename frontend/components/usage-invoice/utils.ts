import * as XLSX from "xlsx";
import { type Invoice, type LensOut } from "./types";

export const getStatusText = (inReceive: boolean, inUse: boolean) => {
  if (inReceive && inUse) return { text: "Matched", color: "text-[#0dcaf0]" };
  if (inReceive && !inUse)
    return { text: "Not Used", color: "text-[#FFAA07]" };
  if (!inReceive && inUse)
    return { text: "Used Only", color: "text-[#FFAA07]" };
  return { text: "Missing", color: "text-[#FFAA07]" };
};

export const exportReconciliationExcel = (
  invoices: Invoice[],
  lensDataMap: Map<string, LensOut>,
) => {
  if (invoices.length === 0) {
    return;
  }

  const uploadDate = new Date();
  const uploadDateStr = `${String(uploadDate.getDate()).padStart(2, "0")}${String(
    uploadDate.getMonth() + 1,
  ).padStart(2, "0")}${uploadDate.getFullYear()}`;

  const excelData: Array<Array<string>> = [];
  excelData.push([
    "Upload Date",
    "Invoice Number",
    "Supplier",
    "Serial Number",
    "Received Date",
    "Used Date",
    "Is Matched",
  ]);

  invoices.forEach((invoice) => {
    invoice.serialNumbers.forEach((item) => {
      const lensData = lensDataMap.get(item.sn);
      excelData.push([
        uploadDateStr,
        invoice.invoiceNumber || "N/A",
        invoice.company || "N/A",
        item.sn,
        lensData?.received_date || "N/A",
        lensData?.used_date || "N/A",
        lensData?.is_matched ? "Yes" : "No",
      ]);
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reconciliation");

  const filename = `reconciliation_result_${uploadDateStr}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

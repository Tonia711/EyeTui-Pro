import { type InvoiceRecord } from "./types";

interface InvoiceFilters {
  uploadDateFrom: string;
  uploadDateTo: string;
  selectedSupplier: string;
  invoiceNumberSearch: string;
  serialNumberSearch: string;
}

export const filterInvoices = (invoices: InvoiceRecord[], filters: InvoiceFilters) => {
  const {
    uploadDateFrom,
    uploadDateTo,
    selectedSupplier,
    invoiceNumberSearch,
    serialNumberSearch,
  } = filters;

  return invoices
    .filter((invoice) => {
      const matchSupplier =
        selectedSupplier === "All Suppliers" ||
        invoice.supplier === selectedSupplier;
      const matchInvoiceNumber = invoice.invoiceNumber
        .toLowerCase()
        .includes(invoiceNumberSearch.toLowerCase());
      const matchSerialNumber =
        serialNumberSearch === "" ||
        invoice.serialNumbers.some((item) =>
          item.sn.includes(serialNumberSearch),
        );

      // Date filtering - parse dd/mm/yyyy format
      let matchDate = true;
      if (uploadDateFrom || uploadDateTo) {
        const [day, month, year] = invoice.uploadDate.split("/").map(Number);
        const invoiceDate = new Date(year, month - 1, day);
        invoiceDate.setHours(0, 0, 0, 0); // Normalize to start of day

        if (uploadDateFrom) {
          const fromDate = new Date(uploadDateFrom);
          fromDate.setHours(0, 0, 0, 0); // Normalize to start of day
          if (invoiceDate < fromDate) matchDate = false; // Now includes the selected date
        }
        if (uploadDateTo) {
          const toDate = new Date(uploadDateTo);
          toDate.setHours(23, 59, 59, 999); // Set to end of day
          if (invoiceDate > toDate) matchDate = false; // Includes the selected date
        }
      }

      return (
        matchSupplier &&
        matchInvoiceNumber &&
        matchSerialNumber &&
        matchDate
      );
    })
    .sort((a, b) => {
      // Sort by upload date first (newest first)
      const [dayA, monthA, yearA] = a.uploadDate.split("/").map(Number);
      const [dayB, monthB, yearB] = b.uploadDate.split("/").map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);

      const dateDiff = dateB.getTime() - dateA.getTime();
      if (dateDiff !== 0) return dateDiff;

      // If same date, sort by supplier name alphabetically
      return a.supplier.localeCompare(b.supplier);
    });
};

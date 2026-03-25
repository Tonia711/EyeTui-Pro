import { useState } from "react";

export const useInvoiceFilters = () => {
  const [uploadDateFrom, setUploadDateFrom] = useState("");
  const [uploadDateTo, setUploadDateTo] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("All Suppliers");
  const [invoiceNumberSearch, setInvoiceNumberSearch] = useState("");
  const [serialNumberSearch, setSerialNumberSearch] = useState("");

  const clearFilters = () => {
    setUploadDateFrom("");
    setUploadDateTo("");
    setSelectedSupplier("All Suppliers");
    setInvoiceNumberSearch("");
    setSerialNumberSearch("");
  };

  return {
    uploadDateFrom,
    setUploadDateFrom,
    uploadDateTo,
    setUploadDateTo,
    selectedSupplier,
    setSelectedSupplier,
    invoiceNumberSearch,
    setInvoiceNumberSearch,
    serialNumberSearch,
    setSerialNumberSearch,
    clearFilters,
  };
};

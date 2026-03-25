import { useCallback, useEffect, useState } from "react";
import { type InvoiceFromAPI, type InvoiceRecord } from "../types";
import { groupInvoices } from "../utils";

interface UseInvoiceDataParams {
  apiBaseUrl: string;
  isActive?: boolean;
}

export const useInvoiceData = ({ apiBaseUrl, isActive }: UseInvoiceDataParams) => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([
    "All Suppliers",
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/supplier`);
      if (!response.ok) {
        throw new Error("Failed to fetch suppliers");
      }
      const data: Array<{ id: number; name: string }> = await response.json();
      const options = ["All Suppliers", ...data.map((s) => s.name)];
      setSupplierOptions(options);
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    }
  }, [apiBaseUrl]);

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/invoice`);

      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }

      const data: InvoiceFromAPI[] = await response.json();
      setInvoices(groupInvoices(data));
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const deleteInvoiceByNumber = useCallback(
    async (invoiceNumber: string) => {
      const response = await fetch(
        `${apiBaseUrl}/invoice/by-number/${invoiceNumber}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error("Failed to delete invoice");
      }
      await fetchInvoices();
    },
    [apiBaseUrl, fetchInvoices],
  );

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (isActive) {
      fetchInvoices();
    }
  }, [fetchInvoices, isActive]);

  return {
    invoices,
    supplierOptions,
    isLoading,
    error,
    fetchInvoices,
    deleteInvoiceByNumber,
  };
};

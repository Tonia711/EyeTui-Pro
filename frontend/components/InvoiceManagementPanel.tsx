import { useEffect, useMemo, useState } from "react";
import { DeleteInvoiceDialog } from "./invoice-management/components/DeleteInvoiceDialog";
import { InvoiceExportButton } from "./invoice-management/components/InvoiceExportButton";
import { InvoiceFilters } from "./invoice-management/components/InvoiceFilters";
import { InvoiceTable } from "./invoice-management/components/InvoiceTable";
import { filterInvoices } from "./invoice-management/filter";
import { useInvoiceData } from "./invoice-management/hooks/useInvoiceData";
import { useInvoiceFilters } from "./invoice-management/hooks/useInvoiceFilters";
import { useSupplierMenu } from "./invoice-management/hooks/useSupplierMenu";
import { exportInvoicesToExcel } from "./invoice-management/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";
const INVOICE_PAGE_SIZE = 10;

interface InvoiceManagementPanelProps {
  isActive?: boolean;
}

export function InvoiceManagementPanel({
  isActive = false,
}: InvoiceManagementPanelProps) {
  const {
    invoices,
    supplierOptions,
    isLoading,
    error,
    deleteInvoiceByNumber,
  } = useInvoiceData({ apiBaseUrl: API_BASE_URL, isActive });

  const {
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
  } = useInvoiceFilters();

  const supplierMenu = useSupplierMenu();
  const [currentPage, setCurrentPage] = useState(1);

  const filteredInvoices = useMemo(
    () =>
      filterInvoices(invoices, {
        uploadDateFrom,
        uploadDateTo,
        selectedSupplier,
        invoiceNumberSearch,
        serialNumberSearch,
      }),
    [
      invoices,
      uploadDateFrom,
      uploadDateTo,
      selectedSupplier,
      invoiceNumberSearch,
      serialNumberSearch,
    ],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    uploadDateFrom,
    uploadDateTo,
    selectedSupplier,
    invoiceNumberSearch,
    serialNumberSearch,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredInvoices.length / INVOICE_PAGE_SIZE));
  }, [filteredInvoices.length]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * INVOICE_PAGE_SIZE;
    return filteredInvoices.slice(startIndex, startIndex + INVOICE_PAGE_SIZE);
  }, [currentPage, filteredInvoices]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

  const handleDeleteInvoice = (invoiceNumber: string) => {
    setInvoiceToDelete(invoiceNumber);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    try {
      await deleteInvoiceByNumber(invoiceToDelete);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <InvoiceFilters
        uploadDateFrom={uploadDateFrom}
        uploadDateTo={uploadDateTo}
        onUploadDateFromChange={setUploadDateFrom}
        onUploadDateToChange={setUploadDateTo}
        selectedSupplier={selectedSupplier}
        onSupplierChange={setSelectedSupplier}
        supplierOptions={supplierOptions}
        invoiceNumberSearch={invoiceNumberSearch}
        serialNumberSearch={serialNumberSearch}
        onInvoiceNumberSearchChange={setInvoiceNumberSearch}
        onSerialNumberSearchChange={setSerialNumberSearch}
        onClearFilters={clearFilters}
        supplierMenuOpen={supplierMenu.supplierMenuOpen}
        setSupplierMenuOpen={supplierMenu.setSupplierMenuOpen}
        supplierButtonRef={supplierMenu.supplierButtonRef}
        supplierMenuRect={supplierMenu.supplierMenuRect}
        setSupplierMenuRect={supplierMenu.setSupplierMenuRect}
        calculateRect={supplierMenu.calculateRect}
      />

      <InvoiceTable
        invoices={paginatedInvoices}
        isLoading={isLoading}
        error={error}
        onDelete={handleDeleteInvoice}
      />

      {filteredInvoices.length > 0 && totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(event) => {
                  event.preventDefault();
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                }}
                aria-disabled={currentPage === 1}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage(page);
                    }}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                onClick={(event) => {
                  event.preventDefault();
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                }}
                aria-disabled={currentPage === totalPages}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}

      {filteredInvoices.length > 0 && (
        <InvoiceExportButton
          onExport={() => exportInvoicesToExcel(filteredInvoices)}
        />
      )}

      <DeleteInvoiceDialog
        open={deleteDialogOpen}
        invoiceNumber={invoiceToDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setInvoiceToDelete(null);
        }}
        onConfirm={confirmDeleteInvoice}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}

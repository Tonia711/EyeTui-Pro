import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, RotateCcw, Search } from "lucide-react";

interface InvoiceFiltersProps {
  uploadDateFrom: string;
  uploadDateTo: string;
  onUploadDateFromChange: (value: string) => void;
  onUploadDateToChange: (value: string) => void;
  selectedSupplier: string;
  onSupplierChange: (supplier: string) => void;
  supplierOptions: string[];
  invoiceNumberSearch: string;
  serialNumberSearch: string;
  onInvoiceNumberSearchChange: (value: string) => void;
  onSerialNumberSearchChange: (value: string) => void;
  onClearFilters: () => void;
  supplierMenuOpen: boolean;
  setSupplierMenuOpen: (open: boolean) => void;
  supplierButtonRef: RefObject<HTMLButtonElement>;
  supplierMenuRect: { top: number; left: number; width: number } | null;
  setSupplierMenuRect: (rect: { top: number; left: number; width: number } | null) => void;
  calculateRect: (el: HTMLButtonElement | null) =>
    | { top: number; left: number; width: number }
    | null;
}

export const InvoiceFilters = ({
  uploadDateFrom,
  uploadDateTo,
  onUploadDateFromChange,
  onUploadDateToChange,
  selectedSupplier,
  onSupplierChange,
  supplierOptions,
  invoiceNumberSearch,
  serialNumberSearch,
  onInvoiceNumberSearchChange,
  onSerialNumberSearchChange,
  onClearFilters,
  supplierMenuOpen,
  setSupplierMenuOpen,
  supplierButtonRef,
  supplierMenuRect,
  setSupplierMenuRect,
  calculateRect,
}: InvoiceFiltersProps) => {
  return (
    <div className="space-y-4 mb-6 relative z-20">
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-400 text-sm font-bold">
          Find invoices by date, supplier, invoice number, or lens serial number.
        </p>
        <button
          onClick={onClearFilters}
          className="flex items-center gap-2 px-6 py-2 h-10 border-2 border-gray-400 text-gray-600 text-sm font-bold rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Clear Filters
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-gray-600 font-bold mb-1">
            Upload Date From
          </label>
          <input
            type="date"
            value={uploadDateFrom}
            onChange={(e) => onUploadDateFromChange(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 text-gray-900 font-bold text-sm focus:outline-none focus:bg-gray-200 transition-colors"
            placeholder="dd/mm/yyyy"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 font-bold mb-1">
            Upload Date To
          </label>
          <input
            type="date"
            value={uploadDateTo}
            onChange={(e) => onUploadDateToChange(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 text-gray-900 font-bold text-sm focus:outline-none focus:bg-gray-200 transition-colors"
            placeholder="dd/mm/yyyy"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 font-bold mb-1">
            Supplier
          </label>
          <div className="relative">
            <button
              ref={supplierButtonRef}
              onClick={(event) => {
                event.stopPropagation();
                setSupplierMenuRect(calculateRect(supplierButtonRef.current));
                setSupplierMenuOpen(!supplierMenuOpen);
              }}
              className="w-full px-4 py-3 bg-gray-100 text-gray-900 font-bold text-sm focus:outline-none hover:bg-gray-200 transition-colors flex items-center justify-between"
            >
              <span className="text-left truncate">{selectedSupplier}</span>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${supplierMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {supplierMenuOpen &&
              supplierMenuRect &&
              createPortal(
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="bg-white border border-gray-200 shadow-lg z-[2000] max-h-60 overflow-y-auto"
                  style={{
                    position: "fixed",
                    top: supplierMenuRect.top,
                    left: supplierMenuRect.left,
                    width: supplierMenuRect.width,
                  }}
                >
                  {supplierOptions.map((supplier) => (
                    <button
                      key={supplier}
                      onClick={() => {
                        onSupplierChange(supplier);
                        setSupplierMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left transition-colors text-sm ${
                        selectedSupplier === supplier
                          ? "bg-gray-200 text-gray-900 font-bold"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold"
                      }`}
                    >
                      {supplier}
                    </button>
                  ))}
                </div>,
                document.body,
              )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice number..."
            value={invoiceNumberSearch}
            onChange={(e) => onInvoiceNumberSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 text-gray-900 placeholder-gray-400 font-bold text-sm focus:outline-none focus:bg-gray-200 transition-colors"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by lens serial number..."
            value={serialNumberSearch}
            onChange={(e) => onSerialNumberSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 text-gray-900 placeholder-gray-400 font-bold text-sm focus:outline-none focus:bg-gray-200 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

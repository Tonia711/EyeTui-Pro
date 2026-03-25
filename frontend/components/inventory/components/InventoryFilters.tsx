import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { STATUS_OPTIONS, type StatusOption } from "../types";

interface Option {
  value: string;
  label: string;
}

interface InventoryFiltersProps {
  searchSerial: string;
  searchType: string;
  searchPower: string;
  onSearchSerialChange: (value: string) => void;
  onSearchTypeChange: (value: string) => void;
  onSearchPowerChange: (value: string) => void;
  selectedCompany: string;
  onCompanyChange: (value: string) => void;
  companyOptions: Option[];
  selectedStatuses: StatusOption[];
  statusLabel: string;
  onToggleStatus: (status: StatusOption) => void;
  selectedClinic: string;
  onClinicChange: (value: string) => void;
  clinicOptions: Option[];
  onClearFilters: () => void;
  companyMenuOpen: boolean;
  setCompanyMenuOpen: (open: boolean) => void;
  statusMenuOpen: boolean;
  setStatusMenuOpen: (open: boolean) => void;
  clinicMenuOpen: boolean;
  setClinicMenuOpen: (open: boolean) => void;
  companyButtonRef: RefObject<HTMLButtonElement>;
  statusButtonRef: RefObject<HTMLButtonElement>;
  clinicButtonRef: RefObject<HTMLButtonElement>;
  companyMenuRect: { top: number; left: number; width: number } | null;
  statusMenuRect: { top: number; left: number; width: number } | null;
  clinicMenuRect: { top: number; left: number; width: number } | null;
  setCompanyMenuRect: (rect: { top: number; left: number; width: number } | null) => void;
  setStatusMenuRect: (rect: { top: number; left: number; width: number } | null) => void;
  setClinicMenuRect: (rect: { top: number; left: number; width: number } | null) => void;
  calculateRect: (el: HTMLButtonElement | null) =>
    | { top: number; left: number; width: number }
    | null;
}

export const InventoryFilters = ({
  searchSerial,
  searchType,
  searchPower,
  onSearchSerialChange,
  onSearchTypeChange,
  onSearchPowerChange,
  selectedCompany,
  onCompanyChange,
  companyOptions,
  selectedStatuses,
  statusLabel,
  onToggleStatus,
  selectedClinic,
  onClinicChange,
  clinicOptions,
  onClearFilters,
  companyMenuOpen,
  setCompanyMenuOpen,
  statusMenuOpen,
  setStatusMenuOpen,
  clinicMenuOpen,
  setClinicMenuOpen,
  companyButtonRef,
  statusButtonRef,
  clinicButtonRef,
  companyMenuRect,
  statusMenuRect,
  clinicMenuRect,
  setCompanyMenuRect,
  setStatusMenuRect,
  setClinicMenuRect,
  calculateRect,
}: InventoryFiltersProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-400 text-sm font-bold">
          Find lens inventory by serial number, type, power, company, status and
          clinic.
        </p>
        <button
          onClick={onClearFilters}
          className="flex items-center gap-2 px-6 py-2 h-10 border-2 border-gray-400 text-gray-600 text-sm font-bold rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Clear Filters
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by serial number..."
              value={searchSerial}
              onChange={(e) => onSearchSerialChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 text-gray-900 placeholder-gray-400 font-bold text-sm focus:outline-none focus:bg-gray-200 transition-colors"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by type..."
              value={searchType}
              onChange={(e) => onSearchTypeChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 text-gray-900 placeholder-gray-400 font-bold text-sm focus:outline-none focus:bg-gray-200 transition-colors"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by power..."
              value={searchPower}
              onChange={(e) => onSearchPowerChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 text-gray-900 placeholder-gray-400 font-bold text-sm focus:outline-none focus:bg-gray-200 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Company Dropdown */}
          <div className="relative">
            <div className="relative">
              <button
                ref={companyButtonRef}
                onClick={(event) => {
                  event.stopPropagation();
                  setCompanyMenuRect(calculateRect(companyButtonRef.current));
                  setCompanyMenuOpen(!companyMenuOpen);
                }}
                className="w-full px-4 py-3 bg-gray-100 text-gray-900 font-bold text-sm focus:outline-none hover:bg-gray-200 transition-colors flex items-center justify-between"
              >
                <span className="text-left truncate">{selectedCompany}</span>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${companyMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {companyMenuOpen &&
                companyMenuRect &&
                createPortal(
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="bg-white border border-gray-200 shadow-lg z-[2000] max-h-60 overflow-y-auto"
                    style={{
                      position: "fixed",
                      top: companyMenuRect.top,
                      left: companyMenuRect.left,
                      width: companyMenuRect.width,
                    }}
                  >
                    {companyOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onCompanyChange(option.value);
                          setCompanyMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left transition-colors text-sm ${
                          selectedCompany === option.value
                            ? "bg-white text-gray-900 font-bold"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <div className="relative">
              <button
                ref={statusButtonRef}
                onClick={(event) => {
                  event.stopPropagation();
                  setStatusMenuRect(calculateRect(statusButtonRef.current));
                  setStatusMenuOpen(!statusMenuOpen);
                }}
                className="w-full px-4 py-3 bg-gray-100 text-gray-900 font-bold text-sm focus:outline-none hover:bg-gray-200 transition-colors flex items-center justify-between"
              >
                <span className="text-left truncate">{statusLabel}</span>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${statusMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {statusMenuOpen &&
                statusMenuRect &&
                createPortal(
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="bg-white border border-gray-200 shadow-lg z-[2000]"
                    style={{
                      position: "fixed",
                      top: statusMenuRect.top,
                      left: statusMenuRect.left,
                      width: statusMenuRect.width,
                    }}
                  >
                    {STATUS_OPTIONS.map((status) => {
                      const checked = selectedStatuses.includes(status);
                      return (
                        <label
                          key={status}
                          className="flex items-center px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleStatus(status)}
                            className="mr-3 w-4 h-4 accent-gray-900"
                          />
                          <span className="text-sm text-gray-600 font-bold">
                            {status}
                          </span>
                        </label>
                      );
                    })}
                  </div>,
                  document.body,
                )}
            </div>
          </div>

          {/* Clinic Dropdown */}
          <div className="relative">
            <div className="relative">
              <button
                ref={clinicButtonRef}
                onClick={(event) => {
                  event.stopPropagation();
                  setClinicMenuRect(calculateRect(clinicButtonRef.current));
                  setClinicMenuOpen(!clinicMenuOpen);
                }}
                className="w-full px-4 py-3 bg-gray-100 text-gray-900 font-bold text-sm focus:outline-none hover:bg-gray-200 transition-colors flex items-center justify-between"
              >
                <span className="text-left truncate">{selectedClinic}</span>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${clinicMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {clinicMenuOpen &&
                clinicMenuRect &&
                createPortal(
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="bg-white border border-gray-200 shadow-lg z-[2000] max-h-60 overflow-y-auto"
                    style={{
                      position: "fixed",
                      top: clinicMenuRect.top,
                      left: clinicMenuRect.left,
                      width: clinicMenuRect.width,
                    }}
                  >
                    {clinicOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onClinicChange(option.value);
                          setClinicMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left transition-colors text-sm ${
                          selectedClinic === option.value
                            ? "bg-white text-gray-900 font-bold"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

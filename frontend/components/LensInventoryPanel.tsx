import { useEffect, useMemo, useState } from "react";
import { type ComboboxOption } from "./ui/combobox";
import { InventoryFilters } from "./inventory/components/InventoryFilters";
import { DeleteLensDialog } from "./inventory/components/DeleteLensDialog";
import { InventoryTable } from "./inventory/components/InventoryTable";
import { MoveClinicDialog } from "./inventory/components/MoveClinicDialog";
import { filterLensData } from "./inventory/filter";
import { useInventoryData } from "./inventory/hooks/useInventoryData";
import { useInventoryFilters } from "./inventory/hooks/useInventoryFilters";
import { useInventoryMenus } from "./inventory/hooks/useInventoryMenus";
import { formatDate } from "./inventory/utils";
import { type LensData } from "./inventory/types";
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
const REFERENCE_DATA_CHANGED_EVENT = "eyetui:reference-data-changed";
const INVENTORY_PAGE_SIZE = 10;

interface LensInventoryPanelProps {
  selectedClinic: string;
  onClinicChange: (clinic: string) => void;
  refreshKey?: number;
  isActive?: boolean;
}

export function LensInventoryPanel({
  selectedClinic,
  onClinicChange,
  refreshKey,
  isActive,
}: LensInventoryPanelProps) {
  const {
    lensData,
    companies,
    sites,
    loading,
    moveLensToClinic,
    deleteLens,
  } = useInventoryData({
    apiBaseUrl: API_BASE_URL,
    referenceDataEvent: REFERENCE_DATA_CHANGED_EVENT,
    isActive,
    refreshKey,
  });

  const {
    searchSerial,
    setSearchSerial,
    searchType,
    setSearchType,
    searchPower,
    setSearchPower,
    selectedCompany,
    setSelectedCompany,
    selectedStatuses,
    toggleStatus,
    statusLabel,
    clearFilters,
  } = useInventoryFilters(onClinicChange);

  const menus = useInventoryMenus();

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    lensId: number;
    serialNumber: string;
    fromClinic: string;
    toClinic: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    lensId: number;
    serialNumber: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const companyOptions: { value: string; label: string }[] = useMemo(() => {
    const names = [...companies].map((company) => company.name);
    names.sort((a, b) => a.localeCompare(b));
    return ["All Companies", ...names].map((company) => ({
      value: company,
      label: company,
    }));
  }, [companies]);

  const clinicOptions: { value: string; label: string }[] = useMemo(() => {
    const names = [...sites].map((site) => site.name);
    names.sort((a, b) => a.localeCompare(b));
    return ["All Clinics", ...names].map((clinic) => ({
      value: clinic,
      label: clinic,
    }));
  }, [sites]);

  const clinicComboboxOptions: ComboboxOption[] = useMemo(() => {
    return [...sites]
      .map((site) => site.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [sites]);

  const filteredData = useMemo(
    () =>
      filterLensData(lensData, {
        searchSerial,
        searchType,
        searchPower,
        selectedCompany,
        selectedStatuses,
        selectedClinic,
      }),
    [
      lensData,
      searchSerial,
      searchType,
      searchPower,
      selectedCompany,
      selectedStatuses,
      selectedClinic,
    ],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchSerial,
    searchType,
    searchPower,
    selectedCompany,
    selectedStatuses,
    selectedClinic,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredData.length / INVENTORY_PAGE_SIZE));
  }, [filteredData.length]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * INVENTORY_PAGE_SIZE;
    return filteredData.slice(startIndex, startIndex + INVENTORY_PAGE_SIZE);
  }, [currentPage, filteredData]);

  const handleDeleteLens = (lens: LensData) => {
    setPendingDelete({ lensId: lens.id, serialNumber: lens.serial_number });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteLens = async () => {
    if (!pendingDelete) return;
    await deleteLens(pendingDelete.lensId);
    setDeleteDialogOpen(false);
    setPendingDelete(null);
  };

  const handleRequestMoveClinic = (lens: LensData, nextClinic: string) => {
    setPendingMove({
      lensId: lens.id,
      serialNumber: lens.serial_number,
      fromClinic: lens.site || "-",
      toClinic: nextClinic,
    });
    setMoveDialogOpen(true);
  };

  const confirmMoveClinic = async () => {
    if (!pendingMove) return;
    await moveLensToClinic(pendingMove.lensId, pendingMove.toClinic);
    setMoveDialogOpen(false);
    setPendingMove(null);
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-400 text-lg">Loading inventory...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <InventoryFilters
            searchSerial={searchSerial}
            searchType={searchType}
            searchPower={searchPower}
            onSearchSerialChange={setSearchSerial}
            onSearchTypeChange={setSearchType}
            onSearchPowerChange={setSearchPower}
            selectedCompany={selectedCompany}
            onCompanyChange={setSelectedCompany}
            companyOptions={companyOptions}
            selectedStatuses={selectedStatuses}
            statusLabel={statusLabel}
            onToggleStatus={toggleStatus}
            selectedClinic={selectedClinic}
            onClinicChange={onClinicChange}
            clinicOptions={clinicOptions}
            onClearFilters={clearFilters}
            companyMenuOpen={menus.companyMenuOpen}
            setCompanyMenuOpen={menus.setCompanyMenuOpen}
            statusMenuOpen={menus.statusMenuOpen}
            setStatusMenuOpen={menus.setStatusMenuOpen}
            clinicMenuOpen={menus.clinicMenuOpen}
            setClinicMenuOpen={menus.setClinicMenuOpen}
            companyButtonRef={menus.companyButtonRef}
            statusButtonRef={menus.statusButtonRef}
            clinicButtonRef={menus.clinicButtonRef}
            companyMenuRect={menus.companyMenuRect}
            statusMenuRect={menus.statusMenuRect}
            clinicMenuRect={menus.clinicMenuRect}
            setCompanyMenuRect={menus.setCompanyMenuRect}
            setStatusMenuRect={menus.setStatusMenuRect}
            setClinicMenuRect={menus.setClinicMenuRect}
            calculateRect={menus.calculateRect}
          />

          <InventoryTable
            data={paginatedData}
            clinicComboboxOptions={clinicComboboxOptions}
            formatDate={formatDate}
            onRequestMoveClinic={handleRequestMoveClinic}
            onDelete={handleDeleteLens}
          />

          {filteredData.length > 0 && totalPages > 1 ? (
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
        </div>
      )}

      <MoveClinicDialog
        open={moveDialogOpen}
        serialNumber={pendingMove?.serialNumber ?? null}
        fromClinic={pendingMove?.fromClinic ?? null}
        toClinic={pendingMove?.toClinic ?? null}
        onCancel={() => {
          setMoveDialogOpen(false);
          setPendingMove(null);
        }}
        onConfirm={confirmMoveClinic}
        onOpenChange={setMoveDialogOpen}
      />
      <DeleteLensDialog
        open={deleteDialogOpen}
        serialNumber={pendingDelete?.serialNumber ?? null}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setPendingDelete(null);
        }}
        onConfirm={confirmDeleteLens}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}

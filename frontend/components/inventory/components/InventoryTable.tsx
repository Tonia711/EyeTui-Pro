import { X } from "lucide-react";
import { Combobox, type ComboboxOption } from "../../ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { type LensData } from "../types";

interface InventoryTableProps {
  data: LensData[];
  clinicComboboxOptions: ComboboxOption[];
  formatDate: (dateString?: string | null) => string;
  onRequestMoveClinic: (lens: LensData, newClinic: string) => void;
  onDelete: (lens: LensData) => void;
}

export const InventoryTable = ({
  data,
  clinicComboboxOptions,
  formatDate,
  onRequestMoveClinic,
  onDelete,
}: InventoryTableProps) => {
  return (
    <div className="border border-gray-200 bg-white">
      <Table className="table-auto w-full">
        <TableHeader>
          <TableRow className="border-b-2 border-gray-900">
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Serial Number
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Type
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Company
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Power
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Received
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Status
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Used
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Clinic
            </TableHead>
            <TableHead className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6">
              Move From
            </TableHead>
            <TableHead
              className="text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 text-right"
              style={{ minWidth: "60px" }}
            ></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((lens) => (
              <TableRow
                key={lens.id}
                className="hover:bg-gray-50 border-b border-gray-100 group"
              >
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4 whitespace-normal break-words"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  {lens.serial_number}
                </TableCell>
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4 whitespace-normal break-words"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  {lens.type || "-"}
                </TableCell>
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4 whitespace-normal break-words"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  {lens.company || "-"}
                </TableCell>
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4 truncate"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  {lens.power || "-"}
                </TableCell>
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4 truncate"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  {formatDate(lens.received_date)}
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div>
                    {lens.is_matched ? (
                      <span
                        className="text-sm font-bold"
                        style={{
                          fontFamily: "Jost, sans-serif",
                          color: "#692c86",
                        }}
                      >
                        Invoiced
                      </span>
                    ) : lens.is_used ? (
                      <span
                        className="text-gray-600 text-sm font-bold"
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        Used
                      </span>
                    ) : (
                      <span
                        className="text-[#0dcaf0] text-sm font-bold"
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        In Stock
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4 truncate"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  {lens.is_used ? formatDate(lens.used_date) : "-"}
                </TableCell>
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  <div style={{ overflow: "visible" }}>
                    <Combobox
                      options={clinicComboboxOptions}
                      value={lens.site || ""}
                      onValueChange={(value) => {
                        const current = (lens.site || "").trim();
                        const next = value.trim();
                        if (!next || next === current) return;
                        if (
                          !clinicComboboxOptions.some(
                            (opt) => opt.value === next,
                          )
                        ) {
                          return;
                        }
                        onRequestMoveClinic(lens, next);
                      }}
                      placeholder="Select clinic..."
                      emptyText="No clinic found."
                      className="w-full"
                      hideBorder={true}
                      disabled={lens.is_matched}
                      selectionOnly={true}
                      disableFilter={true}
                      readOnly={true}
                      usePortal={true}
                      portalZIndex={20000}
                    />
                  </div>
                </TableCell>
                <TableCell
                  className="text-gray-600 text-sm font-bold px-6 py-4 truncate"
                  style={{ fontFamily: "Jost, sans-serif" }}
                >
                  {lens.move_from_clinic || "-"}
                </TableCell>
                <TableCell
                  className="px-6 py-4 text-right"
                  style={{
                    overflow: "visible",
                    position: "relative",
                    minWidth: "60px",
                  }}
                >
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(lens);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded cursor-pointer inline-flex items-center justify-center"
                      title="Delete this lens"
                    >
                      <X className="h-4 w-4 text-black" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={10}
                className="py-12 text-center text-gray-400"
              >
                No results found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

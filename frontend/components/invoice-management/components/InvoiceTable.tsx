import { X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { type InvoiceRecord } from "../types";

interface InvoiceTableProps {
  invoices: InvoiceRecord[];
  isLoading: boolean;
  error: string | null;
  onDelete: (invoiceNumber: string) => void;
}

export const InvoiceTable = ({
  invoices,
  isLoading,
  error,
  onDelete,
}: InvoiceTableProps) => {
  return (
    <div className="border border-gray-200 bg-white overflow-hidden">
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading invoices...</div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : (
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="border-b-2 border-gray-900 hover:bg-transparent">
              <TableHead className="w-[11%] min-w-0 text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 align-top whitespace-normal">
                Upload Date
              </TableHead>
              <TableHead className="w-[16%] min-w-0 text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 align-top whitespace-normal">
                Supplier
              </TableHead>
              <TableHead className="w-[20%] min-w-0 text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 align-top whitespace-normal">
                Invoice Number
              </TableHead>
              <TableHead className="w-[49%] min-w-0 text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 px-6 align-top whitespace-normal">
                Lens Serial Numbers
              </TableHead>
              <TableHead className="w-[4%] min-w-0 text-black text-xs uppercase tracking-wider font-semibold h-auto pt-4 pb-3 pr-6 text-right align-top"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length > 0 ? (
              invoices.map((invoice, index) => (
                <TableRow
                  key={index}
                  className="hover:bg-gray-50 border-b border-gray-100 group"
                >
                  <TableCell
                    className="text-gray-600 text-sm font-bold px-6 py-4 min-w-0 align-top whitespace-normal break-words"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    {invoice.uploadDate}
                  </TableCell>
                  <TableCell
                    className="text-gray-600 text-sm font-bold px-6 py-4 min-w-0 align-top whitespace-normal break-words"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    {invoice.supplier}
                  </TableCell>
                  <TableCell
                    className="text-gray-600 text-sm font-bold px-6 py-4 min-w-0 align-top whitespace-normal break-all"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell
                    className="px-6 py-4 min-w-0 align-top text-sm whitespace-normal break-all [overflow-wrap:anywhere]"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    <div className="leading-relaxed">
                      {invoice.serialNumbers.map((item, idx) => (
                        <span
                          key={idx}
                          className="font-bold break-all [overflow-wrap:anywhere]"
                          style={{
                            color:
                              item.isMatched === true ? "#4B5563" : "#DC2626",
                          }}
                        >
                          {item.sn}
                          {idx < invoice.serialNumbers.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 py-4 text-right align-top whitespace-nowrap">
                    <button
                      onClick={() => {
                        onDelete(invoice.invoiceNumber);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full"
                      aria-label="Delete invoice"
                    >
                      <X className="h-5 w-5 text-gray-400 hover:text-red-600 transition-colors" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-gray-400">
                  No results found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

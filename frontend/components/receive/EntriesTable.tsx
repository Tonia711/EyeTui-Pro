import { X } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { Combobox, type ComboboxOption } from "../ui/combobox";
import { type EditingField, type SerialNumberEntry } from "./types";

interface EntriesTableProps {
  entries: SerialNumberEntry[];
  editingId: string | null;
  editingField: EditingField;
  duplicateSNs: string[];
  serverDuplicates: string[];
  companyOptions: ComboboxOption[];
  typeOptions: ComboboxOption[];
  companyTypeMap: Record<string, ComboboxOption[]>;
  typeToCompanyMap: Record<string, string>;
  powerOptions: ComboboxOption[];
  updateSerialNumber: (
    id: string,
    field: "sn" | "date" | "company" | "type" | "power",
    value: string,
  ) => void;
  startEditing: (
    id: string,
    field: "sn" | "date" | "company" | "type" | "power",
  ) => void;
  stopEditing: () => void;
  deleteSerialNumber: (id: string) => void;
  setEntries: Dispatch<SetStateAction<SerialNumberEntry[]>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
  uploading: boolean;
  excelFilesCount: number;
}

export function EntriesTable({
  entries,
  editingId,
  editingField,
  duplicateSNs,
  serverDuplicates,
  companyOptions,
  typeOptions,
  companyTypeMap,
  typeToCompanyMap,
  powerOptions,
  updateSerialNumber,
  startEditing,
  stopEditing,
  deleteSerialNumber,
  setEntries,
  setErrorMessage,
  onCancel,
  onSubmit,
  uploading,
  excelFilesCount,
}: EntriesTableProps) {
  if (!entries.length || serverDuplicates.length > 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="border border-gray-200 bg-white overflow-visible">
        <table className="min-w-full">
          <thead className="bg-white border-b-2 border-gray-900">
            <tr>
              <th
                className="text-black text-sm uppercase tracking-wider font-semibold h-auto py-4 px-6 w-16 text-left"
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                #
              </th>
              <th
                className="text-black text-sm uppercase tracking-wider font-semibold h-auto py-4 px-6 text-left"
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                Serial Number
              </th>
              <th
                className="text-black text-sm uppercase tracking-wider font-semibold h-auto py-4 px-6 text-left"
                style={{ width: "210px", fontFamily: "Jost, sans-serif" }}
              >
                Type
              </th>
              <th
                className="text-black text-sm uppercase tracking-wider font-semibold h-auto py-4 px-6 text-left"
                style={{ width: "210px", fontFamily: "Jost, sans-serif" }}
              >
                Company
              </th>
              <th
                className="text-black text-sm uppercase tracking-wider font-semibold h-auto py-4 px-6 text-left"
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                Power
              </th>
              <th
                className="text-black text-sm uppercase tracking-wider font-semibold h-auto py-4 px-6 w-48 text-left"
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                Received Date
              </th>
              <th
                className="text-black text-sm uppercase tracking-wider font-semibold h-auto py-4 px-6 w-16 text-left"
                style={{ fontFamily: "Jost, sans-serif" }}
              ></th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-100">
            {entries.map((item, index) => {
              const isEditing = editingId === item.id;
              const isDuplicate =
                duplicateSNs.includes(item.sn) || serverDuplicates.includes(item.sn);
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(
                now.getMonth() + 1,
              ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
              const isFutureDate =
                item.date &&
                item.date.trim() &&
                /^\d{4}-\d{2}-\d{2}$/.test(item.date.trim()) &&
                item.date.trim() > todayStr;
              const formattedDate = item.date
                ? new Date(item.date + "T00:00:00").toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "Not set";

              return (
                <tr
                  key={item.id}
                  className={`transition-colors group border-b border-gray-100 ${
                    isEditing ? "bg-[#0dcaf0]/10" : "hover:bg-gray-50"
                  }`}
                >
                  <td
                    className="text-gray-600 text-sm font-bold px-6 py-4"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    {index + 1}
                  </td>

                  <td
                    className="text-gray-600 text-sm font-bold px-6 py-4 cursor-pointer"
                    style={{ fontFamily: "Jost, sans-serif" }}
                    onClick={() => startEditing(item.id, "sn")}
                  >
                    {isEditing && editingField === "sn" ? (
                      <input
                        type="text"
                        defaultValue={item.sn}
                        onBlur={(e) => {
                          updateSerialNumber(item.id, "sn", e.target.value);
                          stopEditing();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateSerialNumber(item.id, "sn", e.currentTarget.value);
                            stopEditing();
                          } else if (e.key === "Escape") {
                            stopEditing();
                          }
                        }}
                        className="w-full h-5 px-0 py-0 border-b-2 border-[#0dcaf0] outline-none focus:border-[#0bb8d9] bg-transparent text-gray-600 text-sm leading-5"
                        style={{ fontFamily: "Jost, sans-serif" }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`transition-colors ${
                          isDuplicate ? "text-red-600 font-bold" : "hover:text-[#0dcaf0]"
                        }`}
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        {item.sn}
                      </span>
                    )}
                  </td>

                  <td
                    className="text-gray-600 text-sm font-bold px-6 py-4"
                    style={{ width: "210px", fontFamily: "Jost, sans-serif" }}
                    onClick={() => startEditing(item.id, "type")}
                  >
                    {isEditing && editingField === "type" ? (
                      <div
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            stopEditing();
                          }
                        }}
                      >
                        <Combobox
                          options={
                            item.company && companyTypeMap[item.company]
                              ? companyTypeMap[item.company]
                              : typeOptions
                          }
                          value={item.type || ""}
                          showClearButton={true}
                          onValueChange={(value) => {
                            setEntries((prev) => {
                              return prev.map((entry) => {
                                if (entry.id === item.id) {
                                  const updated = {
                                    ...entry,
                                    type: value,
                                  };

                                  if (!value || value.trim() === "") {
                                    updated.company = "";
                                    return updated;
                                  }

                                  if (value && (!entry.company || entry.company.trim() === "")) {
                                    const mappedCompany = typeToCompanyMap[value];
                                    if (mappedCompany) {
                                      console.log(
                                        `[AUTO-SELECT] Type "${value}" -> Company "${mappedCompany}"`,
                                      );
                                      updated.company = mappedCompany;
                                    } else {
                                      console.log(
                                        `[AUTO-SELECT] No mapping found for type "${value}"`,
                                      );
                                    }
                                  }

                                  return updated;
                                }
                                return entry;
                              });
                            });
                          }}
                          placeholder="Type or select type..."
                          searchPlaceholder="Search type..."
                          emptyText={
                            item.company ? "No type found for this company." : "No type found."
                          }
                          className="w-full"
                          inputClassName="text-gray-600"
                        />
                      </div>
                    ) : (
                      <span
                        className="hover:text-[#0dcaf0] transition-colors cursor-pointer"
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        {item.type || "-"}
                      </span>
                    )}
                  </td>

                  <td
                    className="text-gray-600 text-sm font-bold px-6 py-4"
                    style={{ width: "210px", fontFamily: "Jost, sans-serif" }}
                    onClick={() => startEditing(item.id, "company")}
                  >
                    {isEditing && editingField === "company" ? (
                      <div
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            stopEditing();
                          }
                        }}
                      >
                        <Combobox
                          options={companyOptions}
                          value={item.company || ""}
                          showClearButton={true}
                          onValueChange={(value) => {
                            updateSerialNumber(item.id, "company", value);
                            if (value && item.type) {
                              const validTypes = companyTypeMap[value] || [];
                              const isValidType = validTypes.some((t) => t.value === item.type);
                              if (!isValidType) {
                                updateSerialNumber(item.id, "type", "");
                              }
                            } else if (!value) {
                              updateSerialNumber(item.id, "type", "");
                            }
                          }}
                          placeholder="Type or select company..."
                          searchPlaceholder="Search company..."
                          emptyText="No company found."
                          className="w-full"
                          inputClassName="text-gray-600"
                        />
                      </div>
                    ) : (
                      <span
                        className="inline-block hover:text-[#0dcaf0] transition-colors cursor-pointer"
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        {item.company || "-"}
                      </span>
                    )}
                  </td>

                  <td
                    className="text-gray-600 text-sm font-bold px-6 py-4"
                    style={{ width: "210px", fontFamily: "Jost, sans-serif" }}
                    onClick={() => startEditing(item.id, "power")}
                  >
                    {isEditing && editingField === "power" ? (
                      <div
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            stopEditing();
                          }
                        }}
                      >
                        <Combobox
                          options={powerOptions}
                          value={item.power || ""}
                          showClearButton={true}
                          onValueChange={(value) => {
                            updateSerialNumber(item.id, "power", value);
                          }}
                          placeholder="Type or select power..."
                          searchPlaceholder="Search power..."
                          emptyText="No power found."
                          className="w-full"
                          inputClassName="text-gray-600"
                        />
                      </div>
                    ) : (
                      <span
                        className="inline-block hover:text-[#0dcaf0] transition-colors cursor-pointer"
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        {item.power || "-"}
                      </span>
                    )}
                  </td>

                  <td
                    className="text-gray-600 text-sm font-bold px-6 py-4 cursor-pointer"
                    style={{ fontFamily: "Jost, sans-serif" }}
                    onClick={() => startEditing(item.id, "date")}
                  >
                    {isEditing && editingField === "date" ? (
                      <input
                        type="text"
                        defaultValue={
                          item.date
                            ? new Date(item.date + "T00:00:00").toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : ""
                        }
                        placeholder="DD/MM/YYYY"
                        onBlur={(e) => {
                          const parts = e.target.value.split("/");
                          if (parts.length === 3) {
                            const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                            if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
                              setErrorMessage("");
                              updateSerialNumber(item.id, "date", isoDate);
                              stopEditing();
                            } else {
                              setErrorMessage(
                                "Invalid date format. Please use DD/MM/YYYY.",
                              );
                            }
                          } else {
                            stopEditing();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const parts = e.currentTarget.value.split("/");
                            if (parts.length === 3) {
                              const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                              if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
                                setErrorMessage("");
                                updateSerialNumber(item.id, "date", isoDate);
                                stopEditing();
                              } else {
                                setErrorMessage(
                                  "Invalid date format. Please use DD/MM/YYYY.",
                                );
                              }
                            } else {
                              stopEditing();
                            }
                          } else if (e.key === "Escape") {
                            stopEditing();
                          }
                        }}
                        className="w-full h-5 px-0 py-0 border-b-2 border-[#0dcaf0] outline-none focus:border-[#0bb8d9] bg-transparent text-gray-600 text-sm leading-5"
                        style={{ fontFamily: "Jost, sans-serif" }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`inline-block transition-colors ${
                          isFutureDate ? "text-gray-600 font-bold" : "hover:text-[#0dcaf0]"
                        }`}
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        {formattedDate}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => deleteSerialNumber(item.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={!uploading && entries.length === 0 && excelFilesCount === 0}
          className="px-6 py-2 h-10 bg-white text-gray-600 border-2 border-gray-400 rounded-full hover:bg-gray-100 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed text-sm font-bold"
          style={{ fontFamily: "Jost, sans-serif" }}
        >
          {uploading ? "Cancel" : "Clear"}
        </button>

        <button
          onClick={onSubmit}
          disabled={uploading}
          className="px-6 py-2 h-10 bg-[#0dcaf0] text-white border-2 border-[#0dcaf0] rounded-full hover:bg-[#0bb8d9] hover:border-[#0bb8d9] transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed text-sm font-bold"
          style={{ fontFamily: "Jost, sans-serif" }}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

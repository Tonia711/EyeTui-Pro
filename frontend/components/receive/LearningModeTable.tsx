import { X } from "lucide-react";
import { Fragment, type Dispatch, type SetStateAction } from "react";
import { Combobox, type ComboboxOption } from "../ui/combobox";
import { type EditingField, type SerialNumberEntry } from "./types";

interface LearningModeTableProps {
  entries: SerialNumberEntry[];
  showStudyMode: boolean;
  patternSaved: boolean;
  isLearning: boolean;
  uploading: boolean;
  selectedSite: string;
  companyOptions: ComboboxOption[];
  typeOptions: ComboboxOption[];
  companyTypeMap: Record<string, ComboboxOption[]>;
  typeToCompanyMap: Record<string, string>;
  powerOptions: ComboboxOption[];
  editingId: string | null;
  editingField: EditingField;
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
  handleClearLearningEntries: () => void;
  handleSavePattern: () => void | Promise<void>;
  handleUploadLearningMode: () => void | Promise<void>;
  learnSuccess: boolean;
  outerClassName?: string;
}

export function LearningModeTable({
  entries,
  showStudyMode,
  patternSaved,
  isLearning,
  uploading,
  selectedSite,
  companyOptions,
  typeOptions,
  companyTypeMap,
  typeToCompanyMap,
  powerOptions,
  editingId,
  editingField,
  updateSerialNumber,
  startEditing,
  stopEditing,
  deleteSerialNumber,
  setEntries,
  setErrorMessage,
  handleClearLearningEntries,
  handleSavePattern,
  handleUploadLearningMode,
  learnSuccess,
  outerClassName = "mt-4 space-y-4",
}: LearningModeTableProps) {
  const learningEntries = entries.filter((e) => e.originalBarcode);
  if (!showStudyMode || learningEntries.length === 0) return null;

  return (
    <div className={outerClassName}>
      <div className="border border-gray-200 bg-white overflow-visible">
        <table className="min-w-full" style={{ tableLayout: "fixed" }}>
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
                style={{ width: "25%", fontFamily: "Jost, sans-serif" }}
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
                style={{ width: "15%", fontFamily: "Jost, sans-serif" }}
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
            {learningEntries.map((item, index) => {
              const formattedDate = item.date
                ? new Date(item.date + "T00:00:00").toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "Not set";

              return (
                <Fragment key={item.id}>
                  {!patternSaved && (
                    <tr key={`${item.id}-barcode`} className="bg-white">
                      <td
                        colSpan={7}
                        className="px-6 py-2 text-base text-gray-600 font-semibold"
                        style={{ fontFamily: "Jost, sans-serif" }}
                      >
                        Original Barcode: {item.originalBarcode}
                      </td>
                    </tr>
                  )}
                  <tr
                    key={item.id}
                    className={`transition-colors group border-b border-gray-100 ${
                      editingId === item.id ? "bg-[#0dcaf0]/10" : "hover:bg-gray-50"
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
                      style={{ fontFamily: "Jost, sans-serif", width: "25%" }}
                      onClick={() => startEditing(item.id, "sn")}
                    >
                      {editingId === item.id && editingField === "sn" ? (
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
                          style={{
                            fontFamily: "Jost, sans-serif",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="block transition-colors hover:text-[#0dcaf0]"
                          style={{ fontFamily: "Jost, sans-serif", wordBreak: "break-word" }}
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
                      {editingId === item.id && editingField === "type" ? (
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
                                        updated.company = mappedCompany;
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
                          className="block hover:text-[#0dcaf0] transition-colors cursor-pointer"
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
                      {editingId === item.id && editingField === "company" ? (
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
                          className="block hover:text-[#0dcaf0] transition-colors cursor-pointer"
                          style={{ fontFamily: "Jost, sans-serif" }}
                        >
                          {item.company || "-"}
                        </span>
                      )}
                    </td>
                    <td
                      className="text-gray-600 text-sm font-bold px-6 py-4 cursor-pointer"
                      style={{ fontFamily: "Jost, sans-serif", width: "15%" }}
                      onClick={() => startEditing(item.id, "power")}
                    >
                      {editingId === item.id && editingField === "power" ? (
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
                          className="block hover:text-[#0dcaf0] transition-colors cursor-pointer"
                          style={{ fontFamily: "Jost, sans-serif", wordBreak: "break-word" }}
                        >
                          {item.power || "-"}
                        </span>
                      )}
                    </td>
                    <td
                      className="text-gray-600 text-sm font-bold px-6 py-4"
                      style={{ fontFamily: "Jost, sans-serif" }}
                    >
                      {formattedDate}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => deleteSerialNumber(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete entry"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3">
        {!patternSaved ? (
          <>
            <button
              onClick={handleClearLearningEntries}
              className="px-6 py-2 h-10 bg-white text-gray-600 border-2 border-gray-400 rounded-full hover:bg-gray-50 transition-colors text-sm font-bold"
              style={{ fontFamily: "Jost, sans-serif" }}
            >
              Clear
            </button>
            <button
              onClick={handleSavePattern}
              disabled={isLearning || learningEntries.length === 0}
              className="px-6 py-2 h-10 bg-[#0dcaf0] text-white border-2 border-[#0dcaf0] rounded-full hover:bg-[#0bb8d9] hover:border-[#0bb8d9] transition-colors text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
              style={{ fontFamily: "Jost, sans-serif" }}
            >
              {isLearning ? "Saving..." : "Save Pattern"}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleClearLearningEntries}
              className="px-6 py-2 h-10 bg-white text-gray-600 border-2 border-gray-400 rounded-full hover:bg-gray-50 transition-colors text-sm font-bold"
              style={{ fontFamily: "Jost, sans-serif" }}
            >
              Clear
            </button>
            <button
              onClick={handleUploadLearningMode}
              disabled={uploading || learningEntries.length === 0 || !selectedSite}
              className="px-6 py-2 h-10 bg-[#0dcaf0] text-white border-2 border-[#0dcaf0] rounded-full hover:bg-[#0bb8d9] hover:border-[#0bb8d9] transition-colors text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
              style={{ fontFamily: "Jost, sans-serif" }}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </>
        )}
      </div>

      {learnSuccess && (
        <div className="px-3 py-2 bg-green-50 border border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-sm font-medium">
              ✓ Pattern learned successfully!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

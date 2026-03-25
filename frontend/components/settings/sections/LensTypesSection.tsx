import { useEffect, useState } from "react";
import { Check, ChevronDown, Edit2, Plus, X } from "lucide-react";
import { Combobox, type ComboboxOption } from "../../ui/combobox";
import { AccordionContent, AccordionItem } from "../../ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { DeleteLensTypeDialog } from "../components/DeleteLensTypeDialog";
import type { EditingType, LensTypeRow } from "../types";

interface LensTypesSectionProps {
  types: LensTypeRow[];
  companyOptionsById: ComboboxOption[];
  isOpen: boolean;
  ensureOpen: () => void;
  onCreate: (name: string, companyId: string) => Promise<void> | void;
  onUpdate: (id: number, name: string, companyId: string) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
}

export function LensTypesSection({
  types,
  companyOptionsById,
  isOpen,
  ensureOpen,
  onCreate,
  onUpdate,
  onDelete,
}: LensTypesSectionProps) {
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeCompany, setNewTypeCompany] = useState("");
  const [showNewType, setShowNewType] = useState(false);
  const [editingType, setEditingType] = useState<EditingType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<LensTypeRow | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowNewType(false);
      setEditingType(null);
      setNewTypeName("");
      setNewTypeCompany("");
    }
  }, [isOpen]);

  const handleSaveNew = async () => {
    await onCreate(newTypeName, newTypeCompany);
    setNewTypeName("");
    setNewTypeCompany("");
    setShowNewType(false);
  };

  const handleUpdate = async () => {
    if (!editingType) return;
    await onUpdate(editingType.id, editingType.name, editingType.companyId);
    setEditingType(null);
  };

  const handleRequestDelete = (type: LensTypeRow) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!typeToDelete) return;
    await onDelete(typeToDelete.id);
    setDeleteDialogOpen(false);
    setTypeToDelete(null);
  };

  return (
    <AccordionItem
      value="lens-types"
      className="border border-gray-200 bg-white"
    >
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-4 px-6 py-4 text-left outline-none transition-all hover:bg-gray-50 [&[data-state=open]>svg]:rotate-180">
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-600 transition-transform duration-200" />
          <div className="flex items-center justify-between w-full">
            <h3
              className="text-2xl font-black text-gray-900"
              style={{ fontFamily: "Jost, sans-serif" }}
            >
              Lens Types
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNewType(true);
                ensureOpen();
              }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-gray-400 px-6 py-2 h-10 text-sm font-bold text-gray-600 transition-colors hover:border-[#0dcaf0] hover:bg-[#0dcaf0] hover:text-white w-52 justify-center"
            >
              <Plus className="h-4 w-4" />
              Add Lens Type
            </button>
          </div>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionContent>
        <div className="border-t border-gray-200">
          <div className="px-6 pt-4">
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 pb-3 border-b-2 border-gray-900 text-xs uppercase tracking-wider font-semibold text-black">
              <p></p>
              <p>Lens Type</p>
              <p>Company</p>
              <p className="w-20"></p>
            </div>
          </div>
          <div>
            {showNewType && (
              <div className="px-6 bg-blue-50 border-b border-gray-100">
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 items-center py-4">
                  <div className="w-6"></div>
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSaveNew();
                      if (event.key === "Escape") {
                        setNewTypeName("");
                        setNewTypeCompany("");
                        setShowNewType(false);
                      }
                    }}
                    placeholder="Enter lens type name"
                    className="px-2 py-1 border-2 border-[#0dcaf0] outline-none focus:border-[#0bb8d9] bg-white text-gray-900 text-sm font-bold"
                    style={{ fontFamily: "Jost, sans-serif" }}
                    autoFocus
                  />
                  <Combobox
                    options={companyOptionsById}
                    value={newTypeCompany}
                    showClearButton={true}
                    onValueChange={setNewTypeCompany}
                    placeholder="Select company..."
                    searchPlaceholder="Search company..."
                    emptyText="No company found."
                  />
                  <div className="flex items-center gap-2 w-20">
                    <button
                      onClick={handleSaveNew}
                      className="text-[#0dcaf0] hover:text-[#0bb8d9] transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setNewTypeName("");
                        setNewTypeCompany("");
                        setShowNewType(false);
                      }}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {types.map((lensType, index) => (
              <div
                key={lensType.id}
                className="px-6 transition-colors hover:bg-gray-50 group"
              >
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 items-center py-4 border-b border-gray-100">
                  <p
                    className="text-gray-600 text-sm font-bold"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    {index + 1}
                  </p>
                  {editingType?.id === lensType.id ? (
                    <input
                      type="text"
                      value={editingType.name}
                      onChange={(e) =>
                        setEditingType({
                          ...editingType,
                          name: e.target.value,
                        })
                      }
                      className="px-2 py-1 border-2 border-[#0dcaf0] outline-none focus:border-[#0bb8d9] bg-white text-gray-900 text-sm font-bold"
                      style={{ fontFamily: "Jost, sans-serif" }}
                      autoFocus
                    />
                  ) : (
                    <p
                      className="text-gray-900 text-sm font-bold"
                      style={{ fontFamily: "Jost, sans-serif" }}
                    >
                      {lensType.name}
                    </p>
                  )}
                  {editingType?.id === lensType.id ? (
                    <Combobox
                      options={companyOptionsById}
                      value={editingType.companyId}
                      showClearButton={true}
                      onValueChange={(value) =>
                        setEditingType({
                          ...editingType,
                          companyId: value,
                        })
                      }
                      placeholder="Select company..."
                      searchPlaceholder="Search company..."
                      emptyText="No company found."
                    />
                  ) : (
                    <p
                      className="text-gray-600 text-sm font-bold"
                      style={{ fontFamily: "Jost, sans-serif" }}
                    >
                      {lensType.company_name || "Unknown company"}
                    </p>
                  )}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity w-20">
                    {editingType?.id === lensType.id ? (
                      <>
                        <button
                          onClick={handleUpdate}
                          className="text-[#0dcaf0] hover:text-[#0bb8d9] transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingType(null)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            setEditingType({
                              id: lensType.id,
                              name: lensType.name,
                              companyId: String(lensType.company_id),
                            })
                          }
                          className="text-gray-400 hover:text-[#0dcaf0] transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRequestDelete(lensType)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {types.length === 0 && (
              <p className="text-sm text-gray-500 py-6 text-center">
                No types yet.
              </p>
            )}
          </div>
        </div>
      </AccordionContent>
      <DeleteLensTypeDialog
        open={deleteDialogOpen}
        lensTypeName={typeToDelete?.name ?? null}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setTypeToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        onOpenChange={setDeleteDialogOpen}
      />
    </AccordionItem>
  );
}

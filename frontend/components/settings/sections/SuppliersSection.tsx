import { useEffect, useState } from "react";
import { Check, ChevronDown, Edit2, Plus, X } from "lucide-react";
import { AccordionContent, AccordionItem } from "../../ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { DeleteSupplierDialog } from "../components/DeleteSupplierDialog";
import type { InlineEdit, SupplierRow } from "../types";

interface SuppliersSectionProps {
  suppliers: SupplierRow[];
  isOpen: boolean;
  ensureOpen: () => void;
  onCreate: (name: string) => Promise<void> | void;
  onUpdate: (id: number, name: string) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
}

export function SuppliersSection({
  suppliers,
  isOpen,
  ensureOpen,
  onCreate,
  onUpdate,
  onDelete,
}: SuppliersSectionProps) {
  const [newSupplier, setNewSupplier] = useState("");
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<InlineEdit | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierRow | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowNewSupplier(false);
      setEditingSupplier(null);
      setNewSupplier("");
    }
  }, [isOpen]);

  const handleSaveNew = async () => {
    await onCreate(newSupplier);
    setNewSupplier("");
    setShowNewSupplier(false);
  };

  const handleUpdate = async () => {
    if (!editingSupplier) return;
    await onUpdate(editingSupplier.id, editingSupplier.value);
    setEditingSupplier(null);
  };

  const handleRequestDelete = (supplier: SupplierRow) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    await onDelete(supplierToDelete.id);
    setDeleteDialogOpen(false);
    setSupplierToDelete(null);
  };

  return (
    <AccordionItem
      value="suppliers"
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
              Suppliers
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNewSupplier(true);
                ensureOpen();
              }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-gray-400 px-6 py-2 h-10 text-sm font-bold text-gray-600 transition-colors hover:border-[#0dcaf0] hover:bg-[#0dcaf0] hover:text-white w-52 justify-center"
            >
              <Plus className="h-4 w-4" />
              Add Supplier
            </button>
          </div>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionContent>
        <div className="border-t border-gray-200">
          <div className="px-6 pt-4">
            <div className="grid grid-cols-[auto_1fr_auto] gap-4 pb-3 border-b-2 border-gray-900 text-xs uppercase tracking-wider font-semibold text-black">
              <p></p>
              <p>Supplier Name</p>
              <p className="w-20"></p>
            </div>
          </div>
          <div>
            {showNewSupplier && (
              <div className="px-6 bg-blue-50 border-b border-gray-100">
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center py-4">
                  <div className="w-6"></div>
                  <input
                    type="text"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSaveNew();
                      if (event.key === "Escape") {
                        setNewSupplier("");
                        setShowNewSupplier(false);
                      }
                    }}
                    placeholder="Enter supplier name"
                    className="px-2 py-1 border-2 border-[#0dcaf0] outline-none focus:border-[#0bb8d9] bg-white text-gray-900 text-sm font-bold"
                    style={{ fontFamily: "Jost, sans-serif" }}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 w-20">
                    <button
                      onClick={handleSaveNew}
                      className="text-[#0dcaf0] hover:text-[#0bb8d9] transition-colors"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setNewSupplier("");
                        setShowNewSupplier(false);
                      }}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {suppliers.map((supplier, index) => (
              <div
                key={supplier.id}
                className="px-6 transition-colors hover:bg-gray-50 group"
              >
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center py-4 border-b border-gray-100">
                  <p
                    className="text-gray-600 text-sm font-bold"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    {index + 1}
                  </p>
                  {editingSupplier?.id === supplier.id ? (
                    <input
                      type="text"
                      value={editingSupplier.value}
                      onChange={(e) =>
                        setEditingSupplier({
                          id: supplier.id,
                          value: e.target.value,
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
                      {supplier.name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity w-20">
                    {editingSupplier?.id === supplier.id ? (
                      <>
                        <button
                          onClick={handleUpdate}
                          className="text-[#0dcaf0] hover:text-[#0bb8d9] transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingSupplier(null)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            setEditingSupplier({
                              id: supplier.id,
                              value: supplier.name,
                            })
                          }
                          className="text-gray-400 hover:text-[#0dcaf0] transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRequestDelete(supplier)}
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
            {suppliers.length === 0 && (
              <p className="text-sm text-gray-500 py-6 text-center">
                No suppliers yet.
              </p>
            )}
          </div>
        </div>
      </AccordionContent>
      <DeleteSupplierDialog
        open={deleteDialogOpen}
        supplierName={supplierToDelete?.name ?? null}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSupplierToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        onOpenChange={setDeleteDialogOpen}
      />
    </AccordionItem>
  );
}

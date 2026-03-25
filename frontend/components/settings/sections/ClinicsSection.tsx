import { useEffect, useState } from "react";
import { Check, ChevronDown, Edit2, Plus, X } from "lucide-react";
import { AccordionContent, AccordionItem } from "../../ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { DeleteClinicDialog } from "../components/DeleteClinicDialog";
import type { InlineEdit, SiteRow } from "../types";

interface ClinicsSectionProps {
  sites: SiteRow[];
  isOpen: boolean;
  ensureOpen: () => void;
  onCreate: (name: string) => Promise<void> | void;
  onUpdate: (id: number, name: string) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
}

export function ClinicsSection({
  sites,
  isOpen,
  ensureOpen,
  onCreate,
  onUpdate,
  onDelete,
}: ClinicsSectionProps) {
  const [newSite, setNewSite] = useState("");
  const [showNewSite, setShowNewSite] = useState(false);
  const [editingSite, setEditingSite] = useState<InlineEdit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<SiteRow | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowNewSite(false);
      setEditingSite(null);
      setNewSite("");
    }
  }, [isOpen]);

  const handleSaveNew = async () => {
    await onCreate(newSite);
    setNewSite("");
    setShowNewSite(false);
  };

  const handleUpdate = async () => {
    if (!editingSite) return;
    await onUpdate(editingSite.id, editingSite.value);
    setEditingSite(null);
  };

  const handleRequestDelete = (site: SiteRow) => {
    setSiteToDelete(site);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!siteToDelete) return;
    await onDelete(siteToDelete.id);
    setDeleteDialogOpen(false);
    setSiteToDelete(null);
  };

  return (
    <AccordionItem
      value="clinics"
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
              Clinics
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNewSite(true);
                ensureOpen();
              }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-gray-400 px-6 py-2 h-10 text-sm font-bold text-gray-600 transition-colors hover:border-[#0dcaf0] hover:bg-[#0dcaf0] hover:text-white w-52 justify-center"
            >
              <Plus className="h-4 w-4" />
              Add Clinic
            </button>
          </div>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionContent>
        <div className="border-t border-gray-200">
          <div className="px-6 pt-4">
            <div className="grid grid-cols-[auto_1fr_auto] gap-4 pb-3 border-b-2 border-gray-900 text-xs uppercase tracking-wider font-semibold text-black">
              <p></p>
              <p>Clinic Name</p>
              <p className="w-20"></p>
            </div>
          </div>
          <div>
            {showNewSite && (
              <div className="px-6 bg-blue-50 border-b border-gray-100">
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center py-4">
                  <div className="w-6"></div>
                  <input
                    type="text"
                    value={newSite}
                    onChange={(e) => setNewSite(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSaveNew();
                      if (event.key === "Escape") {
                        setNewSite("");
                        setShowNewSite(false);
                      }
                    }}
                    placeholder="Enter clinic name"
                    className="px-2 py-1 border-2 border-[#0dcaf0] outline-none focus:border-[#0bb8d9] bg-white text-gray-900 text-sm font-bold"
                    style={{ fontFamily: "Jost, sans-serif" }}
                    autoFocus
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
                        setNewSite("");
                        setShowNewSite(false);
                      }}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sites.map((site, index) => (
              <div
                key={site.id}
                className="px-6 transition-colors hover:bg-gray-50 group"
              >
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center py-4 border-b border-gray-100">
                  <p
                    className="text-gray-600 text-sm font-bold"
                    style={{ fontFamily: "Jost, sans-serif" }}
                  >
                    {index + 1}
                  </p>
                  {editingSite?.id === site.id ? (
                    <input
                      type="text"
                      value={editingSite.value}
                      onChange={(e) =>
                        setEditingSite({
                          id: site.id,
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
                      {site.name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity w-20">
                    {editingSite?.id === site.id ? (
                      <>
                        <button
                          onClick={handleUpdate}
                          className="text-[#0dcaf0] hover:text-[#0bb8d9] transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingSite(null)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            setEditingSite({
                              id: site.id,
                              value: site.name,
                            })
                          }
                          className="text-gray-400 hover:text-[#0dcaf0] transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRequestDelete(site)}
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
            {sites.length === 0 && (
              <p className="text-sm text-gray-500 py-6 text-center">
                No clinics yet.
              </p>
            )}
          </div>
        </div>
      </AccordionContent>
      <DeleteClinicDialog
        open={deleteDialogOpen}
        clinicName={siteToDelete?.name ?? null}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSiteToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        onOpenChange={setDeleteDialogOpen}
      />
    </AccordionItem>
  );
}

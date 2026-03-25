import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";

interface MoveClinicDialogProps {
  open: boolean;
  serialNumber: string | null;
  fromClinic: string | null;
  toClinic: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export const MoveClinicDialog = ({
  open,
  serialNumber,
  fromClinic,
  toClinic,
  onCancel,
  onConfirm,
  onOpenChange,
}: MoveClinicDialogProps) => {
  const fromLabel = (fromClinic || "-").trim() || "-";
  const toLabel = (toClinic || "-").trim() || "-";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center sm:text-center text-xl font-bold">
            {`Move SN ${serialNumber ?? "-"} from ${fromLabel} to ${toLabel}?`}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-end gap-4 mt-4">
          <button
            onClick={onCancel}
            className="px-8 py-2 border-2 border-gray-400 text-gray-700 text-base font-bold rounded-full hover:border-gray-900 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-8 py-2 border-2 border-[#0dcaf0] text-[#0dcaf0] text-base font-bold rounded-full hover:bg-[#0dcaf0] hover:text-white transition-colors"
          >
            Confirm
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

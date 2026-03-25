import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";

interface DeleteLensDialogProps {
  open: boolean;
  serialNumber: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export const DeleteLensDialog = ({
  open,
  serialNumber,
  onCancel,
  onConfirm,
  onOpenChange,
}: DeleteLensDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center sm:text-center text-xl font-bold">
            {`Are you sure you want to delete SN ${serialNumber ?? "-" }?`}
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
            className="px-8 py-2 border-2 border-red-600 text-red-600 text-base font-bold rounded-full hover:bg-red-600 hover:text-white transition-colors"
          >
            Delete
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

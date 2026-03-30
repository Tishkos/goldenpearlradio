import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteTalkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talk: { id: number; title: string } | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export default function DeleteTalkDialog({
  open,
  onOpenChange,
  talk,
  onConfirm,
  isDeleting,
}: DeleteTalkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            Confirm Deletion
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the talk{" "}
            <span className="font-medium">{talk?.title}</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Talk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
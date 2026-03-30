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

interface DeleteTrackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: { id: number; title: string } | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export default function DeleteTrackDialog({
  open,
  onOpenChange,
  track,
  onConfirm,
  isDeleting,
}: DeleteTrackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            Confirm Deletion
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the track{" "}
            <span className="font-medium">{track?.title}</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Track"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

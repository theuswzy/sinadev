import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={value => !loading && onOpenChange(value)}>
      <AlertDialogContent className="rounded-2xl border-border p-5 sm:p-6">
        <AlertDialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={event => {
              event.preventDefault();
              void onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Processando…" : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

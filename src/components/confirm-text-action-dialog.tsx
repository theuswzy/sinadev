import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmTextActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationLabel,
  confirmationValue,
  actionLabel = "Confirmar exclusão",
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmationLabel: string;
  confirmationValue: string;
  actionLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const matches = value.trim() === confirmationValue;

  return (
    <AlertDialog open={open} onOpenChange={v => !loading && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl border-border p-5 sm:p-6">
        <AlertDialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="confirm-danger-value">{confirmationLabel}</Label>
          <Input
            id="confirm-danger-value"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={confirmationValue}
            disabled={loading}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Digite exatamente: <code className="rounded bg-muted px-1.5 py-0.5 font-medium">{confirmationValue}</code>
          </p>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || !matches}
            onClick={event => {
              event.preventDefault();
              void onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Excluindo…" : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

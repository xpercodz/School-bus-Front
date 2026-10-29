import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Non-dismissable confirmation overlay. `Dialog`'s auto placement turns it
 * into a bottom sheet on phones, where the two actions stack: cancel first,
 * the full-width primary last (thumb-reachable), both 44px. From sm up it is
 * the centered dialog with side-by-side actions. Localized labels come from
 * the caller (which has `t`). `busy` disables both buttons while the action
 * runs and swaps the primary for a spinner.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} dismissable={false}>
      <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
        <h2 className="text-[18px] font-semibold leading-6 text-on-surface sm:text-headline-md">
          {title}
        </h2>
        <p className="text-[16px] leading-6 text-on-surface-variant sm:text-body-md sm:leading-5">
          {body}
        </p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="arc-field w-full sm:w-auto"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full sm:w-auto sm:min-w-20"
            onClick={onConfirm}
            disabled={busy}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

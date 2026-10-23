import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";

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
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="press flex h-11 w-full items-center justify-center rounded-lg border border-outline-variant bg-surface text-[16px] font-medium text-on-surface-variant hover:bg-surface-container disabled:opacity-50 sm:h-10 sm:w-auto sm:border-0 sm:px-5 sm:text-[13.5px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="press flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-on-surface text-[16px] font-medium text-surface hover:opacity-90 disabled:opacity-50 sm:h-10 sm:w-auto sm:min-w-20 sm:px-5 sm:text-[13.5px]"
          >
            {busy ? (
              <>
                <Icon name="progress_activity" size={20} className="animate-spin" />
                <span className="sr-only">{confirmLabel}</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

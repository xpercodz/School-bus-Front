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
 * Centered, non-dismissable confirmation dialog. Localized labels come from the
 * caller (which has `t`). `busy` disables both buttons while the action runs.
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
      <div className="flex flex-col gap-6 p-6">
        <h2 className="text-headline-md text-on-surface">{title}</h2>
        <p className="text-body-md text-on-surface-variant">{body}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-12 items-center justify-center rounded-full px-6 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex h-12 min-w-24 items-center justify-center gap-2 rounded-full bg-primary px-6 text-label-lg text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Icon name="progress_activity" size={20} className="animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

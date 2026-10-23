import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/lib/i18n/context";
import { useOnlineStatus } from "@/lib/use-online-status";

interface BottomBarProps {
  /** True once the run is completed — disables the button and shows "Run completed". */
  completed: boolean;
  /** Completes the run (writes COMPLETED + WAITING→ABSENT). */
  onComplete: () => Promise<void>;
}

/**
 * Sticky bottom action bar: honest sync state above, the one primary action as
 * a full-width thumb target below. The online/offline label is real (the write
 * queue makes offline safe); it is not a decorative "Sync status" word.
 *
 * The full-width CTA replaces the old side-by-side layout on narrow phones,
 * where the sync sentence and a 44px button fought for the same line. The bar
 * owns the home-indicator safe area.
 */
export function BottomBar({ completed, onComplete }: BottomBarProps) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const initialCompleted = useRef(completed);
  const completedChanged = completed !== initialCompleted.current;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onComplete();
      setConfirmOpen(false);
      showToast(t("toast.runCompleted"));
    } catch {
      // Keep the dialog open so the user can retry.
      showToast(t("toast.error"));
    } finally {
      setBusy(false);
    }
  }

  const disabled = completed || busy;

  return (
    <footer className="sticky bottom-0 z-40 border-t border-outline-variant bg-surface px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <p
          aria-live="polite"
          className="flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4 text-on-surface-variant"
        >
          <Icon
            name={online ? "cloud_done" : "cloud_off"}
            size={16}
            className={online ? "text-success" : "text-waiting"}
          />
          <span className="truncate">{online ? t("mobile.online") : t("mobile.offline")}</span>
        </p>
        {!completed && (
          <p className="hidden max-w-[58%] truncate text-[11.5px] leading-4 text-on-surface-variant min-[360px]:block">
            {t("mobile.statusHint")}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setConfirmOpen(true)}
        className={`press mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-[14.5px] font-medium ${
          completed
            ? "cursor-default bg-surface-container text-on-surface-variant"
            : "bg-on-surface text-surface hover:opacity-90 disabled:opacity-60"
        }`}
      >
        <span
          key={completed ? "done" : "open"}
          className={`${completedChanged ? "icon-pop " : ""}flex items-center`}
        >
          <Icon name="check" size={19} />
        </span>
        {completed
          ? t("mobile.completed")
          : busy
            ? t("mobile.completing")
            : t("mobile.completeRun")}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={t("confirm.completeRun.title")}
        body={t("confirm.completeRun.body")}
        confirmLabel={t("dialog.confirm")}
        cancelLabel={t("dialog.cancel")}
        busy={busy}
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </footer>
  );
}

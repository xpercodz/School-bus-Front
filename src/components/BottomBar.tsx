import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/lib/i18n/context";

interface BottomBarProps {
  /** True once the run is completed — disables the button and shows "Completed". */
  completed: boolean;
  /** Completes the run (writes COMPLETED + WAITING→ABSENT). */
  onComplete: () => Promise<void>;
}

/** Sticky bottom bar — sync status on one side, Complete Run action on the other. */
export function BottomBar({ completed, onComplete }: BottomBarProps) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <footer className="sticky bottom-0 z-50 flex h-20 items-center justify-between border-t border-outline-variant bg-surface-container px-4">
      <div className="flex items-center gap-2 px-2 text-label-lg text-primary">
        <Icon name="cloud_done" size={18} />
        {t("mobile.syncStatus")}
      </div>
      <button
        type="button"
        disabled={completed}
        onClick={() => setConfirmOpen(true)}
        className={`flex h-14 items-center gap-2 rounded-full px-8 text-label-lg transition-colors ${
          completed
            ? "cursor-not-allowed bg-success/10 text-on-success"
            : "bg-primary text-on-primary hover:bg-primary/90"
        }`}
      >
        <Icon name="check" />
        {completed ? t("mobile.completed") : t("mobile.completeRun")}
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

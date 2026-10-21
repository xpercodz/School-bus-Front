import { useState } from "react";
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
 * Sticky bottom bar: honest sync state on the left, the one primary action on
 * the right. The online/offline label is real (the write queue makes offline
 * safe); it is not a decorative "Sync status" word.
 */
export function BottomBar({ completed, onComplete }: BottomBarProps) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const online = useOnlineStatus();
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
    <footer className="sticky bottom-0 z-40 border-t border-outline-variant bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-on-surface-variant">
          <Icon
            name={online ? "cloud_done" : "cloud_off"}
            size={16}
            className={online ? "text-success" : "text-waiting"}
          />
          <span className="truncate">{online ? t("mobile.online") : t("mobile.offline")}</span>
        </p>
        <button
          type="button"
          disabled={completed || busy}
          onClick={() => setConfirmOpen(true)}
          className={`flex h-11 flex-none items-center gap-2 rounded-md px-5 text-[14px] font-medium transition-colors ${
            completed
              ? "cursor-default bg-surface-container text-on-surface-variant"
              : "bg-on-surface text-white hover:opacity-90 disabled:opacity-60"
          }`}
        >
          <Icon name="check" size={18} />
          {completed
            ? t("mobile.completed")
            : busy
              ? t("mobile.completing")
              : t("mobile.completeRun")}
        </button>
      </div>

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

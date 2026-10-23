import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import type { Student } from "@/data/students";
import { useLocale } from "@/lib/i18n/context";

interface StudentActionSheetProps {
  student: Student;
  open: boolean;
  onClose: () => void;
  onMarkAbsent: (id: string) => void;
  onViewHistory: (name: string) => void;
  /** True on a completed run — only read-only actions (history) are shown. */
  disabled?: boolean;
}

/**
 * Bottom-sheet action menu for a roster card (opened from the "⋯" button):
 * view attendance history, or mark the student absent (hidden on completed runs).
 * The title row is pinned so the 44px close target stays reachable; each action
 * is a 48px row with 16px text for thumb-sized taps.
 */
export function StudentActionSheet({
  student,
  open,
  onClose,
  onMarkAbsent,
  onViewHistory,
  disabled = false,
}: StudentActionSheetProps) {
  const { t } = useLocale();
  const { showToast } = useToast();

  function handleMarkAbsent() {
    onMarkAbsent(student.id);
    onClose();
    showToast(t("toast.markedAbsent", { name: student.name }));
  }

  function handleViewHistory() {
    onClose();
    onViewHistory(student.name);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={student.name}
      placement="bottom"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-2.5">
        <h2 className="min-w-0 truncate text-[18px] font-semibold text-on-surface">
          {student.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="press flex h-11 w-11 flex-none items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
        >
          <Icon name="close" size={22} />
        </button>
      </header>
      <div className="flex flex-col gap-0.5 p-2 pb-3">
        <button
          type="button"
          onClick={handleViewHistory}
          className="press flex h-12 items-center gap-3 rounded-lg px-3 text-[16px] text-on-surface hover:bg-surface-container"
        >
          <Icon name="history" size={22} />
          {t("kebab.viewHistory")}
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={handleMarkAbsent}
            className="press flex h-12 items-center gap-3 rounded-lg px-3 text-[16px] text-error hover:bg-error-container/40"
          >
            <Icon name="cancel" size={22} />
            {t("kebab.markAbsent")}
          </button>
        )}
      </div>
    </Dialog>
  );
}

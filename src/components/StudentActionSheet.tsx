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
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <h2 className="text-headline-md text-on-surface">{student.name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="flex flex-col p-2">
        <button
          type="button"
          onClick={handleViewHistory}
          className="flex h-12 items-center gap-3 rounded-md px-3 text-[14px] text-on-surface transition-colors hover:bg-surface-container"
        >
          <Icon name="history" />
          {t("kebab.viewHistory")}
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={handleMarkAbsent}
            className="flex h-12 items-center gap-3 rounded-md px-3 text-[14px] text-error transition-colors hover:bg-error-container/40"
          >
            <Icon name="cancel" />
            {t("kebab.markAbsent")}
          </button>
        )}
      </div>
    </Dialog>
  );
}

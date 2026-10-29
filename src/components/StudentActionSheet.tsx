import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";
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
        <Button
          type="button"
          variant="ghost"
          size="md"
          icon
          className="flex-none"
          onClick={onClose}
          aria-label={t("dialog.close")}
        >
          <Icon name="close" size={22} />
        </Button>
      </header>
      <div className="flex flex-col gap-0.5 p-2 pb-3">
        <Button
          type="button"
          variant="ghost"
          size="md"
          align="start"
          className="w-full"
          onClick={handleViewHistory}
        >
          <Icon name="history" size={22} />
          {t("kebab.viewHistory")}
        </Button>
        {!disabled && (
          <Button
            type="button"
            variant="danger"
            size="md"
            align="start"
            className="arc-field w-full"
            onClick={handleMarkAbsent}
          >
            <Icon name="cancel" size={22} />
            {t("kebab.markAbsent")}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

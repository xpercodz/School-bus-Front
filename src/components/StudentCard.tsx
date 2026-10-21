import { useState } from "react";
import type { Student } from "@/data/students";
import { STATUS_META } from "@/data/students";
import { Icon } from "@/components/Icon";
import { StudentActionSheet } from "@/components/StudentActionSheet";
import { useLocale } from "@/lib/i18n/context";
import { statusKey, translateDataLabel } from "@/lib/i18n/format";

interface StudentCardProps {
  student: Student;
  onCycleStatus: (id: string) => void;
  onMarkAbsent: (id: string) => void;
  onViewHistory: (name: string) => void;
  /** True on a completed run — the status pill is read-only. */
  disabled?: boolean;
}

/**
 * One student on the driver's roster: a row, not a card. The status control is
 * the only tinted thing, and it is a 44px tap target with a sentence-case label
 * — the old pill was uppercase, solid blue for every dropped student, and wide
 * enough to truncate the name it belonged to.
 */
export function StudentCard({
  student,
  onCycleStatus,
  onMarkAbsent,
  onViewHistory,
  disabled = false,
}: StudentCardProps) {
  const meta = STATUS_META[student.status];
  const { t, locale } = useLocale();
  const pillLabel = t(statusKey(student.status));
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-medium leading-6 text-on-surface">
          {student.name}
        </h3>
        <p className="text-[12px] leading-4 text-on-surface-variant">
          {translateDataLabel(student.grade, locale, t)}
        </p>
      </div>
      <div className="flex flex-none items-center gap-0.5">
        <button
          type="button"
          disabled={disabled}
          aria-label={`${student.name}: ${pillLabel}`}
          onClick={() => onCycleStatus(student.id)}
          className={`flex h-11 min-w-[104px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12px] font-medium transition-colors ${
            disabled ? "cursor-not-allowed opacity-60" : meta.pillClassName
          }`}
        >
          <Icon name={meta.icon} size={15} />
          {pillLabel}
        </button>
        <button
          type="button"
          aria-label={t("mobile.moreOptionsForAria", { name: student.name })}
          onClick={() => setActionsOpen(true)}
          className="flex h-11 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="more_vert" size={20} />
        </button>
      </div>

      <StudentActionSheet
        student={student}
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onMarkAbsent={onMarkAbsent}
        onViewHistory={onViewHistory}
        disabled={disabled}
      />
    </div>
  );
}

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
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 shadow-card ${
        meta.cardClassName || "border-outline-variant bg-surface-container-lowest"
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3 className={`truncate text-body-lg font-medium ${meta.nameClassName}`}>
          {student.name}
        </h3>
        <p className="mt-1 text-body-md text-on-surface-variant">
          {translateDataLabel(student.grade, locale, t)}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          aria-label={`${student.name}: ${pillLabel}`}
          onClick={() => onCycleStatus(student.id)}
          className={`flex h-12 items-center gap-2 rounded-full px-4 text-label-lg uppercase transition-colors ${
            disabled ? "cursor-not-allowed opacity-60" : meta.pillClassName
          }`}
        >
          <Icon name={meta.icon} size={18} />
          {pillLabel}
        </button>
        <button
          type="button"
          aria-label={t("mobile.moreOptionsForAria", { name: student.name })}
          onClick={() => setActionsOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="more_vert" />
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

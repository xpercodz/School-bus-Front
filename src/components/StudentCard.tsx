import { useRef, useState } from "react";
import type { Student } from "@/data/students";
import { STATUS_META } from "@/data/students";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
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
 *
 * Status changes animate the glyph (the status name is in the button's
 * accessible label), and the pill sits a full 8px from the kebab so a thumb
 * reaching for "more" cannot silently mark a child absent.
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
  // The status glyph is part of the row, not a speck that arrives after it.
  // It pops only when the status actually changes (initial render is silent).
  const initialStatus = useRef(student.status);
  const statusChanged = student.status !== initialStatus.current;

  return (
    <div className="flex min-h-[68px] items-center gap-2 px-3.5 py-2.5 transition-colors hover:bg-surface-container-low/60">
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15.5px] font-medium leading-5 text-on-surface">
          {student.name}
        </h3>
        <p className="mt-0.5 text-[12px] leading-4 text-on-surface-variant">
          {translateDataLabel(student.grade, locale, t)}
        </p>
      </div>
      <div className="flex flex-none items-center gap-2">
        {/* A status chip, not an Arc Button: its tint is the roster's status
            language (see the note above), and the Button module owns colour. */}
        <button
          type="button"
          disabled={disabled}
          aria-label={`${student.name}: ${pillLabel}`}
          onClick={() => onCycleStatus(student.id)}
          data-status={student.status}
          className={`press flex h-11 min-w-[104px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] font-medium ${
            disabled ? "cursor-not-allowed opacity-60" : meta.pillClassName
          }`}
        >
          <span
            key={student.status}
            className={`${statusChanged ? "icon-pop " : ""}flex items-center`}
          >
            <Icon name={meta.icon} size={15} />
          </span>
          {pillLabel}
        </button>
        <Button
          type="button"
          aria-label={t("mobile.moreOptionsForAria", { name: student.name })}
          onClick={() => setActionsOpen(true)}
          variant="ghost"
          size="md"
          icon
        >
          <Icon name="more_vert" size={20} />
        </Button>
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

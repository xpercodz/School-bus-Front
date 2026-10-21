import type { Student } from "@/data/students";
import { Icon } from "@/components/Icon";
import { StudentCard } from "@/components/StudentCard";
import { useLocale } from "@/lib/i18n/context";

interface RosterListProps {
  students: readonly Student[];
  onCycleStatus: (id: string) => void;
  onMarkAbsent: (id: string) => void;
  onViewHistory: (name: string) => void;
  /** True on a completed run — roster cards become read-only. */
  disabled?: boolean;
}

export function RosterList({
  students,
  onCycleStatus,
  onMarkAbsent,
  onViewHistory,
  disabled = false,
}: RosterListProps) {
  const { t } = useLocale();

  if (students.length === 0) {
    return (
      <div role="status" className="flex flex-col items-center gap-1.5 py-14 text-center">
        <Icon name="search_off" size={24} className="text-outline" />
        <p className="text-[15px] font-medium text-on-surface">{t("mobile.emptyTitle")}</p>
        <p className="text-[12.5px] text-on-surface-variant">{t("mobile.emptySubtitle")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      {students.map((student) => (
        <li key={student.id}>
          <StudentCard
            student={student}
            onCycleStatus={onCycleStatus}
            onMarkAbsent={onMarkAbsent}
            onViewHistory={onViewHistory}
            disabled={disabled}
          />
        </li>
      ))}
    </ul>
  );
}

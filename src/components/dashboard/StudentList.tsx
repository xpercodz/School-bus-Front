import type { StudentListState } from "@/lib/use-student-list";
import { AttendanceTable } from "./AttendanceTable";
import { StudentListToolbar } from "./StudentListToolbar";
import { PaginationBar } from "./PaginationBar";
import { useLocale } from "@/lib/i18n/context";

interface StudentListProps {
  /** Filter + pagination state from `useStudentList(rows)` at the page level. */
  list: StudentListState;
  /** Open a student's attendance history (row History action). */
  onViewHistory?: (name: string) => void;
}

/**
 * The dashboard roster: its heading and live mark, search + grade/status
 * filters, the rows, and pagination. The rows come from the shared
 * `useStudentList` state, so export reads exactly what is on screen.
 */
export function StudentList({ list, onViewHistory }: StudentListProps) {
  const { t } = useLocale();

  return (
    <section aria-labelledby="roster-title" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <h2 id="roster-title" className="text-[15px] font-semibold text-dash-on-surface">
          {t("dashboard.liveAttendance")}
        </h2>
        <p className="flex items-center gap-1.5 text-[12px] text-dash-on-surface-variant">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-dash-success" aria-hidden="true" />
          {t("dashboard.liveUpdating")}
        </p>
      </div>
      <StudentListToolbar list={list} />
      <AttendanceTable rows={list.paged} onViewHistory={onViewHistory} />
      <PaginationBar list={list} />
    </section>
  );
}

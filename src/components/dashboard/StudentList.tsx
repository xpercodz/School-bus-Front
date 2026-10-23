import type { StudentListState } from "@/lib/use-student-list";
import { AttendanceTable } from "./AttendanceTable";
import { StudentListToolbar } from "./StudentListToolbar";
import { PaginationBar } from "./PaginationBar";
import { useLocale } from "@/lib/i18n/context";
import { useOnlineStatus } from "@/lib/use-online-status";

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
 *
 * No `Reveal` wrapper here on purpose: this block is also printed by the
 * Reports screen, and `Reveal`'s hidden state would drop a below-the-fold
 * roster from the printed page.
 */
export function StudentList({ list, onViewHistory }: StudentListProps) {
  const { t } = useLocale();
  const online = useOnlineStatus();

  return (
    <section data-page-reveal aria-labelledby="roster-title" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <h2 id="roster-title" className="text-[15px] font-semibold text-dash-on-surface">
          {t("dashboard.liveAttendance")}
        </h2>
        {/* "Live" is a claim about the listener, so it is only made while the
            browser is online. The mark is a plain status dot, not a loop: a
            permanently pulsing dot would imply movement even when the roster
            sits still, and the page states the unavailable case in words. */}
        {online && (
          <p className="flex flex-none items-center gap-1.5 text-[12px] text-dash-on-surface-variant">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-dash-success" aria-hidden="true" />
            {t("dashboard.liveUpdating")}
          </p>
        )}
      </div>
      <StudentListToolbar list={list} />
      <AttendanceTable rows={list.paged} onViewHistory={onViewHistory} />
      <PaginationBar list={list} />
    </section>
  );
}

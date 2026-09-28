import type { StudentListState } from "@/lib/use-student-list";
import { AttendanceTable } from "./AttendanceTable";
import { StudentListToolbar } from "./StudentListToolbar";
import { PaginationBar } from "./PaginationBar";

interface StudentListProps {
  /** Filter + pagination state from `useStudentList(rows)` at the page level. */
  list: StudentListState;
  /** Open a student's attendance history (row History action). */
  onViewHistory?: (name: string) => void;
}

/**
 * The dashboard student list: search + grade/status filters above the
 * attendance table, and pagination below. The rows it shows come from the
 * shared `useStudentList` state, so the page's export reads the same filtered
 * set.
 */
export function StudentList({ list, onViewHistory }: StudentListProps) {
  return (
    <div className="flex flex-col gap-3">
      <StudentListToolbar list={list} />
      <AttendanceTable rows={list.paged} onViewHistory={onViewHistory} />
      <PaginationBar list={list} />
    </div>
  );
}

import { useMemo, useState } from "react";
import type { AttendanceRow, StudentStatusFilter } from "@/data/dashboard";

/** Rows shown per page in the dashboard student tables. */
const STUDENT_LIST_PAGE_SIZE = 10;

export interface StudentListState {
  // Search + filters
  query: string;
  setQuery: (q: string) => void;
  status: StudentStatusFilter;
  setStatus: (s: StudentStatusFilter) => void;
  grade: string | null;
  setGrade: (g: string | null) => void;
  clearFilters: () => void;
  hasFilters: boolean;
  // Derived
  /** Distinct, sorted grades present in the rows (grade-filter dropdown options). */
  grades: readonly string[];
  /** Rows after search + status + grade filters (all pages — drives CSV export). */
  filtered: readonly AttendanceRow[];
  total: number;
  // Pagination
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  /** The current page's rows, for the table. */
  paged: readonly AttendanceRow[];
  /** 1-based index of the first row shown (0 when empty). */
  start: number;
  /** 1-based index of the last row shown (0 when empty). */
  end: number;
}

/**
 * Search + status + grade filters and client-side pagination for a student
 * list. The rows are already fully loaded (the dashboard aggregates them for
 * KPIs / fleet / summaries), so pagination slices the view rather than the
 * Firestore query.
 *
 * The page resets to 1 when a filter changes, but not when `rows` changes —
 * live snapshots update constantly and bouncing the user to page 1 mid-read
 * would be jarring. Instead the page clamps to the valid range.
 */
export function useStudentList(rows: readonly AttendanceRow[]): StudentListState {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StudentStatusFilter>("ALL");
  const [grade, setGrade] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever a filter changes — adjusting state during render
  // (the React-endorsed alternative to an effect) so it can't cascade. Live
  // `rows` snapshots update constantly but don't change this signature, so the
  // user stays on their page (clamped) while the data refreshes underneath.
  const filterSignature = `${query}|${status}|${grade}`;
  const [lastSignature, setLastSignature] = useState(filterSignature);
  if (lastSignature !== filterSignature) {
    setLastSignature(filterSignature);
    setPage(1);
  }

  const grades = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.grade) set.add(row.grade);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && status === "ALL" && grade === null) return rows;
    return rows.filter(
      (row) =>
        (q === "" || row.name.toLowerCase().includes(q)) &&
        (status === "ALL" || row.status === status) &&
        (grade === null || row.grade === grade),
    );
  }, [rows, query, status, grade]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / STUDENT_LIST_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * STUDENT_LIST_PAGE_SIZE + 1;
  const end = Math.min(safePage * STUDENT_LIST_PAGE_SIZE, filtered.length);

  const paged = useMemo(
    () => filtered.slice((safePage - 1) * STUDENT_LIST_PAGE_SIZE, end),
    [filtered, safePage, end],
  );

  const hasFilters = query.trim() !== "" || status !== "ALL" || grade !== null;

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
    setGrade(null);
  }

  return {
    query,
    setQuery,
    status,
    setStatus,
    grade,
    setGrade,
    clearFilters,
    hasFilters,
    grades,
    filtered,
    total: filtered.length,
    page: safePage,
    setPage,
    totalPages,
    paged,
    start,
    end,
  };
}

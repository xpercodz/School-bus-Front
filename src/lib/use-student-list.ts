import { useMemo, useState } from "react";
import type { AttendanceRow } from "@/data/dashboard";

/** Rows shown per page in the dashboard student tables. */
const STUDENT_LIST_PAGE_SIZE = 10;

export type StudentSort = "runOrder" | "name" | "grade";

/**
 * "Run order" groups every row of the date into one sequence: children already
 * dropped off first (their drop-off order), then the ones only boarded (their
 * boarding order), then absent / no record yet, alphabetically. The place
 * numbers come from the data layer and are run-wide, so they read across buses.
 */
function runOrderGroup(row: AttendanceRow): 0 | 1 | 2 {
  if (row.dropOrder !== null) return 0;
  if (row.boardOrder !== null) return 1;
  return 2;
}

function compareName(a: AttendanceRow, b: AttendanceRow): number {
  return a.name.localeCompare(b.name);
}

function compareRunOrder(a: AttendanceRow, b: AttendanceRow): number {
  const groupA = runOrderGroup(a);
  const groupB = runOrderGroup(b);
  if (groupA !== groupB) return groupA - groupB;
  if (groupA === 0) return (a.dropOrder ?? 0) - (b.dropOrder ?? 0) || compareName(a, b);
  if (groupA === 1) return (a.boardOrder ?? 0) - (b.boardOrder ?? 0) || compareName(a, b);
  return compareName(a, b);
}

function compareGrade(a: AttendanceRow, b: AttendanceRow): number {
  return a.grade.localeCompare(b.grade) || compareName(a, b);
}

const COMPARATORS: Record<StudentSort, (a: AttendanceRow, b: AttendanceRow) => number> = {
  runOrder: compareRunOrder,
  name: compareName,
  grade: compareGrade,
};

/**
 * Sort a copy of the rows — except when it is a single row or the list is
 * already in this order, which keeps the unfiltered live-snapshot path cheap
 * (one linear pass, no allocation).
 */
function sortRows(
  rows: readonly AttendanceRow[],
  sort: StudentSort,
): readonly AttendanceRow[] {
  if (rows.length < 2) return rows;
  const compare = COMPARATORS[sort];
  let ordered = true;
  for (let i = 1; i < rows.length; i++) {
    if (compare(rows[i - 1], rows[i]) > 0) {
      ordered = false;
      break;
    }
  }
  return ordered ? rows : [...rows].sort(compare);
}

export interface StudentListState {
  // Search + filters
  query: string;
  setQuery: (q: string) => void;
  grade: string | null;
  setGrade: (g: string | null) => void;
  clearFilters: () => void;
  hasFilters: boolean;
  // Ordering
  sort: StudentSort;
  setSort: (s: StudentSort) => void;
  // Derived
  /** Distinct, sorted grades present in the rows (grade-filter dropdown options). */
  grades: readonly string[];
  /** Rows after the search + grade filters, in the selected sort order
   *  (all pages — drives CSV export). */
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
 * Search + grade filters, ordering and client-side pagination for a student
 * list. The rows are already fully loaded (the dashboard aggregates them for
 * KPIs / fleet / summaries), so pagination slices the view rather than the
 * Firestore query.
 *
 * The page resets to 1 when a filter or the sort changes, but not when `rows`
 * changes — live snapshots update constantly and bouncing the user to page 1
 * mid-read would be jarring. Instead the page clamps to the valid range.
 */
export function useStudentList(
  rows: readonly AttendanceRow[],
  initialSort: StudentSort = "runOrder",
): StudentListState {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<string | null>(null);
  const [sort, setSort] = useState<StudentSort>(initialSort);
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever a filter or the sort changes — adjusting state
  // during render (the React-endorsed alternative to an effect) so it can't
  // cascade. Live `rows` snapshots update constantly but don't change this
  // signature, so the user stays on their page (clamped) while the data
  // refreshes underneath.
  const filterSignature = `${query}|${grade}|${sort}`;
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
    // Fast path: no filters, no copy; the sort below is a no-op when the rows
    // already arrive in this order (the common case for the roster).
    const base =
      !q && grade === null
        ? rows
        : rows.filter(
            (row) =>
              (q === "" || row.name.toLowerCase().includes(q)) &&
              (grade === null || row.grade === grade),
          );
    return sortRows(base, sort);
  }, [rows, query, grade, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / STUDENT_LIST_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * STUDENT_LIST_PAGE_SIZE + 1;
  const end = Math.min(safePage * STUDENT_LIST_PAGE_SIZE, filtered.length);

  const paged = useMemo(
    () => filtered.slice((safePage - 1) * STUDENT_LIST_PAGE_SIZE, end),
    [filtered, safePage, end],
  );

  const hasFilters = query.trim() !== "" || grade !== null;

  function clearFilters() {
    setQuery("");
    setGrade(null);
  }

  return {
    query,
    setQuery,
    grade,
    setGrade,
    clearFilters,
    hasFilters,
    sort,
    setSort,
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

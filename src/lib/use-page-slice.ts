import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The slice `PaginationBar` needs. `useStudentList` satisfies it structurally,
 * and so does `usePageSlice` below, so one bar serves every paged list.
 */
export interface Pagination {
  /** 1-based. */
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  /** Rows in the whole (filtered) set — what the count line reports. */
  total: number;
  /** 1-based index of the first row shown; 0 when empty. */
  start: number;
  /** 1-based index of the last row shown; 0 when empty. */
  end: number;
}

export interface PageSlice<T> extends Pagination {
  paged: readonly T[];
}

/**
 * Client-side pagination for rows that are already in memory: a loaded cursor
 * page, the staff roster, one student's history.
 *
 * Two rules, both learned from the live roster:
 * - the page **clamps** rather than resetting when rows arrive or leave, so a
 *   Firestore snapshot cannot bounce the reader back to page 1;
 * - a changed `resetKey` (the search text, the open student) **does** go back to
 *   page 1, because that is a new question rather than new data.
 */
export function usePageSlice<T>(
  items: readonly T[],
  pageSize: number,
  resetKey?: unknown,
): PageSlice<T> {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPage(1);
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const first = (safePage - 1) * pageSize;
  const paged = useMemo(
    () => items.slice(first, first + pageSize),
    [items, first, pageSize],
  );

  return {
    paged,
    page: safePage,
    setPage,
    totalPages,
    total,
    start: total === 0 ? 0 : first + 1,
    end: Math.min(first + pageSize, total),
  };
}

/**
 * Fetch the next cursor page when the reader reaches the last loaded page, so a
 * paged view never dead-ends in front of a "Load more" button. Runs at most once
 * per page number: a page that brings no new rows must not retry forever.
 */
export function useAutoLoadMore(
  pagination: Pagination,
  state: { hasMore: boolean; loading: boolean; loadMore: () => void },
): void {
  const { hasMore, loading, loadMore } = state;
  const asked = useRef<number | null>(null);

  useEffect(() => {
    if (!hasMore || loading || pagination.page !== pagination.totalPages) return;
    if (asked.current === pagination.page) return;
    asked.current = pagination.page;
    loadMore();
  }, [hasMore, loading, loadMore, pagination.page, pagination.totalPages]);
}

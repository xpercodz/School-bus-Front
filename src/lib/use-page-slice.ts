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
 *
 * A list shorter than a page is the exception. It never grows a second page, so
 * the page number alone cannot tell two asks apart, and stopping after one is
 * what left the rows on the pages behind a short list unreachable. There the ask
 * repeats while the cursor keeps delivering documents (`loaded` — the rows the
 * pagination slices, which a filter applied after the cursor page can narrow
 * away), and stops when a page delivers none, so a failed read is asked once
 * rather than in a loop.
 */
export function useAutoLoadMore(
  pagination: Pagination,
  state: {
    hasMore: boolean;
    loading: boolean;
    loadMore: () => void;
    /** Rows loaded behind `pagination`, when a filter narrows that list. */
    loaded?: number;
  },
): void {
  const { hasMore, loading, loadMore, loaded } = state;
  const asked = useRef<{ page: number; loaded: number | undefined } | null>(null);

  useEffect(() => {
    if (!hasMore || loading || pagination.page !== pagination.totalPages) return;
    const previous = asked.current;
    if (previous && previous.page === pagination.page) {
      // The same page can be a new question only while the list is shorter than
      // a page; on a real last page a second ask is a duplicate read.
      if (pagination.totalPages > 1) return;
      if (loaded === undefined || previous.loaded === loaded) return;
    }
    asked.current = { page: pagination.page, loaded };
    loadMore();
  }, [hasMore, loading, loadMore, loaded, pagination.page, pagination.totalPages]);
}

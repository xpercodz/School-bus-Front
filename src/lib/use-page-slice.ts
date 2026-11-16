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
 * paged view never dead-ends in front of a "Load more" button.
 *
 * The page number is not enough to tell two asks apart: a filter applied after
 * the cursor page can keep the visible list on the same last page for several
 * reads (children the filter drops still arrive as documents), and a list
 * shorter than a page can never grow a second page at all. So the repeat is
 * decided by `loaded` — the rows behind the pagination — where the caller can
 * supply it: ask again while the cursor delivers documents, and stop when a read
 * delivers none. That is also what keeps a failed read from being retried in a
 * loop, because a failure adds no document. Without `loaded` the old
 * once-per-page rule stands.
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
      // Same page, and the cursor brought nothing since the last ask: either
      // that was the end or the read failed, and asking again would only spin.
      if (loaded === undefined || previous.loaded === loaded) return;
    }
    asked.current = { page: pagination.page, loaded };
    loadMore();
  }, [hasMore, loading, loadMore, loaded, pagination.page, pagination.totalPages]);
}

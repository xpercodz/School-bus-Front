import { useEffect, useRef, useState } from "react";
import {
  getDocs,
  limit,
  query,
  type DocumentSnapshot,
  type Firestore,
  type Query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { fetchSchoolId } from "@/lib/school-id";

export interface CursorPageState<T> {
  items: readonly T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

interface CursorPageOptions<T> {
  /** Build the page query; `cursor` is null for the first page. */
  buildQuery: (
    firestore: Firestore,
    schoolId: string,
    cursor: DocumentSnapshot | null,
  ) => Query;
  /** Map a doc to the row type. */
  mapItem: (doc: DocumentSnapshot) => T;
  pageSize: number;
  /** Re-fetch + reset the list when any of these change. */
  deps: ReadonlyArray<unknown>;
  /** Skip querying while falsy (e.g. the history sheet is closed). */
  enabled?: boolean;
}

/**
 * Shared cursor-paginated Firestore list (the always-paginate rule): fetches the
 * first page on mount / when `deps` change, and appends later pages through
 * `loadMore` with `startAfter`. Consumers own the query shape (collection,
 * filters, ordering) and the row mapper; everything else — the `lastVisible`
 * cursor, `hasMore`, `loading`, and the reset on deps-change — lives here once.
 */
export function useCursorPage<T>({
  buildQuery,
  mapItem,
  pageSize,
  deps,
  enabled = true,
}: CursorPageOptions<T>): CursorPageState<T> {
  const { user } = useAuth();
  const uid = user?.uid;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);

  // Signature of the query this hook is showing — an in-flight loadMore drops
  // its page if the query changed underneath it (e.g. the history sheet's
  // student switched while the page was loading). Synced by an effect (not
  // during render) so the append callback can compare against the latest deps.
  const depsKey = JSON.stringify(deps);
  const depsKeyRef = useRef(depsKey);
  useEffect(() => {
    depsKeyRef.current = depsKey;
  }, [depsKey]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !db || !uid) {
      // Clear so the UI shows its empty state until the query can run (e.g. the
      // history sheet is closed, or Firebase isn't configured yet).
      queueMicrotask(() => {
        if (cancelled) return;
        setItems([]);
        setHasMore(false);
        setLastVisible(null);
      });
      return () => {
        cancelled = true;
      };
    }

    const firestore = db;
    // Defer the reset out of the effect body — on reopen/filter change we clear
    // before the new first page lands.
    queueMicrotask(() => {
      if (cancelled) return;
      setItems([]);
      setHasMore(false);
      setLastVisible(null);
      setLoading(true);
    });
    void fetchSchoolId(uid).then(async (schoolId) => {
      if (cancelled || !schoolId) return;
      try {
        const snap = await getDocs(
          query(buildQuery(firestore, schoolId, null), limit(pageSize)),
        );
        if (cancelled) return;
        setItems(snap.docs.map(mapItem));
        setHasMore(snap.docs.length === pageSize);
        setLastVisible(
          snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // buildQuery/mapItem are render-scoped closures over the consumer's filter
    // deps; the explicit `deps` array is what must trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, uid, ...deps]);

  function loadMore() {
    if (!db || !uid || !lastVisible || loading) return;
    const firestore = db;
    const keyAtCall = depsKeyRef.current;
    setLoading(true);
    void fetchSchoolId(uid).then(async (schoolId) => {
      if (!schoolId) return;
      try {
        const snap = await getDocs(
          query(buildQuery(firestore, schoolId, lastVisible), limit(pageSize)),
        );
        setItems((prev) => {
          if (depsKeyRef.current !== keyAtCall) return prev;
          return [...prev, ...snap.docs.map(mapItem)];
        });
        setHasMore(snap.docs.length === pageSize);
        setLastVisible(
          snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
        );
      } finally {
        setLoading(false);
      }
    });
  }

  return { items, loading, hasMore, loadMore };
}

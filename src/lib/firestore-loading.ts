/**
 * The loading gate every realtime Firestore hook shares.
 *
 * Firestore fires every listener immediately with whatever the local cache
 * holds, *before* the server has answered. On a cold start over slow wifi that
 * first snapshot is empty — and settling on it is what flashes an empty screen
 * (KPI zeros, "No students found", "No drivers yet") that then fills in. It
 * reads as "the data is gone" when nothing has actually been fetched yet.
 *
 * So:
 * - a server read always settles (`fromCache === false`) — it is authoritative,
 *   even when it is legitimately empty;
 * - a cache read settles if it actually holds documents, because those are real
 *   rows and showing them immediately is the whole point of the offline cache;
 * - an *empty* cache read settles only when we are offline, where there is
 *   genuinely nothing left to wait for (otherwise the skeleton would never end).
 *
 * This assumes every gating listener passes `{ includeMetadataChanges: true }`.
 * Firestore suppresses metadata-only snapshots by default, so on a warm cache
 * that already holds a result the server's confirmation (same documents,
 * `fromCache: false`) is never delivered — and the skeleton then waits out the
 * full ceiling below instead of the ~300ms trip. (It did exactly that: a reload
 * with a warm cache showed the skeleton for 10.6s and looked "forced".)
 */
export function settlesLoading(fromCache: boolean, hasData: boolean): boolean {
  if (!fromCache) return true;
  if (hasData) return true;
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Ceiling on any hook's loading state.
 *
 * `settlesLoading` waits for a *server* snapshot — but Firestore retries a
 * failing connection indefinitely and never surfaces an error, so a black-holed
 * network (or a service worker eating the connection) leaves the skeletons up
 * forever. That is strictly worse than the empty flash this replaced, and it is
 * exactly what happened in production. After this long, settle anyway and show
 * whatever the cache holds, even if that is nothing.
 */
export const LOADING_SETTLE_TIMEOUT_MS = 10_000;

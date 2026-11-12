import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Timestamp,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { fetchSchoolId } from "@/lib/school-id";
import {
  EVENT_FAMILY,
  eventsInFamily,
  isKnownEvent,
  type AuditEntry,
  type AuditEvent,
  type AuditFamily,
} from "@/lib/audit";

/**
 * Reading the activity log.
 *
 * Two shapes, deliberately different:
 *
 *   - the LIST is cursor-paginated, newest first, because a year of a busy
 *     school is not something to load;
 *   - the COUNTS are exact aggregate queries per family, because a capped scan
 *     printed as a total is a lie, and the strip doubles as the filter.
 *
 * Every value is read defensively. An entry written by a build that is not this
 * one must still render — unreadable entries are skipped, never thrown.
 */

export interface ActivityRow {
  id: string;
  /** Null when this build does not know the event; `rawEvent` still has it. */
  event: AuditEvent | null;
  rawEvent: string;
  family: AuditFamily | null;
  at: Date | null;
  occurredAt: Date | null;
  actorUid: string;
  actorName: string;
  targetType: AuditEntry["targetType"];
  targetId: string | null;
  targetName: string | null;
  changes: AuditEntry["changes"];
  meta: AuditEntry["meta"];
  outcome: "success" | "failure";
  reason: string | null;
  source: AuditEntry["source"];
  schemaVersion: number;
}

function asDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function mapRow(snap: DocumentSnapshot): ActivityRow | null {
  const data = snap.data();
  if (!data) return null;
  const rawEvent = typeof data.event === "string" ? data.event : "";
  const known = isKnownEvent(rawEvent);
  const at = asDate(data.at);
  // An entry with no server timestamp cannot be placed on the timeline. The
  // API always writes one, so this is a corrupt document, not a normal state.
  if (!at) return null;

  return {
    id: snap.id,
    event: known ? rawEvent : null,
    rawEvent,
    family: known ? EVENT_FAMILY[rawEvent] : null,
    at,
    occurredAt: asDate(data.occurredAt),
    actorUid: typeof data.actorUid === "string" ? data.actorUid : "",
    actorName: typeof data.actorName === "string" ? data.actorName : "",
    targetType: (data.targetType ?? null) as AuditEntry["targetType"],
    targetId: typeof data.targetId === "string" ? data.targetId : null,
    targetName: typeof data.targetName === "string" ? data.targetName : null,
    changes: (data.changes ?? {}) as AuditEntry["changes"],
    meta: (data.meta ?? null) as AuditEntry["meta"],
    outcome: data.outcome === "failure" ? "failure" : "success",
    reason: typeof data.reason === "string" ? data.reason : null,
    source:
      data.source === "api" || data.source === "system" ? data.source : "client",
    schemaVersion: typeof data.schemaVersion === "number" ? data.schemaVersion : 0,
  };
}

const PAGE_SIZE = 50;

export interface ActivityFeed {
  rows: readonly ActivityRow[];
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export interface ActivityFeedOptions {
  from: Date;
  to: Date | null;
  family: AuditFamily | null;
  actorUid: string | null;
  enabled?: boolean;
}

export function useActivityFeed({
  from,
  to,
  family,
  actorUid,
  enabled = true,
}: ActivityFeedOptions): ActivityFeed {
  const { user } = useAuth();
  const uid = user?.uid;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);

  useEffect(() => {
    if (!enabled || !uid) return;
    let cancelled = false;
    void fetchSchoolId(uid).then((id) => {
      if (!cancelled) setSchoolId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, uid]);

  // One signature for "the query changed", so a page that arrives late cannot
  // append itself to a different filter's list.
  const signature = useMemo(
    () => [schoolId, from.getTime(), to?.getTime() ?? 0, family ?? "", actorUid ?? ""].join("|"),
    [schoolId, from, to, family, actorUid],
  );
  const signatureRef = useRef(signature);

  const buildQuery = useCallback(
    (firestore: Firestore, sid: string, after: DocumentSnapshot | null): Query => {
      const constraints: QueryConstraint[] = [where("at", ">=", Timestamp.fromDate(from))];
      if (to) constraints.push(where("at", "<", Timestamp.fromDate(to)));
      if (actorUid) constraints.push(where("actorUid", "==", actorUid));
      if (family) constraints.push(where("event", "in", eventsInFamily(family)));
      constraints.push(orderBy("at", "desc"), limit(PAGE_SIZE));
      if (after) constraints.push(startAfter(after));
      return query(collection(firestore, "schools", sid, "audit"), ...constraints);
    },
    [from, to, family, actorUid],
  );

  const load = useCallback(
    async (after: DocumentSnapshot | null) => {
      const firestore = db;
      if (!firestore || !schoolId) return;
      setLoading(true);
      setError(false);
      const forSignature = signature;
      try {
        const snap = await getDocs(buildQuery(firestore, schoolId, after));
        if (signatureRef.current !== forSignature) return;
        const page = snap.docs.map(mapRow).filter((r): r is ActivityRow => r !== null);
        setRows((prev) => (after ? [...prev, ...page] : page));
        setCursor(snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } catch {
        if (signatureRef.current === forSignature) setError(true);
      } finally {
        if (signatureRef.current === forSignature) setLoading(false);
      }
    },
    [buildQuery, schoolId, signature],
  );

  useEffect(() => {
    if (!enabled || !schoolId) return;
    signatureRef.current = signature;
    setRows([]);
    setCursor(null);
    setHasMore(false);
    void load(null);
    // `load` changes with the signature, which is the real trigger.
  }, [enabled, schoolId, signature, load]);

  return {
    rows,
    loading,
    error,
    hasMore,
    loadMore: () => {
      if (cursor && !loading) void load(cursor);
    },
  };
}

/** Exact counts per family for the window, plus the total. Null while unknown. */
export function useActivityCounts(options: {
  from: Date;
  to: Date | null;
  actorUid: string | null;
  enabled?: boolean;
}): { counts: Record<AuditFamily, number> | null; loading: boolean } {
  const { from, to, actorUid, enabled = true } = options;
  const { user } = useAuth();
  const uid = user?.uid;
  const [counts, setCounts] = useState<Record<AuditFamily, number> | null>(null);
  const [loading, setLoading] = useState(false);

  const fromMs = from.getTime();
  const toMs = to?.getTime() ?? 0;

  useEffect(() => {
    if (!enabled || !uid) return;
    let cancelled = false;
    setLoading(true);
    setCounts(null);

    void (async () => {
      const firestore = db;
      if (!firestore) return;
      const schoolId = await fetchSchoolId(uid);
      if (!schoolId || cancelled) return;
      const families: AuditFamily[] = ["access", "student", "roll", "settings"];
      try {
        const results = await Promise.all(
          families.map((family) => {
            const filters: QueryConstraint[] = [
              where("at", ">=", Timestamp.fromDate(new Date(fromMs))),
              where("event", "in", eventsInFamily(family)),
            ];
            if (toMs) filters.push(where("at", "<", Timestamp.fromDate(new Date(toMs))));
            if (actorUid) filters.push(where("actorUid", "==", actorUid));
            return getCountFromServer(
              query(collection(firestore, "schools", schoolId, "audit"), ...filters),
            );
          }),
        );
        if (cancelled) return;
        setCounts({
          access: results[0].data().count,
          student: results[1].data().count,
          roll: results[2].data().count,
          settings: results[3].data().count,
        });
      } catch {
        // Counts need the network and an index. An offline director still needs
        // the list, so the strip simply goes away rather than lying with zeros.
        if (!cancelled) setCounts(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, uid, fromMs, toMs, actorUid]);

  return { counts, loading };
}

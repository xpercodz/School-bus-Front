import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { fetchSchoolId } from "@/lib/school-id";
import { LOADING_SETTLE_TIMEOUT_MS, settlesLoading } from "@/lib/firestore-loading";
import { useCursorPage } from "@/lib/use-cursor-page";
import type { OperatorScreen } from "@/lib/api-contract";
import { queueAudit } from "@/lib/audit";


/**
 * Director-only data access for the Assignments page: realtime buses + staff
 * users, cursor-paginated students, and the write helpers that link drivers and
 * students to buses. All data lives under the signed-in director's school.
 */

export interface AdminBus {
  id: string;
  name: string;
  driver: string;
  driverUid: string | null;
}

/**
 * Realtime buses of the school. Mirrors the bus listener in `useDashboardData`
 * but also exposes `driverUid` so Assignments can edit the driver link.
 * `loading` is true until the first snapshot lands for this user.
 */
export function useBuses(): { buses: AdminBus[]; loading: boolean } {
  const { user } = useAuth();
  const uid = user?.uid;
  const [buses, setBuses] = useState<AdminBus[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const loading = !!uid && loadedUid !== uid;

  useEffect(() => {
    if (!uid || !db) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setLoadedUid(uid);
        return;
      }
      unsubscribers.push(
        onSnapshot(
          query(collection(firestore, "schools", schoolId, "buses"), orderBy("name")),
          (snap) => {
            if (cancelled) return;
            setBuses(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  name: (data.name as string) ?? "",
                  driver: (data.driver as string) ?? "",
                  driverUid: (data.driverUid as string | null) ?? null,
                };
              }),
            );
            setLoadedUid(uid);
          },
          () => {
            if (!cancelled) setLoadedUid(uid);
          },
        ),
      );
    });

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
    };
  }, [uid]);

  return { buses, loading };
}

export interface StaffUser {
  uid: string;
  displayName: string;
  email: string;
}

/**
 * Realtime staff (bus monitor/driver) users of the school — `users where
 * schoolId == X`, role-filtered client-side to avoid a composite index. Small
 * reference data, so no pagination (the <100 docs exception to the
 * always-paginate rule). Rules grant this read only to a director, or to an
 * operator holding the Assignments or Drivers screen.
 */
export interface StaffUsers {
  staff: StaffUser[];
  /** True until the first staff snapshot lands for this user. */
  loading: boolean;
}

/**
 * Realtime staff (bus monitor/driver) users of the school — `users where
 * schoolId == X`, role-filtered client-side to avoid a composite index. Small
 * reference data, so no pagination (the <100 docs exception to the
 * always-paginate rule). Rules grant this read only to a director, or to an
 * operator holding the Assignments or Drivers screen.
 *
 * `loading` exists so a page can hold its skeleton until the list is real: a
 * page gated only on buses used to flash "No drivers yet" for the gap between
 * the two snapshots.
 */
export function useStaffUsers(): StaffUsers {
  const { user } = useAuth();
  const uid = user?.uid;
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const loading = !!uid && loadedUid !== uid;

  useEffect(() => {
    if (!uid || !db) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];
    // Ceiling: a dead listener must not hold the skeleton forever.
    const settleTimer = setTimeout(() => setLoadedUid(uid), LOADING_SETTLE_TIMEOUT_MS);

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setLoadedUid(uid);
        return;
      }
      unsubscribers.push(
        onSnapshot(
          query(collection(firestore, "users"), where("schoolId", "==", schoolId)),
          // See `settlesLoading`: a cold cache emits an empty snapshot first,
          // and settling on it flashed "No drivers yet" before the server
          // answered. Metadata changes are required for the server confirmation
          // on a warm cache, which holds the same documents.
          { includeMetadataChanges: true },
          (snap) => {
            if (cancelled) return;
            setStaff(
              snap.docs
                .filter((d) => d.data().role === "staff")
                .map((d) => ({
                  uid: d.id,
                  displayName: (d.data().displayName as string) ?? "",
                  email: (d.data().email as string) ?? "",
                })),
            );
            // Not on an empty cache read — see settlesLoading.
            if (settlesLoading(snap.metadata.fromCache, snap.size > 0)) {
              setLoadedUid(uid);
            }
          },
          () => {
            // Ignore: sign-out denies every open listener before React unmounts
            // them — nothing to settle on this path.
            if (!cancelled) setLoadedUid(uid);
          },
        ),
      );
    });

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      unsubscribers.forEach((u) => u());
    };
  }, [uid]);

  return { staff, loading };
}

/**
 * A management member of the school: a director or an operator. Drivers are
 * excluded — they are not part of the team lists, and they sign in by code.
 */
export interface TeamMember {
  uid: string;
  displayName: string;
  email: string;
  role: "director" | "operator";
  /** Director-only: the main director, who may administer operators. */
  owner: boolean;
  /** Operator-only: the screens they may open. */
  screens: OperatorScreen[];
}

export interface SchoolTeam {
  team: TeamMember[];
  /** True until the first team snapshot lands for this user. */
  loading: boolean;
}

/**
 * Realtime directors + operators of the school (`users where schoolId == X`,
 * drivers filtered out client-side to avoid a composite index). Small reference
 * data — a school has a handful of office staff — so no pagination.
 *
 * Used by the Operators page, and by `useMainDirector` to answer "is this the
 * school's only director?" — the fallback that lets the Operators row appear
 * without first running the `owner` script. Pass `enabled: false` when the
 * answer is already known, so a flagged director opens no listener.
 */
export function useSchoolTeam(enabled = true): SchoolTeam {
  const { user } = useAuth();
  const uid = user?.uid;
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  // A caller that already knows the answer (a director carrying `owner`) passes
  // `enabled: false` and pays for no listener at all.
  const loading = enabled && !!uid && loadedUid !== uid;

  useEffect(() => {
    if (!enabled || !uid || !db) return;
    const firestore = db;
    let cancelled = false;
    let unsubscribe = () => {};
    // Ceiling: a dead listener must not hold the skeleton forever.
    const settleTimer = setTimeout(() => setLoadedUid(uid), LOADING_SETTLE_TIMEOUT_MS);

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setLoadedUid(uid);
        return;
      }
      unsubscribe = onSnapshot(
        query(collection(firestore, "users"), where("schoolId", "==", schoolId)),
        { includeMetadataChanges: true },
        (snap) => {
          if (cancelled) return;
          setTeam(
            snap.docs
              .filter((d) => d.data().role === "director" || d.data().role === "operator")
              .map((d) => ({
                uid: d.id,
                displayName: (d.data().displayName as string) ?? "",
                email: (d.data().email as string) ?? "",
                role: d.data().role === "operator" ? "operator" : "director",
                owner: d.data().owner === true,
                screens: Array.isArray(d.data().screens)
                  ? (d.data().screens as unknown[]).filter(
                      (screen): screen is OperatorScreen => typeof screen === "string",
                    )
                  : [],
              })),
          );
          if (settlesLoading(snap.metadata.fromCache, snap.size > 0)) {
            setLoadedUid(uid);
          }
        },
        () => {
          if (!cancelled) setLoadedUid(uid);
        },
      );
    });

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      unsubscribe();
    };
  }, [enabled, uid]);

  return { team, loading };
}

/**
 * Realtime driver access-code docs of the school — `schools/{schoolId}/driverCodes`,
 * mapped `{ [driverUid]: code }` where `code` is the doc's legacy plaintext
 * `code` field. Codes are now stored hashed (`codeHash` only, plaintext shown
 * once at create/regenerate), so such docs map to "" and the UI falls back to
 * the regenerate affordance. Director-only per rules (drivers must not read
 * each other's codes). Small reference data (one doc per staff account), so no
 * pagination.
 */
export function useDriverCodes(): Record<string, string> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [codes, setCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!uid || !db) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled || !schoolId) return;
      unsubscribers.push(
        onSnapshot(
          collection(firestore, "schools", schoolId, "driverCodes"),
          (snap) => {
            if (cancelled) return;
            const next: Record<string, string> = {};
            snap.docs.forEach((d) => {
              next[d.id] = (d.data().code as string) ?? "";
            });
            setCodes(next);
          },
          // Ignore: sign-out denies every open listener before React unmounts them.
          () => {},
        ),
      );
    });

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
    };
  }, [uid]);

  return codes;
}

export interface AdminStudent {
  id: string;
  name: string;
  grade: string;
  busId: string | null;
}

export interface StudentsState {
  students: readonly AdminStudent[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Client-side name search over the rows loaded so far. */
  search: string;
  setSearch: (q: string) => void;
}

const STUDENT_PAGE_SIZE = 50;

function toAdminStudent(d: DocumentSnapshot): AdminStudent {
  const data = d.data() ?? {};
  return {
    id: d.id,
    name: (data.name as string) ?? "",
    grade: (data.grade as string) ?? "",
    busId: (data.busId as string | null) ?? null,
  };
}

/**
 * Every student in the school, for the sheet importer.
 *
 * The Assignments table is a cursor page (50 at a time) because a director
 * reads it a page at a time — but an import must match the WHOLE roll, or every
 * child past the loaded pages is reported as "no student" and silently skipped.
 * Pages through the same query the table uses.
 */
export async function fetchAllStudents(uid: string): Promise<AdminStudent[]> {
  if (!db || !uid) return [];
  const schoolId = await fetchSchoolId(uid);
  if (!schoolId) return [];
  const firestore = db;
  const all: AdminStudent[] = [];
  let cursor: DocumentSnapshot | null = null;
  // Bounded: 20 pages of 500 is 10,000 children — far beyond any one school, and
  // a runaway loop here would be a hung import.
  for (let page = 0; page < 20; page += 1) {
    const clauses = [orderBy("name"), limit(500)] as const;
    const snap: QuerySnapshot = await getDocs(
      query(
        collection(firestore, "schools", schoolId, "students"),
        ...clauses,
        ...(cursor ? [startAfter(cursor)] : []),
      ),
    );
    all.push(...snap.docs.map(toAdminStudent));
    if (snap.size < 500) break;
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (!cursor) break;
  }
  return all;
}

/**
 * Cursor-paginated students of the school — `orderBy name`, `startAfter` "Load
 * more" (the always-paginate rule), with a client-side name search over the
 * rows loaded so far.
 *
 * `refreshKey` re-runs the first page. It is opt-in because this list is a
 * one-shot read: a caller bumps it only when the documents themselves changed
 * outside this screen (a sheet import), never after a single move — a `getDocs`
 * fired straight after that write can still return the pre-write document.
 */
export function useStudentsPaginated(refreshKey = 0): StudentsState {
  const [search, setSearch] = useState("");
  const { items, loading, hasMore, loadMore } = useCursorPage<AdminStudent>({
    pageSize: STUDENT_PAGE_SIZE,
    deps: [refreshKey],
    buildQuery: (firestore, schoolId, cursor) => {
      const base = query(
        collection(firestore, "schools", schoolId, "students"),
        orderBy("name"),
      );
      return cursor ? query(base, startAfter(cursor)) : base;
    },
    mapItem: toAdminStudent,
  });

  return { students: items, loading, hasMore, loadMore, search, setSearch };
}

/**
 * Per-bus assigned-student counts (for the Drivers table). Server-side count
 * queries (`getCountFromServer`) — no docs transferred, no pagination needed.
 * Re-queries when the bus set changes or `refreshKey` bumps (after a student
 * reassignment).
 */
export function useBusStudentCounts(
  buses: readonly AdminBus[],
  refreshKey: number,
): Record<string, number> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const busIdsKey = buses.map((b) => b.id).join("|");

  useEffect(() => {
    if (!uid || !db || !busIdsKey) return;
    const firestore = db;
    const busIds = busIdsKey.split("|");
    let cancelled = false;
    void fetchSchoolId(uid).then(async (schoolId) => {
      if (cancelled || !schoolId) return;
      const next: Record<string, number> = {};
      for (const id of busIds) {
        if (cancelled) return;
        try {
          const snap = await getCountFromServer(
            query(
              collection(firestore, "schools", schoolId, "students"),
              where("busId", "==", id),
            ),
          );
          next[id] = snap.data().count;
        } catch {
          next[id] = 0;
        }
      }
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, busIdsKey, refreshKey]);

  return counts;
}

/**
 * Assign a staff user to drive a bus (or clear it). Keeps the denormalized
 * `driver` name copy in sync with the user's displayName and clears the
 * driver's previous bus in the same atomic batch (1 driver per bus).
 */
export async function assignDriverToBus(
  uid: string,
  busId: string,
  driverUid: string | null,
  driverName: string,
  prevBusId: string | null,
  fromDriverName: string | null = null,
): Promise<void> {
  if (!db || !uid) return;
  const schoolId = await fetchSchoolId(uid);
  if (!schoolId) return;
  const firestore = db;
  const occurredAt = new Date();
  const stamp = { updatedBy: uid, updatedAt: serverTimestamp() };
  const batch = writeBatch(firestore);
  if (prevBusId && prevBusId !== busId) {
    batch.update(doc(firestore, "schools", schoolId, "buses", prevBusId), {
      driverUid: null,
      driver: "",
      ...stamp,
    });
  }
  batch.update(doc(firestore, "schools", schoolId, "buses", busId), {
    driverUid,
    driver: driverName,
    ...stamp,
  });
  // One action touching two documents is one entry: the driver's old bus being
  // cleared is part of the same decision, not a second one.
  queueAudit(batch, firestore, schoolId, {
    event: "bus.driver_changed",
    targetType: "bus",
    targetId: busId,
    changes: { driver: { from: fromDriverName, to: driverName || null } },
    meta: { busId },
    occurredAt,
  });
  await batch.commit();
}

/**
 * Move a student to a different bus (or clear it with null). Applies to future
 * runs — attendance docs are snapshotted per run.
 */
export async function assignStudentToBus(
  uid: string,
  studentId: string,
  busId: string | null,
  fromBusId: string | null = null,
): Promise<void> {
  if (!db || !uid) return;
  const schoolId = await fetchSchoolId(uid);
  if (!schoolId) return;
  const firestore = db;
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "schools", schoolId, "students", studentId),
    { busId, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
  queueAudit(batch, firestore, schoolId, {
    event: "student.bus_changed",
    targetType: "student",
    targetId: studentId,
    changes: { busId: { from: fromBusId, to: busId } },
    meta: { busId: busId ?? "" },
    occurredAt: new Date(),
  });
  await batch.commit();
}

/**
 * Driver account creation and code rotation are privileged: Firebase Auth users
 * and `users` profiles are Admin-SDK-only, and global code uniqueness is
 * enforced server-side. Both therefore live in the School-bus-API and are
 * re-exported here so the Drivers page keeps a single import site for
 * director-admin actions.
 */
export { createDriver, regenerateDriverCode } from "@/lib/api";

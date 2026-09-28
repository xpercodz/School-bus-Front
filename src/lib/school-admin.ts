import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { fetchSchoolId } from "@/lib/school-id";
import { useCursorPage } from "@/lib/use-cursor-page";


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
 * always-paginate rule). The page is director-only, and rules already let any
 * signed-in user read profiles.
 */
export function useStaffUsers(): StaffUser[] {
  const { user } = useAuth();
  const uid = user?.uid;
  const [staff, setStaff] = useState<StaffUser[]>([]);

  useEffect(() => {
    if (!uid || !db) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled || !schoolId) return;
      unsubscribers.push(
        onSnapshot(
          query(collection(firestore, "users"), where("schoolId", "==", schoolId)),
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

  return staff;
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
 * Cursor-paginated students of the school — `orderBy name`, `startAfter` "Load
 * more" (the always-paginate rule), with a client-side name search over the
 * rows loaded so far.
 */
export function useStudentsPaginated(): StudentsState {
  const [search, setSearch] = useState("");
  const { items, loading, hasMore, loadMore } = useCursorPage<AdminStudent>({
    pageSize: STUDENT_PAGE_SIZE,
    deps: [],
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
): Promise<void> {
  if (!db || !uid) return;
  const schoolId = await fetchSchoolId(uid);
  if (!schoolId) return;
  const firestore = db;
  const batch = writeBatch(firestore);
  if (prevBusId && prevBusId !== busId) {
    batch.update(doc(firestore, "schools", schoolId, "buses", prevBusId), {
      driverUid: null,
      driver: "",
    });
  }
  batch.update(doc(firestore, "schools", schoolId, "buses", busId), {
    driverUid,
    driver: driverName,
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
): Promise<void> {
  if (!db || !uid) return;
  const schoolId = await fetchSchoolId(uid);
  if (!schoolId) return;
  await setDoc(doc(db, "schools", schoolId, "students", studentId), { busId }, { merge: true });
}

/**
 * Driver account creation and code rotation are privileged: Firebase Auth users
 * and `users` profiles are Admin-SDK-only, and global code uniqueness is
 * enforced server-side. Both therefore live in the School-bus-API and are
 * re-exported here so the Drivers page keeps a single import site for
 * director-admin actions.
 */
export { createDriver, regenerateDriverCode } from "@/lib/api";

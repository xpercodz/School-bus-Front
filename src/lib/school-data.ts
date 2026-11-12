import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
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
  type FieldValue,
  type Query,
  type QuerySnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { LOADING_SETTLE_TIMEOUT_MS, settlesLoading } from "@/lib/firestore-loading";
import type { Student, StudentStatus } from "@/data/students";
import { STATUS_CYCLE } from "@/data/students";
import {
  type AttendanceRow,
  type Bus,
  type DashboardSummary,
  type KPI,
  type RollSummary,
  type RunSegmentId,
} from "@/data/dashboard";
import { useLocale } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/config";
import { formatTime, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

import { fetchSchoolId } from "@/lib/school-id";
import { queueAudit } from "@/lib/audit";

/** The mobile roster is always the morning run (by design); the bus comes from the user's assignment. */
const ROSTER_RUN_TYPE = "morning";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Local "YYYY-MM-DD" — the app's date key (document `date` field, run ids). */
export function todayDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Deterministic run id: `${busId}-${YYYY-MM-DD}-${runType}`. */
export function buildRunId(busId: string, dateStr: string, runType: string): string {
  return `${busId}-${dateStr}-${runType}`;
}

/**
 * Run type from a run id — the last `-` token. Dates contain `-`; run types
 * ("morning" / "afternoon") never do.
 */
function runTypeFromRunId(runId: string): "morning" | "afternoon" {
  return runId.split("-").at(-1) === "afternoon" ? "afternoon" : "morning";
}

/** Build dashboard KPI cells from the same counts the summary uses. */
function countByStatus(rows: AttendanceDoc[], status: StudentStatus): number {
  return rows.filter((row) => row.status === status).length;
}

interface AttendanceDoc {
  id: string;
  runId: string;
  busId: string;
  busName: string;
  studentName: string;
  grade: string;
  status: StudentStatus;
  boardedAt: Timestamp | null;
  droppedOffAt: Timestamp | null;
}

/**
 * 1-based ordinal of each attendance doc by a timestamp field, ascending across
 * the whole date (not per bus): the dashboard's "drop-off order" is the order
 * the children actually reached their stop that run, whichever bus took them.
 * Docs with no timestamp are left unranked (=> `null` on the row).
 */
function ordinalByTimestamp(
  rows: readonly AttendanceDoc[],
  pick: (row: AttendanceDoc) => Timestamp | null,
): Map<string, number> {
  const ranked: { id: string; at: Timestamp }[] = [];
  for (const row of rows) {
    const at = pick(row);
    // A pending `serverTimestamp()` reads back as null until the server ack,
    // so it is simply unranked rather than ordered as 1970.
    if (at) ranked.push({ id: row.id, at });
  }
  ranked.sort((a, b) => a.at.toMillis() - b.at.toMillis());
  return new Map(ranked.map((entry, index) => [entry.id, index + 1]));
}

interface BusDoc {
  id: string;
  name: string;
  driver: string;
}

interface RunDoc {
  id: string;
  busId: string;
  status: "IN_PROGRESS" | "COMPLETED";
}

/** True when we can read live Firestore data (configured + signed in). */
function useLiveFlag(): boolean {
  const { user, status } = useAuth();
  return isFirebaseConfigured && status === "ready" && !!user && !!db;
}

// ── mobile roster ────────────────────────────────────────────────────────────

interface DriverBus {
  /** The signed-in driver's bus id, or null when they aren't linked to one. */
  busId: string | null;
  loading: boolean;
}

/**
 * Realtime bus id for the signed-in staff user — `buses where driverUid == uid`.
 * One driver is assigned to one bus (enforced client-side in Assignments), so
 * the query needs no orderBy (single-field equality — no composite index) and
 * just takes the first match. `loading` is true until the query resolves for
 * this user.
 */
function useDriverBus(): DriverBus {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;

  const [busId, setBusId] = useState<string | null>(null);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const loading = live && loadedUid !== uid;

  useEffect(() => {
    if (!live || !uid || !db) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];
    // Ceiling: never leave the skeleton up forever.
    const settleTimer = setTimeout(() => setLoadedUid(uid), LOADING_SETTLE_TIMEOUT_MS);

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setBusId(null);
        setLoadedUid(uid);
        return;
      }
      unsubscribers.push(
        onSnapshot(
          query(
            collection(firestore, "schools", schoolId, "buses"),
            where("driverUid", "==", uid),
          ),
          // Metadata-only updates are suppressed by default, so a warm cache
          // that already holds this query never reports `fromCache === false`
          // when the server confirms the same (e.g. empty) result. The gate
          // below waits for exactly that, and used to burn its full 10s ceiling
          // on every reload. Ask for metadata changes so the confirmation is
          // delivered.
          { includeMetadataChanges: true },
          (snap) => {
            if (cancelled) return;
            setBusId(snap.docs[0]?.id ?? null);
            // Not on an empty cache read — see settlesLoading.
            if (settlesLoading(snap.metadata.fromCache, snap.size > 0)) {
              setLoadedUid(uid);
            }
          },
          () => {
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
  }, [live, uid]);

  return { busId, loading };
}

export interface RunRoster {
  roster: readonly Student[];
  loading: boolean;
  live: boolean;
  /** Advance a student's status — writes the new status to Firestore. */
  cycleStatus: (id: string) => void;
  /** True when the current run is marked COMPLETED. */
  completed: boolean;
  /** Live run status for the run-details sheet. */
  runStatus: "IN_PROGRESS" | "COMPLETED";
  /** Whether a run doc exists for this bus/date/type. */
  runExists: boolean;
  /** Static identity of the run the roster shows (for the run-details sheet). busId is "" when the user has no bus. */
  runMeta: { busId: string; runType: string; date: string };
  /** Complete the run: mark it COMPLETED and any WAITING students ABSENT. */
  completeRun: () => Promise<void>;
  /** Set a student's status to ABSENT directly (kebab-menu shortcut). */
  markAbsent: (id: string) => void;
  /**
   * True when the last tap could not be written — a refusal from the rules, or
   * no connection. The roster itself gives no signal, so the page must say so.
   */
  writeFailed: boolean;
}

export function useRunRoster(): RunRoster {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;
  const { busId, loading: busLoading } = useDriverBus();

  const [roster, setRoster] = useState<readonly Student[]>([]);
  const [runStatus, setRunStatus] = useState<RunDoc["status"]>("IN_PROGRESS");
  const [runExists, setRunExists] = useState(false);
  /**
   * True when a tap could not be recorded. Both writes are now `await`ed
   * because the rules refuse an unstamped roster write, and a refusal used to
   * vanish silently — the roster simply did not change and the driver had no
   * way to know a child's record was lost. Resets on the next success.
   */
  const [writeFailed, setWriteFailed] = useState(false);
  // loading = live && the bus/roster snapshot hasn't landed for this key yet.
  // The key includes busId so a live driver reassignment re-shows the skeleton
  // until the new bus's roster arrives (never a stale bus's students).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${uid ?? ""}|${busId ?? ""}`;
  const loading = live && (busLoading || loadedKey !== key);

  useEffect(() => {
    if (!live || !uid || !db) return;
    if (busLoading) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];
    const effectKey = `${uid}|${busId ?? ""}`;
    // Ceiling: never leave the skeleton up forever.
    const settleTimer = setTimeout(() => setLoadedKey(effectKey), LOADING_SETTLE_TIMEOUT_MS);

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId || !busId) {
        // No school, or this user isn't assigned to a bus — no roster to show.
        setRoster([]);
        setRunExists(false);
        setLoadedKey(effectKey);
        return;
      }
      const runId = buildRunId(busId, todayDateStr(), ROSTER_RUN_TYPE);
      const attQuery = query(
        collection(firestore, "schools", schoolId, "attendance"),
        where("runId", "==", runId),
      );
      unsubscribers.push(
        onSnapshot(
          attQuery,
          // See settlesLoading + useDriverBus: without metadata changes a warm
          // empty cache never reports the server confirmation, and the skeleton
          // waits out the whole settle ceiling.
          { includeMetadataChanges: true },
          (snap) => {
            const list: Student[] = snap.docs
              .map((d) => {
                const data = d.data();
                // Doc id is `${runId}__${studentId}` — keep only the student id so
                // writes (cycleStatus/markAbsent/completeRun) land on the right doc.
                return {
                  id: d.id.split("__").at(-1) ?? d.id,
                  name: (data.studentName as string) ?? "",
                  grade: (data.grade as string) ?? "",
                  status: (data.status as StudentStatus) ?? "WAITING",
                };
              })
              .sort((a, b) => a.name.localeCompare(b.name));
            setRoster(list);
            // Not on an empty cache read — see settlesLoading.
            if (settlesLoading(snap.metadata.fromCache, snap.size > 0)) {
              setLoadedKey(effectKey);
            }
          },
          () => setLoadedKey(effectKey),
        ),
      );
      unsubscribers.push(
        onSnapshot(
          doc(firestore, "schools", schoolId, "runs", runId),
          (snap) => {
            setRunExists(snap.exists());
            setRunStatus((snap.data()?.status as RunDoc["status"]) ?? "IN_PROGRESS");
          },
          () => {
            // Ignore: sign-out denies every open listener before React unmounts
            // them — nothing to settle on this path.
          },
        ),
      );
    });

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      unsubscribers.forEach((u) => u());
    };
  }, [live, uid, busId, busLoading]);

  function cycleStatus(id: string) {
    // Completed runs are locked — no status changes after sign-off.
    if (!live || !uid || !db || !busId || runStatus === "COMPLETED") return;
    const firestore = db;
    const current = roster.find((s) => s.id === id);
    if (!current) return;
    // The device clock at the moment of the press. It is untrusted, and it is
    // the only record of when a tap happened on a bus with no signal — the
    // server only learns the sync time.
    const occurredAt = new Date();
    const next =
      STATUS_CYCLE[(STATUS_CYCLE.indexOf(current.status) + 1) % STATUS_CYCLE.length];
    void fetchSchoolId(uid).then(async (schoolId) => {
      if (!schoolId) return;
      const runId = buildRunId(busId, todayDateStr(), ROSTER_RUN_TYPE);
      // Record boarding/drop-off timestamps so the dashboard columns populate,
      // and clear the one that no longer applies when the driver cycles back.
      // Without this, a row that went BOARDED → WAITING would keep a stale
      // "Board at" time on the dashboard.
      const patch: {
        status: StudentStatus;
        boardedAt?: FieldValue | null;
        droppedOffAt?: FieldValue | null;
        updatedBy: string;
        updatedAt: FieldValue;
      } = {
        status: next,
        // Provenance is mandatory: `firestore.rules` refuses a roster write that
        // does not carry who made it and the server's clock.
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      };
      if (next === "BOARDED") {
        patch.boardedAt = serverTimestamp();
        patch.droppedOffAt = null;
      } else if (next === "DROPPED_OFF") {
        patch.droppedOffAt = serverTimestamp();
      } else {
        patch.boardedAt = null;
        patch.droppedOffAt = null;
      }
      // The change and its log entry commit together or not at all. A queued tap
      // that synced an hour later keeps `occurredAt` as the moment of the press.
      const batch = writeBatch(firestore);
      batch.set(
        doc(firestore, "schools", schoolId, "attendance", `${runId}__${id}`),
        patch,
        { merge: true },
      );
      queueAudit(batch, firestore, schoolId, {
        event: "attendance.changed",
        targetType: "student",
        targetId: id,
        changes: { status: { from: current.status, to: next } },
        meta: { runId, busId },
        occurredAt,
      });
      await batch.commit();
      setWriteFailed(false);
    }).catch(() => setWriteFailed(true));
  }

  async function completeRun(): Promise<void> {
    if (!live || !uid || !db || !busId) return;
    const firestore = db;
    const schoolId = await fetchSchoolId(uid);
    if (!schoolId) return;
    const occurredAt = new Date();
    const runId = buildRunId(busId, todayDateStr(), ROSTER_RUN_TYPE);
    // Atomic: complete the run and mark waiting students absent together. Write
    // the full run fields so a missing run doc (fresh day) isn't created partial.
    const batch = writeBatch(firestore);
    const stamp = { updatedBy: uid, updatedAt: serverTimestamp() };
    batch.set(
      doc(firestore, "schools", schoolId, "runs", runId),
      {
        busId,
        runType: ROSTER_RUN_TYPE,
        date: todayDateStr(),
        status: "COMPLETED",
        ...stamp,
      },
      { merge: true },
    );
    let markedAbsent = 0;
    for (const student of roster) {
      if (student.status === "WAITING") {
        batch.set(
          doc(firestore, "schools", schoolId, "attendance", `${runId}__${student.id}`),
          { status: "ABSENT", ...stamp },
          { merge: true },
        );
        markedAbsent += 1;
      }
    }
    // One entry for one action. Forty orphan "marked absent" rows cannot be told
    // apart from forty human decisions.
    queueAudit(batch, firestore, schoolId, {
      event: "run.completed",
      targetType: "run",
      targetId: runId,
      meta: { runId, busId, count: markedAbsent, date: todayDateStr() },
      occurredAt,
    });
    await batch.commit();
  }

  function markAbsent(id: string) {
    if (!live || !uid || !db || !busId || runStatus === "COMPLETED") return;
    const firestore = db;
    const current = roster.find((s) => s.id === id);
    const occurredAt = new Date();
    void fetchSchoolId(uid).then(async (schoolId) => {
      if (!schoolId) return;
      const runId = buildRunId(busId, todayDateStr(), ROSTER_RUN_TYPE);
      const batch = writeBatch(firestore);
      batch.set(
        doc(firestore, "schools", schoolId, "attendance", `${runId}__${id}`),
        // A correction to "absent" must not leave a boarded/dropped time
        // behind: the roster and the dashboard columns would contradict it.
        {
          status: "ABSENT",
          boardedAt: null,
          droppedOffAt: null,
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      queueAudit(batch, firestore, schoolId, {
        event: "attendance.changed",
        targetType: "student",
        targetId: id,
        changes: { status: { from: current?.status ?? null, to: "ABSENT" } },
        meta: { runId, busId },
        occurredAt,
      });
      await batch.commit();
      setWriteFailed(false);
    }).catch(() => setWriteFailed(true));
  }

  return {
    roster,
    loading,
    live,
    cycleStatus,
    completed: runStatus === "COMPLETED",
    runStatus,
    runExists,
    runMeta: {
      busId: busId ?? "",
      runType: ROSTER_RUN_TYPE,
      date: todayDateStr(),
    },
    completeRun,
    markAbsent,
    writeFailed,
  };
}

// ── school roll + presence summary ──────────────────────────────────────────

/** Presence window for the roll: the app's retention horizon, in days. */
export const ROLL_SUMMARY_DAYS = 90;

export interface RollStudent {
  id: string;
  name: string;
  grade: string;
  busId: string | null;
  /** Resolved display name of the assigned bus; "" when unassigned. */
  bus: string;
}

export interface SchoolRoll {
  students: readonly RollStudent[];
  loading: boolean;
  live: boolean;
}

export interface RollSummaryState {
  byStudentId: ReadonlyMap<string, RollSummary>;
  loading: boolean;
}

/** A roster doc before its bus name is resolved in the memo. */
interface RollDoc {
  id: string;
  name: string;
  grade: string;
  busId: string | null;
}

const EMPTY_ROLL: readonly RollStudent[] = [];
const EMPTY_ROLL_SUMMARIES: ReadonlyMap<string, RollSummary> = new Map();

/**
 * Every student on the school roll, with the display name of their bus.
 *
 * This reads the `students` collection, not today's attendance: the screen with
 * no date picked answers "who is on the roll?", so a child with no run that day
 * must still be listed. Today's attendance is a different question, asked by
 * `useDashboardData` when a date is picked.
 *
 * No `orderBy` on the students query: Firestore leaves a doc without the ordered
 * field out of the result entirely, so a student whose `name` failed to save
 * would silently vanish from the roll. Sorting happens in the memo instead.
 *
 * The bus name is resolved there too — never in a snapshot callback — so a buses
 * snapshot that lands after the students one still fixes every row's name
 * rather than baking in "" for the ones mapped first.
 */
export function useSchoolRoll(): SchoolRoll {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;

  const [docs, setDocs] = useState<readonly RollDoc[]>([]);
  const [busNames, setBusNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const loading = live && loadedUid !== uid;

  useEffect(() => {
    if (!live || !uid || !db) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];
    // Ceiling: never leave the skeleton up forever.
    const settleTimer = setTimeout(() => setLoadedUid(uid), LOADING_SETTLE_TIMEOUT_MS);

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setDocs([]);
        setBusNames(new Map());
        setLoadedUid(uid);
        return;
      }
      const base = `schools/${schoolId}`;

      unsubscribers.push(
        onSnapshot(
          collection(firestore, base, "students"),
          // See settlesLoading + useDriverBus: without metadata changes a warm
          // cache never reports the server confirmation, and the skeleton waits
          // out the whole settle ceiling.
          { includeMetadataChanges: true },
          (snap) => {
            if (cancelled) return;
            setDocs(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  name: (data.name as string) ?? "",
                  grade: (data.grade as string) ?? "",
                  busId: (data.busId as string | null) ?? null,
                };
              }),
            );
            // Not on an empty cache read — see settlesLoading.
            if (settlesLoading(snap.metadata.fromCache, snap.size > 0)) {
              setLoadedUid(uid);
            }
          },
          // Ignore: sign-out denies every open listener before React unmounts
          // them — nothing to settle on this path.
          () => {},
        ),
      );

      // Buses are a name lookup for the students above; they never gate loading
      // on their own (a school with no buses is a complete answer, and the memo
      // simply leaves `bus` empty).
      unsubscribers.push(
        onSnapshot(
          collection(firestore, base, "buses"),
          (snap) => {
            if (cancelled) return;
            setBusNames(
              new Map(snap.docs.map((d) => [d.id, (d.data().name as string) ?? ""])),
            );
          },
          // Ignore: sign-out denies every open listener before React unmounts them.
          () => {},
        ),
      );
    });

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      unsubscribers.forEach((u) => u());
    };
  }, [live, uid]);

  const students = useMemo<readonly RollStudent[]>(() => {
    if (!live) return EMPTY_ROLL;
    return docs
      .map((d) => ({
        ...d,
        bus: d.busId ? busNames.get(d.busId) ?? "" : "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [live, docs, busNames]);

  return { students, loading, live };
}

const ROLL_PAGE_SIZE = 500;
/**
 * Hard ceiling on one roll read: 40 pages of 500 docs = 20,000 attendance
 * records. At two runs a day that is ~100 days for a 100-child school, so a
 * normal window finishes well under it; a pathological school truncates instead
 * of hammering Firestore. The read is newest-first, so a truncated window keeps
 * the most recent records — `lastDate`/`lastStatus` stay right, and the oldest
 * days of the window are the ones that go missing.
 */
const ROLL_MAX_PAGES = 40;

/** What one student's day looked like across every run recorded on it. */
interface RollDayState {
  present: boolean;
  absent: boolean;
}

/** A state a student can be "last seen" in; `WAITING` is the absence of one. */
function carriesState(status: StudentStatus): boolean {
  return status === "BOARDED" || status === "DROPPED_OFF" || status === "ABSENT";
}

/**
 * Per-student presence over the retention window, for the roll view.
 *
 * `enabled` is the whole read: the roll view passes `true`, the day view passes
 * `false` and this does no reading at all (empty map, no loading), so the screen
 * never pays for the 90-day window while it is showing one day.
 *
 * Aggregated in **days, not runs**: a day whose morning run boarded and whose
 * afternoon run is absent is one present day, not a tie. Only days carrying a
 * state count — `WAITING` is the absence of a record, so a day with nothing but
 * waiting docs is neither present nor absent.
 *
 * Paginated like `useAttendanceTrend` (single-field `date` range, no composite
 * index) but date-descending, which is what makes `lastStatus` the first
 * state-carrying doc seen. Results are tagged with the window key, so one
 * window's numbers can never flash under another.
 */
export function useRollSummary(enabled: boolean): RollSummaryState {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;

  const since = daysAgoDateStr(ROLL_SUMMARY_DAYS - 1);
  const key = `${uid ?? ""}|${since}`;
  const active = live && enabled;

  // Tagged with the key it was read for (see useStudentHistoryByDay): a stale
  // window resolves to the empty map instead of numbers from another range.
  const [result, setResult] = useState<{
    key: string;
    byStudentId: ReadonlyMap<string, RollSummary>;
  }>({ key: "", byStudentId: EMPTY_ROLL_SUMMARIES });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = active && loadedKey !== key;
  const byStudentId =
    active && result.key === key ? result.byStudentId : EMPTY_ROLL_SUMMARIES;

  useEffect(() => {
    if (!active || !uid || !db) return;
    const firestore = db;
    let cancelled = false;
    // Ceiling: never leave the skeleton up forever.
    const settleTimer = setTimeout(() => setLoadedKey(key), LOADING_SETTLE_TIMEOUT_MS);

    void fetchSchoolId(uid).then(async (schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setLoadedKey(key);
        return;
      }
      const base = collection(firestore, "schools", schoolId, "attendance");
      // studentId -> date -> that day's state, so two runs on one day collapse
      // into one day.
      const daysByStudent = new Map<string, Map<string, RollDayState>>();
      // studentId -> newest doc carrying a state (query is date-descending, so
      // the first one seen is the newest).
      const lastSeen = new Map<string, { date: string; status: StudentStatus }>();
      let cursor: DocumentSnapshot | null = null;
      try {
        for (let page = 0; page < ROLL_MAX_PAGES; page += 1) {
          const q: Query = cursor
            ? query(
                base,
                where("date", ">=", since),
                orderBy("date", "desc"),
                startAfter(cursor),
                limit(ROLL_PAGE_SIZE),
              )
            : query(
                base,
                where("date", ">=", since),
                orderBy("date", "desc"),
                limit(ROLL_PAGE_SIZE),
              );
          const snap: QuerySnapshot = await getDocs(q);
          for (const d of snap.docs) {
            const data = d.data();
            const date = (data.date as string) ?? "";
            // A doc without a date cannot be placed in the window.
            if (!date) continue;
            const status = (data.status as StudentStatus) ?? "WAITING";
            // Attendance doc id is `${runId}__${studentId}` — same convention as
            // useRunRoster, so summaries key off the same ids the roll uses.
            const studentId = d.id.split("__").at(-1) ?? d.id;
            if (!lastSeen.has(studentId) && carriesState(status)) {
              lastSeen.set(studentId, { date, status });
            }
            let days = daysByStudent.get(studentId);
            if (!days) {
              days = new Map<string, RollDayState>();
              daysByStudent.set(studentId, days);
            }
            let day = days.get(date);
            if (!day) {
              day = { present: false, absent: false };
              days.set(date, day);
            }
            if (status === "ABSENT") day.absent = true;
            else if (status === "BOARDED" || status === "DROPPED_OFF") day.present = true;
          }
          if (cancelled) return;
          if (snap.docs.length < ROLL_PAGE_SIZE) break;
          cursor = snap.docs[snap.docs.length - 1] ?? null;
          if (!cursor) break;
        }
        if (cancelled) return;
        const summaries = new Map<string, RollSummary>();
        for (const [studentId, days] of daysByStudent) {
          let present = 0;
          let absent = 0;
          for (const day of days.values()) {
            // A day the child was seen at all is a present day; absence only
            // counts when nothing that day contradicts it.
            if (day.present) present += 1;
            else if (day.absent) absent += 1;
          }
          const last = lastSeen.get(studentId);
          summaries.set(studentId, {
            present,
            absent,
            lastDate: last?.date ?? null,
            lastStatus: last?.status ?? null,
          });
        }
        setResult({ key, byStudentId: summaries });
      } finally {
        // Whatever happened — truncated window, failed page, no school — the
        // skeleton must end.
        if (!cancelled) setLoadedKey(key);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
    };
  }, [active, uid, since, key]);

  return { byStudentId, loading };
}

/**
 * The roll's row, in the shape the shared list/table machinery expects
 * (`AttendanceRow`).
 *
 * The day columns are placeholders: the roll view never renders a boarded or
 * drop-off time, because a roll spanning 90 days has no single day to name. The
 * row still exists so search, sort, pagination and the CSV export stay **one**
 * code path — a second row type for the roll would mean a second version of
 * each of them, free to drift.
 */
export function rollRow(
  student: RollStudent,
  summary: RollSummary | undefined,
): AttendanceRow {
  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    bus: student.bus,
    busId: student.busId ?? "",
    runType: "morning",
    status: summary?.lastStatus ?? "WAITING",
    morningBoarded: "--:--:--",
    dropOffTime: "--:--:--",
    dropOrder: null,
    boardOrder: null,
  };
}

// ── director dashboard ───────────────────────────────────────────────────────

export interface DashboardData {
  kpis: readonly KPI[];
  summary: DashboardSummary;
  /** The one fact that needs attention today, phrased for the title row. */
  finding: string;
  /**
   * How loud `finding` is. `"attention"` is only for an exception someone must
   * act on (a run signed off with children unrecorded). The routine "still to
   * account for" line is `"info"`, so the warning hue keeps its meaning.
   */
  findingKind: "info" | "attention";
  buses: readonly Bus[];
  attendance: readonly AttendanceRow[];
  loading: boolean;
  live: boolean;
}

/**
 * Live director dashboard data for one date and run segment. Queries re-subscribe
 * when the date changes; toggling the segment only re-derives in the memo (no
 * listener churn).
 *
 * `enabled` lets a caller own the day query: the Students screen reads the roll
 * instead of today when no date is picked, so it passes `false` and this hook
 * opens no listeners and does no clearing at all (the cached day rows are simply
 * not read). `live` is still reported truthfully, because the page's "live
 * unavailable" banner is about the connection, not about this hook reading.
 *
 * Callers that always want the day (every call site but that one) keep passing
 * two arguments and get the same behaviour as before.
 */
export function useDashboardData(
  dateStr?: string | null,
  segment: RunSegmentId = "morning",
  enabled = true,
): DashboardData {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;
  const { locale, t, tp } = useLocale();
  const effectiveDate = dateStr ?? todayDateStr();

  const [attendance, setAttendance] = useState<AttendanceDoc[]>([]);
  const [buses, setBuses] = useState<BusDoc[]>([]);
  const [runs, setRuns] = useState<RunDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = live && enabled && loadedKey !== `${uid}|${effectiveDate}`;

  useEffect(() => {
    if (!enabled || !live || !uid || !db) return;
    const firestore = db;
    let cancelled = false;
    const unsubscribers: (() => void)[] = [];
    // Ceiling: never leave the skeleton up forever.
    const settleTimer = setTimeout(
      () => setLoadedKey(`${uid}|${effectiveDate}`),
      LOADING_SETTLE_TIMEOUT_MS,
    );
    // Clear prior-date data on a date change so stale rows never linger while
    // the new date loads (or forever if the new query errors). Deferred to a
    // microtask to keep setState out of the synchronous effect body.
    queueMicrotask(() => {
      if (cancelled) return;
      setAttendance([]);
      setBuses([]);
      setRuns([]);
    });

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setLoadedKey(`${uid}|${effectiveDate}`);
        return;
      }
      const dateStr = effectiveDate;
      const base = `schools/${schoolId}`;

      const unsubBuses = onSnapshot(
        collection(firestore, base, "buses"),
        (snap) => {
          setBuses(
            snap.docs.map((d) => ({
              id: d.id,
              name: (d.data().name as string) ?? "",
              driver: (d.data().driver as string) ?? "",
            })),
          );
        },
        // Ignore: sign-out denies every open listener before React unmounts them.
        () => {},
      );
      unsubscribers.push(unsubBuses);

      const unsubRuns = onSnapshot(
        query(collection(firestore, base, "runs"), where("date", "==", dateStr)),
        (snap) => {
          setRuns(
            snap.docs.map((d) => ({
              id: d.id,
              busId: (d.data().busId as string) ?? "",
              status: (d.data().status as RunDoc["status"]) ?? "IN_PROGRESS",
            })),
          );
        },
        // Ignore: sign-out denies every open listener before React unmounts them.
        () => {},
      );
      unsubscribers.push(unsubRuns);

      const unsubAtt = onSnapshot(
        query(collection(firestore, base, "attendance"), where("date", "==", dateStr)),
        // See settlesLoading: a warm empty cache emits `fromCache: true` only,
        // and without metadata changes the later server confirmation is
        // suppressed — which is what pinned the skeleton to the 10s ceiling.
        { includeMetadataChanges: true },
        (snap) => {
          setAttendance(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                runId: (data.runId as string) ?? "",
                busId: (data.busId as string) ?? "",
                busName: (data.busName as string) ?? "",
                studentName: (data.studentName as string) ?? "",
                grade: (data.grade as string) ?? "",
                status: (data.status as StudentStatus) ?? "WAITING",
                boardedAt: (data.boardedAt as Timestamp | null) ?? null,
                droppedOffAt: (data.droppedOffAt as Timestamp | null) ?? null,
              };
            }),
          );
          // Not on an empty cache read — see settlesLoading.
          if (settlesLoading(snap.metadata.fromCache, snap.size > 0)) {
            setLoadedKey(`${uid}|${effectiveDate}`);
          }
        },
        () => setLoadedKey(`${uid}|${effectiveDate}`),
      );
      unsubscribers.push(unsubAtt);
    });

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      unsubscribers.forEach((u) => u());
    };
  }, [live, uid, effectiveDate, enabled]);

  const data = useMemo<DashboardData>(() => {
    if (!live) {
      // No mock fallback — the dashboard renders only live Firestore data.
      return {
        kpis: [],
        summary: {
          total: 0,
          onboard: 0,
          dropped: 0,
          waiting: 0,
          absent: 0,
          unaccounted: 0,
          accounted: 0,
          activeBuses: 0,
          totalBuses: 0,
          completedWithWaiting: null,
        },
        finding: "",
        findingKind: "info",
        buses: [],
        attendance: [],
        loading: false,
        live: false,
      };
    }
    // Place numbers for the "Run order" sort, ranked WITHIN each run segment:
    // the Students screen shows one segment, so a morning run's 14th drop-off
    // must not print 15 because the afternoon run is loaded beside it.
    const dropOrders = new Map<string, number>();
    const boardOrders = new Map<string, number>();
    for (const runType of ["morning", "afternoon"] as const) {
      const segRows = attendance.filter((a) => runTypeFromRunId(a.runId) === runType);
      for (const [id, n] of ordinalByTimestamp(segRows, (a) => a.droppedOffAt)) {
        dropOrders.set(id, n);
      }
      for (const [id, n] of ordinalByTimestamp(segRows, (a) => a.boardedAt)) {
        boardOrders.set(id, n);
      }
    }
    const rows: AttendanceRow[] = attendance.map((a) => ({
      id: a.id,
      name: a.studentName,
      grade: a.grade,
      bus: a.busName,
      busId: a.busId,
      runType: runTypeFromRunId(a.runId),
      morningBoarded: formatTime(a.boardedAt ? a.boardedAt.toDate() : null, locale),
      dropOffTime: formatTime(a.droppedOffAt ? a.droppedOffAt.toDate() : null, locale),
      status: a.status,
      dropOrder: dropOrders.get(a.id) ?? null,
      boardOrder: boardOrders.get(a.id) ?? null,
    }));

    // KPIs + fleet respond to the selected run segment (table keeps both so the
    // page applies one uniform segment+search filter).
    const segAtt = attendance.filter((a) => runTypeFromRunId(a.runId) === segment);

    const total = segAtt.length;
    const onboard = countByStatus(segAtt, "BOARDED");
    const dropped = countByStatus(segAtt, "DROPPED_OFF");
    const waiting = countByStatus(segAtt, "WAITING");
    const absent = countByStatus(segAtt, "ABSENT");
    const unaccounted = waiting + absent;
    const accounted = onboard + dropped;

    // Only fleet buses with a run of the selected segment are "active" — a bus
    // with no run shouldn't claim IN_PROGRESS with 0% stats.
    const busList: Bus[] = buses
      .filter((bus) =>
        runs.some((r) => r.busId === bus.id && runTypeFromRunId(r.id) === segment),
      )
      .map((bus) => {
        const busAtt = segAtt.filter((a) => a.busId === bus.id);
        const run = runs.find(
          (r) => r.busId === bus.id && runTypeFromRunId(r.id) === segment,
        );
        const busTotal = busAtt.length;
        const onboardCount = countByStatus(busAtt, "BOARDED");
        const droppedCount = countByStatus(busAtt, "DROPPED_OFF");
        return {
          id: bus.id,
          name: bus.name,
          driver: bus.driver,
          status: run?.status ?? "IN_PROGRESS",
          progress:
            busTotal === 0
              ? 0
              : Math.round(((onboardCount + droppedCount) / busTotal) * 100),
          onboard: onboardCount,
          droppedOff: droppedCount,
          absent: countByStatus(busAtt, "ABSENT"),
          waiting: countByStatus(busAtt, "WAITING"),
        };
      });

    const activeBuses = busList.filter((bus) => bus.status === "IN_PROGRESS").length;
    const completedWithWaiting =
      busList.find((bus) => bus.status === "COMPLETED" && bus.waiting > 0) ?? null;
    const summary: DashboardSummary = {
      total,
      onboard,
      dropped,
      waiting,
      absent,
      unaccounted,
      accounted,
      activeBuses,
      totalBuses: busList.length,
      completedWithWaiting: completedWithWaiting
        ? { name: completedWithWaiting.name, waiting: completedWithWaiting.waiting }
        : null,
    };

    const digits = (n: number) => toLocaleDigits(String(n), locale);
    const percent = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

    // Every number here is computed from the same segmented rows the table
    // shows. No static "+5 in the last minute": a delta that is not measured is
    // a lie the screen repeats all day.
    const kpis: KPI[] = [
      {
        id: "total",
        label: t("kpi.total.label"),
        value: total,
        footer: tp("kpi.total.footer", busList.length, {
          count: digits(busList.length),
        }),
        tone: "neutral",
      },
      {
        id: "onboard",
        label: t("kpi.onboard.label"),
        value: onboard,
        footer: t("kpi.onboard.footer", { percent: digits(percent(onboard)) }),
        tone: onboard > 0 ? "positive" : "neutral",
        pulse: onboard > 0,
      },
      {
        id: "dropped",
        label: t("kpi.dropped.label"),
        value: dropped,
        footer: t("kpi.dropped.footer", { percent: digits(percent(dropped)) }),
        tone: "neutral",
      },
      {
        id: "absent",
        label: t("kpi.absent.label"),
        value: unaccounted,
        footer: t("kpi.absent.footer", {
          unrecorded: digits(waiting),
          absent: digits(absent),
        }),
        tone: unaccounted > 0 ? "warning" : "neutral",
      },
    ];

    let finding: string;
    let findingKind: "info" | "attention" = "info";
    if (total === 0) {
      finding = t("dashboard.finding.empty");
    } else if (completedWithWaiting) {
      // The noun follows the unrecorded count, so that count picks the form.
      finding = tp("dashboard.finding.completedWithWaiting", completedWithWaiting.waiting, {
        bus: translateDataLabel(completedWithWaiting.name, locale, t),
        count: digits(completedWithWaiting.waiting),
      });
      // Signing a run off with children unrecorded is the one fact on this
      // screen that a person has to answer for.
      findingKind = "attention";
    } else if (unaccounted === 0) {
      finding = tp("dashboard.finding.allClear", total, { total: digits(total) });
    } else {
      finding = tp("dashboard.finding.open", total, {
        count: digits(unaccounted),
        total: digits(total),
      });
    }

    return {
      kpis,
      summary,
      finding,
      findingKind,
      buses: busList,
      attendance: rows,
      loading,
      live: true,
    };
  }, [live, attendance, buses, runs, loading, locale, t, tp, segment]);

  return data;
}

// ── student attendance history ───────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  date: string;
  runType: "morning" | "afternoon";
  busName: string;
  status: StudentStatus;
}



// ── student history, grouped by day ──────────────────────────────────────────

export interface HistoryDayEntry {
  runType: "morning" | "afternoon";
  status: StudentStatus;
  busName: string;
  /** "HH:MM" or null */
  boardedAt: string | null;
  droppedOffAt: string | null;
}

export interface StudentHistoryByDay {
  loading: boolean;
  /** ISO dates (YYYY-MM-DD) with at least one record, most recent first. */
  days: readonly string[];
  /** That day's entries, morning first. */
  entriesFor: (date: string) => readonly HistoryDayEntry[];
}

/** ~90 days of a two-run day, so the sheet opens with one capped query. */
const HISTORY_BY_DAY_LIMIT = 180;

/** A history doc with raw times; locale formatting happens in the memo. */
interface HistoryDayRow {
  date: string;
  runType: HistoryDayEntry["runType"];
  status: StudentStatus;
  busName: string;
  boardedAtMs: number | null;
  droppedOffAtMs: number | null;
}

const EMPTY_HISTORY_ENTRIES: readonly HistoryDayEntry[] = [];
const EMPTY_HISTORY_ROWS: HistoryDayRow[] = [];

/** "HH:MM" (24h, locale digits) from epoch ms; null when there is no time. */
function clockString(ms: number | null, locale: Locale): string | null {
  if (ms === null) return null;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return toLocaleDigits(`${pad(d.getHours())}:${pad(d.getMinutes())}`, locale);
}

function toHistoryDayRow(d: DocumentSnapshot): HistoryDayRow {
  const data = d.data() ?? {};
  const boarded = (data.boardedAt as Timestamp | null) ?? null;
  const dropped = (data.droppedOffAt as Timestamp | null) ?? null;
  return {
    date: (data.date as string) ?? "",
    runType: runTypeFromRunId((data.runId as string) ?? ""),
    status: (data.status as StudentStatus) ?? "WAITING",
    busName: (data.busName as string) ?? "",
    boardedAtMs: boarded ? boarded.toMillis() : null,
    droppedOffAtMs: dropped ? dropped.toMillis() : null,
  };
}

/**
 * One student's whole recent attendance history, grouped by day — the data
 * behind the by-day history sheet. Live: a single `studentName ==` query
 * ordered by date desc and capped at 180 docs (~90 days), re-subscribed when the
 * student changes. Not live (signed out / unconfigured) it returns no days and
 * no loading state, so the component renders its empty state instead of a
 * skeleton that can never resolve.
 */
export function useStudentHistoryByDay(
  studentName: string | null,
  open: boolean,
): StudentHistoryByDay {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;
  const { locale } = useLocale();

  // Rows are tagged with the key they were fetched for, so one child's days
  // can never flash under another's name and reopening the same student shows
  // the days we already have instead of an empty-state beat.
  const [result, setResult] = useState<{ key: string; rows: HistoryDayRow[] }>({
    key: "",
    rows: [],
  });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${uid ?? ""}|${studentName ?? ""}`;
  const active = live && open && !!studentName;
  // `loading` is only ever true while a live query is in flight for this name.
  const loading = active && loadedKey !== key;
  const rows = result.key === key ? result.rows : EMPTY_HISTORY_ROWS;

  useEffect(() => {
    if (!active || !uid || !db || !studentName) return;
    const firestore = db;
    const name = studentName;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    // Ceiling: never leave the skeleton up forever.
    const settleTimer = setTimeout(() => setLoadedKey(key), LOADING_SETTLE_TIMEOUT_MS);

    void fetchSchoolId(uid).then((schoolId) => {
      if (cancelled) return;
      if (!schoolId) {
        setLoadedKey(key);
        return;
      }
      unsubscribe = onSnapshot(
        query(
          collection(firestore, "schools", schoolId, "attendance"),
          where("studentName", "==", name),
          orderBy("date", "desc"),
          orderBy("runId", "desc"),
          limit(HISTORY_BY_DAY_LIMIT),
        ),
        // See settlesLoading: a warm empty cache never reports the server
        // confirmation without metadata changes.
        { includeMetadataChanges: true },
        (snap) => {
          if (cancelled) return;
          setResult({ key, rows: snap.docs.map(toHistoryDayRow) });
          // Not on an empty cache read — see settlesLoading.
          if (settlesLoading(snap.metadata.fromCache, snap.size > 0)) {
            setLoadedKey(key);
          }
        },
        () => {
          if (!cancelled) setLoadedKey(key);
        },
      );
    });

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      unsubscribe?.();
    };
  }, [active, uid, studentName, key]);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryDayEntry[]>();
    if (!active) return map;
    for (const row of rows) {
      // A doc without a `date` cannot be placed on the day axis.
      if (!row.date) continue;
      let entries = map.get(row.date);
      if (!entries) {
        entries = [];
        map.set(row.date, entries);
      }
      entries.push({
        runType: row.runType,
        status: row.status,
        busName: row.busName,
        boardedAt: clockString(row.boardedAtMs, locale),
        droppedOffAt: clockString(row.droppedOffAtMs, locale),
      });
    }
    // Morning first inside a day; the query's order is date/runId, which is not
    // the same thing as "morning before afternoon".
    for (const entries of map.values()) {
      entries.sort((a, b) =>
        a.runType === b.runType ? 0 : a.runType === "morning" ? -1 : 1,
      );
    }
    return map;
  }, [active, rows, locale]);

  const days = useMemo(
    () => [...grouped.keys()].sort((a, b) => b.localeCompare(a)),
    [grouped],
  );

  const entriesFor = useCallback(
    (date: string) => grouped.get(date) ?? EMPTY_HISTORY_ENTRIES,
    [grouped],
  );

  return { loading, days, entriesFor };
}

// ── attendance trend ─────────────────────────────────────────────────────────

export interface TrendDay {
  date: string; // "YYYY-MM-DD"
  boarded: number;
  droppedOff: number;
  absent: number;
  waiting: number;
}

export interface AttendanceTrend {
  days: readonly TrendDay[];
  loading: boolean;
  live: boolean;
}

const TREND_DEFAULT_DAYS = 7;
const TREND_PAGE_SIZE = 500;
const TREND_MAX_DOCS = 10_000;

/** YYYY-MM-DD for N days ago (trend default range). */
function daysAgoDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD `offset` days from `dateStr` (for the contiguous trend axis). */
function addDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface TrendRow {
  date: string;
  runType: "morning" | "afternoon";
  status: StudentStatus;
}

/**
 * Daily attendance totals across a date range, for one run segment (or both
 * when `segment` is omitted). Live: one internally-paginated range query on the
 * `date` field (single-field range — no composite index), aggregated per day
 * with zero days filled so the chart axis is contiguous. Not-live returns empty.
 */
export function useAttendanceTrend(
  startDate?: string | null,
  endDate?: string | null,
  segment?: RunSegmentId,
): AttendanceTrend {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;

  const effectiveEnd = endDate ?? todayDateStr();
  const effectiveStart = startDate ?? daysAgoDateStr(TREND_DEFAULT_DAYS - 1);

  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = live && loadedKey !== `${uid}|${effectiveStart}|${effectiveEnd}`;

  useEffect(() => {
    if (!live || !uid || !db) return;
    const firestore = db;
    let cancelled = false;
    // Clear the prior range on change (deferred out of the effect body).
    queueMicrotask(() => {
      if (cancelled) return;
      setRows([]);
    });

    void fetchSchoolId(uid).then(async (schoolId) => {
      if (cancelled || !schoolId) return;
      const base = collection(firestore, "schools", schoolId, "attendance");
      const collected: TrendRow[] = [];
      let lastDoc: DocumentSnapshot | null = null;
      try {
        for (;;) {
          const q: Query = lastDoc
            ? query(
                base,
                where("date", ">=", effectiveStart),
                where("date", "<=", effectiveEnd),
                orderBy("date", "asc"),
                startAfter(lastDoc),
                limit(TREND_PAGE_SIZE),
              )
            : query(
                base,
                where("date", ">=", effectiveStart),
                where("date", "<=", effectiveEnd),
                orderBy("date", "asc"),
                limit(TREND_PAGE_SIZE),
              );
          const snap: QuerySnapshot = await getDocs(q);
          for (const d of snap.docs) {
            const data = d.data();
            collected.push({
              date: (data.date as string) ?? "",
              runType: runTypeFromRunId((data.runId as string) ?? ""),
              status: (data.status as StudentStatus) ?? "WAITING",
            });
          }
          if (cancelled) return;
          if (snap.docs.length < TREND_PAGE_SIZE || collected.length >= TREND_MAX_DOCS) break;
          lastDoc = snap.docs[snap.docs.length - 1];
        }
        if (cancelled) return;
        setRows(collected);
      } finally {
        if (!cancelled) setLoadedKey(`${uid}|${effectiveStart}|${effectiveEnd}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [live, uid, effectiveStart, effectiveEnd]);

  const days = useMemo<TrendDay[]>(() => {
    if (!live) return [];
    const tally = new Map<string, TrendDay>();
    for (const row of rows) {
      if (!row.date) continue;
      if (segment && row.runType !== segment) continue;
      let day = tally.get(row.date);
      if (!day) {
        day = { date: row.date, boarded: 0, droppedOff: 0, absent: 0, waiting: 0 };
        tally.set(row.date, day);
      }
      if (row.status === "BOARDED") day.boarded++;
      else if (row.status === "DROPPED_OFF") day.droppedOff++;
      else if (row.status === "ABSENT") day.absent++;
      else day.waiting++;
    }
    // Fill zero days so the axis is contiguous and ascending.
    const list: TrendDay[] = [];
    let cursor = effectiveStart;
    let guard = 0;
    while (cursor <= effectiveEnd && guard <= 366) {
      list.push(tally.get(cursor) ?? { date: cursor, boarded: 0, droppedOff: 0, absent: 0, waiting: 0 });
      cursor = addDays(cursor, 1);
      guard++;
    }
    return list;
  }, [live, rows, segment, effectiveStart, effectiveEnd]);

  return { days, loading, live };
}

// ── attendance summaries (Reports page + Analytics modal) ────────────────────

export interface BusSummary {
  bus: string;
  assigned: number;
  boarded: number;
  droppedOff: number;
  absent: number;
  waiting: number;
}

export interface GradeSummary {
  grade: string;
  assigned: number;
  boarded: number;
  droppedOff: number;
  absent: number;
  waiting: number;
}

interface Summary {
  key: string;
  assigned: number;
  boarded: number;
  droppedOff: number;
  absent: number;
  waiting: number;
}

/** Group attendance rows by an arbitrary key, sorted by that key. */
function summarize(
  rows: readonly AttendanceRow[],
  keyOf: (row: AttendanceRow) => string,
): Summary[] {
  const map = new Map<string, Summary>();
  for (const row of rows) {
    const key = keyOf(row) || "—";
    let summary = map.get(key);
    if (!summary) {
      summary = { key, assigned: 0, boarded: 0, droppedOff: 0, absent: 0, waiting: 0 };
      map.set(key, summary);
    }
    summary.assigned++;
    if (row.status === "BOARDED") summary.boarded++;
    else if (row.status === "DROPPED_OFF") summary.droppedOff++;
    else if (row.status === "ABSENT") summary.absent++;
    else summary.waiting++;
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Group attendance rows by bus (sorted by bus name). */
export function summarizeByBus(rows: readonly AttendanceRow[]): BusSummary[] {
  return summarize(rows, (row) => row.bus).map((s) => ({
    bus: s.key,
    assigned: s.assigned,
    boarded: s.boarded,
    droppedOff: s.droppedOff,
    absent: s.absent,
    waiting: s.waiting,
  }));
}

/** Group attendance rows by grade (sorted by grade). */
export function summarizeByGrade(rows: readonly AttendanceRow[]): GradeSummary[] {
  return summarize(rows, (row) => row.grade).map((s) => ({
    grade: s.key,
    assigned: s.assigned,
    boarded: s.boarded,
    droppedOff: s.droppedOff,
    absent: s.absent,
    waiting: s.waiting,
  }));
}

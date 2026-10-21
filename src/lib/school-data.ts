import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
import type { Student, StudentStatus } from "@/data/students";
import { STATUS_CYCLE } from "@/data/students";
import {
  type AttendanceRow,
  type Bus,
  type DashboardSummary,
  type KPI,
  type RunSegmentId,
} from "@/data/dashboard";
import { useLocale } from "@/lib/i18n/context";
import { formatTime, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

import { fetchSchoolId } from "@/lib/school-id";
import { useCursorPage } from "@/lib/use-cursor-page";

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

/**
 * Whether a snapshot should end a hook's loading state.
 *
 * Firestore fires every listener immediately with whatever the local cache
 * holds, *before* the server has answered. On a cold start over slow wifi that
 * first snapshot is empty — and settling on it is what flashes an empty screen
 * (KPI zeros, "No students found") that then fills in. It reads as "the data is
 * gone" when nothing has actually been fetched yet.
 *
 * So:
 * - a server read always settles (`fromCache === false`) — it is authoritative,
 *   even when it is legitimately empty;
 * - a cache read settles if it actually holds documents, because those are real
 *   rows and showing them immediately is the whole point of the offline cache;
 * - an *empty* cache read settles only when we are offline, where there is
 *   genuinely nothing left to wait for (otherwise the skeleton would never end).
 */
function settlesLoading(fromCache: boolean, hasData: boolean): boolean {
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
const LOADING_SETTLE_TIMEOUT_MS = 10_000;

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
}

export function useRunRoster(): RunRoster {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;
  const { busId, loading: busLoading } = useDriverBus();

  const [roster, setRoster] = useState<readonly Student[]>([]);
  const [runStatus, setRunStatus] = useState<RunDoc["status"]>("IN_PROGRESS");
  const [runExists, setRunExists] = useState(false);
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
    const next =
      STATUS_CYCLE[(STATUS_CYCLE.indexOf(current.status) + 1) % STATUS_CYCLE.length];
    void fetchSchoolId(uid).then((schoolId) => {
      if (!schoolId) return;
      const runId = buildRunId(busId, todayDateStr(), ROSTER_RUN_TYPE);
      // Record boarding/drop-off timestamps so the dashboard columns populate.
      const patch: { status: StudentStatus; boardedAt?: FieldValue; droppedOffAt?: FieldValue } = {
        status: next,
      };
      if (next === "BOARDED") patch.boardedAt = serverTimestamp();
      else if (next === "DROPPED_OFF") patch.droppedOffAt = serverTimestamp();
      void setDoc(
        doc(firestore, "schools", schoolId, "attendance", `${runId}__${id}`),
        patch,
        { merge: true },
      );
    });
  }

  async function completeRun(): Promise<void> {
    if (!live || !uid || !db || !busId) return;
    const firestore = db;
    const schoolId = await fetchSchoolId(uid);
    if (!schoolId) return;
    const runId = buildRunId(busId, todayDateStr(), ROSTER_RUN_TYPE);
    // Atomic: complete the run and mark waiting students absent together. Write
    // the full run fields so a missing run doc (fresh day) isn't created partial.
    const batch = writeBatch(firestore);
    batch.set(
      doc(firestore, "schools", schoolId, "runs", runId),
      {
        busId,
        runType: ROSTER_RUN_TYPE,
        date: todayDateStr(),
        status: "COMPLETED",
      },
      { merge: true },
    );
    for (const student of roster) {
      if (student.status === "WAITING") {
        batch.set(
          doc(firestore, "schools", schoolId, "attendance", `${runId}__${student.id}`),
          { status: "ABSENT" },
          { merge: true },
        );
      }
    }
    await batch.commit();
  }

  function markAbsent(id: string) {
    if (!live || !uid || !db || !busId || runStatus === "COMPLETED") return;
    const firestore = db;
    void fetchSchoolId(uid).then((schoolId) => {
      if (!schoolId) return;
      const runId = buildRunId(busId, todayDateStr(), ROSTER_RUN_TYPE);
      void setDoc(
        doc(firestore, "schools", schoolId, "attendance", `${runId}__${id}`),
        { status: "ABSENT" },
        { merge: true },
      );
    });
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
  };
}

// ── director dashboard ───────────────────────────────────────────────────────

export interface DashboardData {
  kpis: readonly KPI[];
  summary: DashboardSummary;
  /** The one fact that needs attention today, phrased for the title row. */
  finding: string;
  buses: readonly Bus[];
  attendance: readonly AttendanceRow[];
  loading: boolean;
  live: boolean;
}

/**
 * Live director dashboard data for one date and run segment. Queries re-subscribe
 * when the date changes; toggling the segment only re-derives in the memo (no
 * listener churn).
 */
export function useDashboardData(
  dateStr?: string | null,
  segment: RunSegmentId = "morning",
): DashboardData {
  const live = useLiveFlag();
  const { user } = useAuth();
  const uid = user?.uid;
  const { locale, t } = useLocale();
  const effectiveDate = dateStr ?? todayDateStr();

  const [attendance, setAttendance] = useState<AttendanceDoc[]>([]);
  const [buses, setBuses] = useState<BusDoc[]>([]);
  const [runs, setRuns] = useState<RunDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = live && loadedKey !== `${uid}|${effectiveDate}`;

  useEffect(() => {
    if (!live || !uid || !db) return;
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
  }, [live, uid, effectiveDate]);

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
        buses: [],
        attendance: [],
        loading: false,
        live: false,
      };
    }
    const rows: AttendanceRow[] = attendance.map((a) => ({
      id: a.id,
      name: a.studentName,
      grade: a.grade,
      bus: a.busName,
      runType: runTypeFromRunId(a.runId),
      morningBoarded: formatTime(a.boardedAt ? a.boardedAt.toDate() : null, locale),
      dropOffTime: formatTime(a.droppedOffAt ? a.droppedOffAt.toDate() : null, locale),
      status: a.status,
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
        footer: t("kpi.total.footer", { count: digits(busList.length) }),
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
          waiting: digits(waiting),
          absent: digits(absent),
        }),
        tone: unaccounted > 0 ? "warning" : "neutral",
      },
    ];

    let finding: string;
    if (total === 0) {
      finding = t("dashboard.finding.empty");
    } else if (completedWithWaiting) {
      finding = t("dashboard.finding.completedWithWaiting", {
        bus: translateDataLabel(completedWithWaiting.name, locale, t),
        count: digits(completedWithWaiting.waiting),
      });
    } else if (unaccounted === 0) {
      finding = t("dashboard.finding.allClear", { total: digits(total) });
    } else {
      finding = t("dashboard.finding.open", {
        count: digits(unaccounted),
        total: digits(total),
      });
    }

    return {
      kpis,
      summary,
      finding,
      buses: busList,
      attendance: rows,
      loading,
      live: true,
    };
  }, [live, attendance, buses, runs, loading, locale, t, segment]);

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

export interface StudentHistory {
  entries: readonly HistoryEntry[];
  loading: boolean;
  live: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

const HISTORY_PAGE_SIZE = 20;

function toHistoryEntry(d: DocumentSnapshot): HistoryEntry {
  const data = d.data() ?? {};
  return {
    id: d.id,
    date: (data.date as string) ?? "",
    runType: runTypeFromRunId((data.runId as string) ?? ""),
    busName: (data.busName as string) ?? "",
    status: (data.status as StudentStatus) ?? "WAITING",
  };
}

/**
 * Paged attendance history for one student (shared by the dashboard row action
 * and the mobile kebab sheet). Live: one-shot Firestore query, cursor-paginated
 * via startAfter(documentSnapshot); mock: a small demo list. Only queries while
 * `enabled` (the sheet is open).
 */
export function useStudentHistory(
  studentName: string | null,
  enabled: boolean,
): StudentHistory {
  const live = useLiveFlag();
  const { items, loading, hasMore, loadMore } = useCursorPage<HistoryEntry>({
    enabled: enabled && !!studentName,
    pageSize: HISTORY_PAGE_SIZE,
    deps: [enabled, studentName, live],
    buildQuery: (firestore, schoolId, cursor) => {
      const base = query(
        collection(firestore, "schools", schoolId, "attendance"),
        where("studentName", "==", studentName),
        orderBy("date", "desc"),
        orderBy("runId", "desc"),
      );
      return cursor ? query(base, startAfter(cursor)) : base;
    },
    mapItem: toHistoryEntry,
  });

  return { entries: items, loading, live, hasMore, loadMore };
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

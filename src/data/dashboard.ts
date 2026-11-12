/**
 * Director dashboard ("Live monitor") — layout config + types.
 *
 * No mock data lives here: KPIs are derived from Firestore attendance in
 * `useDashboardData`, and buses/rows come from Firestore.
 *
 * User-facing labels (KPIs, nav, run segments) are resolved by components via
 * `t()` (i18n) — only ids and layout config live here.
 */

import type { OperatorScreen } from "@/lib/api-contract";
import type { StudentStatus } from "@/data/students";
import type { MessageKey } from "@/lib/i18n/types";

/**
 * Attendance badge classes per status. Pale tint + dark ink of the same hue;
 * no solid fills, so one "Dropped off" row cannot out-shout the live state of
 * the run. The dot colour lives in `STATUS_DOT`.
 */
export const DASH_STATUS_META: Record<StudentStatus, string> = {
  BOARDED: "bg-dash-success-container text-dash-on-success-container",
  DROPPED_OFF: "bg-dash-primary-container text-dash-on-primary-container",
  ABSENT: "bg-dash-error-container text-dash-on-error-container",
  // no record yet: a neutral chip, never amber
  WAITING: "bg-dash-surface-container text-dash-on-surface-variant",
};

/** The tiny mark that carries the status beside its label. */
export const STATUS_DOT: Record<StudentStatus, string> = {
  BOARDED: "bg-dash-success",
  DROPPED_OFF: "bg-dash-primary",
  ABSENT: "bg-dash-error",
  WAITING: "bg-dash-outline",
};

/** Student-list status filter options — "All" plus every status. */
/** Filter options a director acts on. "No record yet" is not one of them. */
export const STUDENT_STATUS_FILTERS: readonly ("ALL" | StudentStatus)[] = [
  "ALL",
  "BOARDED",
  "DROPPED_OFF",
  "ABSENT",
];

export type StudentStatusFilter = (typeof STUDENT_STATUS_FILTERS)[number];

export type MetricTone = "neutral" | "positive" | "warning" | "negative";

export interface KPI {
  id: "total" | "onboard" | "dropped" | "absent";
  label: string;
  value: number;
  /** A short, computed caption — never a static slogan. */
  footer: string;
  tone: MetricTone;
  /** A live mark beside the label (only while the run is actually moving). */
  pulse?: boolean;
}

/**
 * The screen's answer, in one object: every count is computed once in
 * `useDashboardData` and read by the summary, the KPI strip and the finding
 * line, so two cards can never disagree.
 */
export interface DashboardSummary {
  total: number;
  onboard: number;
  dropped: number;
  waiting: number;
  absent: number;
  /** Waiting + absent: students the school cannot yet account for. */
  unaccounted: number;
  /** Onboard + dropped. */
  accounted: number;
  activeBuses: number;
  totalBuses: number;
  /** The first finished run that still has students waiting, if any. */
  completedWithWaiting: { name: string; waiting: number } | null;
}

export interface Bus {
  id: string;
  name: string;
  driver: string;
  status: "IN_PROGRESS" | "COMPLETED";
  progress: number;
  onboard: number;
  droppedOff: number;
  absent: number;
  /** Children on the sheet nobody has recorded yet — counted, never labelled. */
  waiting: number;
}

/**
 * The screen a destination is gated by (see `lib/permissions.ts`). The five
 * operator-grantable screens come from the API contract; "operators" is the
 * main-director-only page and is never part of a grant.
 */
export type NavScreen = OperatorScreen | "operators" | "activity";

export interface NavItem {
  id: string;
  icon: string;
  href: string;
  group: "operate" | "manage";
  /** Which access screen opens this destination. */
  screen: NavScreen;
}

/**
 * A student's presence over the retention window — the roll view's summary,
 * shown instead of one day's run columns when no date is picked.
 *
 * Counts are **days**, not runs: a day with both a morning and an afternoon
 * record is one day, so "42 present · 2 absent" reads as schooldays.
 */
export interface RollSummary {
  /** Days with a run recorded BOARDED or DROPPED_OFF. */
  present: number;
  /** Days recorded ABSENT with no presence that same day. */
  absent: number;
  /** Newest day carrying a recorded state, or null when there is none. */
  lastDate: string | null;
  lastStatus: StudentStatus | null;
}

export interface AttendanceRow {
  id: string;
  name: string;
  grade: string;
  status: StudentStatus;
  bus: string;
  /** The bus doc id, so views can group rows by bus (names can be renamed). */
  busId: string;
  /** Which run segment the row belongs to — drives the dashboard filter. */
  runType: "morning" | "afternoon";
  morningBoarded: string;
  dropOffTime: string;
  /** 1-based place in the run's drop-off order; null when the student has not been dropped off. */
  dropOrder: number | null;
  /** 1-based place in the run's boarding order; null when never boarded. */
  boardOrder: number | null;
}

/**
 * Only destinations that exist. Fleet status lives on the Live monitor, and
 * Routes has no screen yet, so neither is a nav row — a dead nav item reads as
 * a broken product.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "live-map", icon: "map", href: "/dashboard", group: "operate", screen: "live" },
  { id: "students", icon: "groups", href: "/dashboard/students", group: "operate", screen: "students" },
  { id: "reports", icon: "assessment", href: "/dashboard/reports", group: "operate", screen: "reports" },
  { id: "assignments", icon: "assignment_ind", href: "/dashboard/assignments", group: "manage", screen: "assignments" },
  { id: "drivers", icon: "badge", href: "/dashboard/drivers", group: "manage", screen: "drivers" },
  // Every director, never an operator: the audited do not administer the audit.
  { id: "activity", icon: "history", href: "/dashboard/activity", group: "manage", screen: "activity" },
  { id: "operators", icon: "manage_accounts", href: "/dashboard/operators", group: "manage", screen: "operators" },
];

/**
 * The FULL name of a destination, per nav id. One map, used by the rail and by
 * the phone bar: the phone bar is icons only, so this is its accessible name,
 * and a truncated label there would be a worse name than none.
 */
export const NAV_LABEL_KEY: Record<string, MessageKey> = {
  "live-map": "nav.liveMap",
  students: "nav.students",
  reports: "nav.reports",
  assignments: "nav.assignments",
  drivers: "nav.drivers",
  activity: "nav.activity",
  operators: "nav.operators",
};

/** Map the current pathname to the active sidebar item id (shell pages → live-map). */
export function activeIdFromPathname(pathname: string): string {
  if (pathname.startsWith("/dashboard/guide")) return "guide";
  if (pathname.startsWith("/dashboard/operators")) return "operators";
  if (pathname.startsWith("/dashboard/students")) return "students";
  if (pathname.startsWith("/dashboard/reports")) return "reports";
  if (pathname.startsWith("/dashboard/assignments")) return "assignments";
  if (pathname.startsWith("/dashboard/drivers")) return "drivers";
  if (pathname.startsWith("/dashboard/activity")) return "activity";
  return "live-map";
}

export const RUN_SEGMENTS = [{ id: "morning" }, { id: "afternoon" }] as const;

export type RunSegmentId = (typeof RUN_SEGMENTS)[number]["id"];

/**
 * Director dashboard ("Live monitor") — layout config + types.
 *
 * No mock data lives here: KPIs are derived from Firestore attendance in
 * `useDashboardData`, and buses/rows come from Firestore.
 *
 * User-facing labels (KPIs, nav, run segments) are resolved by components via
 * `t()` (i18n) — only ids and layout config live here.
 */

import type { StudentStatus } from "@/data/students";

/**
 * Attendance badge classes per status. Pale tint + dark ink of the same hue;
 * no solid fills, so one "Dropped off" row cannot out-shout the live state of
 * the run. The dot colour lives in `STATUS_DOT`.
 */
export const DASH_STATUS_META: Record<StudentStatus, string> = {
  BOARDED: "bg-dash-success-container text-dash-on-success-container",
  DROPPED_OFF: "bg-dash-primary-container text-dash-on-primary-container",
  ABSENT: "bg-dash-error-container text-dash-on-error-container",
  WAITING: "bg-dash-warning-container text-dash-on-warning-container",
};

/** The tiny mark that carries the status beside its label. */
export const STATUS_DOT: Record<StudentStatus, string> = {
  BOARDED: "bg-dash-success",
  DROPPED_OFF: "bg-dash-primary",
  ABSENT: "bg-dash-error",
  WAITING: "bg-dash-warning",
};

/** Student-list status filter options — "All" plus every status. */
export const STUDENT_STATUS_FILTERS: readonly ("ALL" | StudentStatus)[] = [
  "ALL",
  "BOARDED",
  "WAITING",
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
  waiting: number;
}

export interface NavItem {
  id: string;
  icon: string;
  href: string;
  group: "operate" | "manage";
}

export interface AttendanceRow {
  id: string;
  name: string;
  grade: string;
  status: StudentStatus;
  bus: string;
  /** Which run segment the row belongs to — drives the dashboard filter. */
  runType: "morning" | "afternoon";
  morningBoarded: string;
  dropOffTime: string;
}

/**
 * Only destinations that exist. Fleet status lives on the Live monitor, and
 * Routes has no screen yet, so neither is a nav row — a dead nav item reads as
 * a broken product.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "live-map", icon: "map", href: "/dashboard", group: "operate" },
  { id: "reports", icon: "assessment", href: "/dashboard/reports", group: "operate" },
  { id: "assignments", icon: "assignment_ind", href: "/dashboard/assignments", group: "manage" },
  { id: "drivers", icon: "badge", href: "/dashboard/drivers", group: "manage" },
];

/** Map the current pathname to the active sidebar item id (shell pages → live-map). */
export function activeIdFromPathname(pathname: string): string {
  if (pathname.startsWith("/dashboard/reports")) return "reports";
  if (pathname.startsWith("/dashboard/assignments")) return "assignments";
  if (pathname.startsWith("/dashboard/drivers")) return "drivers";
  return "live-map";
}

export const RUN_SEGMENTS = [{ id: "morning" }, { id: "afternoon" }] as const;

export type RunSegmentId = (typeof RUN_SEGMENTS)[number]["id"];

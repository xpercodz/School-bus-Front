import type { AttendanceRow, RollSummary } from "@/data/dashboard";
import {
  formatDayMonth,
  formatPercent,
  statusKey,
  toLocaleDigits,
  translateDataLabel,
} from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { TFunction } from "@/lib/i18n/types";

/** Quote a CSV cell when it contains a delimiter, quote, or newline. */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Neutralize spreadsheet formula injection (=, +, -, @) by prefixing with an
 * apostrophe. The "--:--:--" placeholder is kept intact (its leading "-" is
 * not a formula).
 */
function sanitizeCell(value: string): string {
  if (value === "--:--:--") return value;
  const trimmed = value.trimStart();
  if (trimmed !== "" && /^[=+\-@]/.test(trimmed)) return `'${value}`;
  return value;
}

function cell(value: string): string {
  return escapeCsvCell(sanitizeCell(value));
}

/**
 * Build a UTF-8 CSV (BOM-prefixed so Excel reads Arabic/accents correctly) of
 * attendance rows, with localized headers and localized grade/bus/status labels.
 */
export function buildAttendanceCsv(
  rows: readonly AttendanceRow[],
  t: TFunction,
  locale: Locale,
): string {
  const header = [
    t("dashboard.th.studentName"),
    t("dashboard.th.grade"),
    t("dashboard.th.bus"),
    t("dashboard.th.morningBoarded"),
    t("dashboard.th.dropOffTime"),
    t("dashboard.th.currentStatus"),
  ];
  const lines = [header.map(cell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        translateDataLabel(row.grade, locale, t),
        translateDataLabel(row.bus, locale, t),
        row.morningBoarded,
        row.dropOffTime,
        t(statusKey(row.status)),
      ]
        .map(cell)
        .join(","),
    );
  }
  // Leading BOM (spelled as an escape, not a literal invisible character) so
  // Excel detects UTF-8; without it Arabic text mojibakes on open.
  return `\uFEFF${lines.join("\r\n")}`;
}

/**
 * Build the Students screen's no-date export: one row per student summarised
 * over the retention window, instead of one row per day of attendance.
 *
 * The roll gets its own builder rather than a flag on `buildAttendanceCsv`
 * because a day-shaped sheet would have to fill the two time columns with
 * "--:--:--", and a dash in a time column reads as data in a director's
 * spreadsheet. `cell()` is shared so quoting, formula neutralisation and the
 * BOM/CRLF convention stay identical across both exports.
 */
export function buildRollCsv(
  rows: readonly AttendanceRow[],
  summaries: ReadonlyMap<string, RollSummary>,
  t: TFunction,
  locale: Locale,
): string {
  const header = [
    t("dashboard.th.studentName"),
    t("dashboard.th.grade"),
    t("dashboard.th.bus"),
    t("students.th.present"),
    t("students.th.absent"),
    t("students.th.attendance"),
    t("students.th.lastRecord"),
  ];
  const empty: RollSummary = { present: 0, absent: 0, lastDate: null, lastStatus: null };
  const lines = [header.map(cell).join(",")];
  for (const row of rows) {
    // A student with no summary in the window is a zero row, not a missing
    // row: the export's job is to account for every child on the roll.
    const summary = summaries.get(row.id) ?? empty;
    const recorded = summary.present + summary.absent;
    const attendance =
      recorded === 0
        ? ""
        : formatPercent((summary.present / recorded) * 100, locale);
    const lastRecord = summary.lastStatus
      ? `${formatDayMonth(summary.lastDate, locale)} · ${t(statusKey(summary.lastStatus))}`
      : t("students.noRecord");
    lines.push(
      [
        row.name,
        translateDataLabel(row.grade, locale, t),
        translateDataLabel(row.bus, locale, t),
        toLocaleDigits(String(summary.present), locale),
        toLocaleDigits(String(summary.absent), locale),
        attendance,
        lastRecord,
      ]
        .map(cell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

/**
 * One row of the activity export. The sentence is built by the screen (it needs
 * the dictionaries and the tenant's bus names), so this module never imports it.
 */
export interface ActivityCsvRow {
  at: Date | null;
  actor: string;
  outcome: "success" | "failure";
  source: "api" | "client" | "system";
  sentence: string;
}

export interface ActivityCsvLabels {
  what: string;
  when: string;
  actor: string;
  outcome: string;
  source: string;
  success: string;
  failure: string;
  sources: { api: string; client: string; system: string };
  formatDate: (date: Date) => string;
}

/**
 * The activity export. Same guard as every other CSV here: a leading `=`, `+`,
 * `-` or `@` becomes text before Excel can run it, because log entries carry
 * values a writer chose.
 */
export function buildActivityCsv(
  rows: readonly ActivityCsvRow[],
  labels: ActivityCsvLabels,
): string {
  const header = [labels.what, labels.when, labels.actor, labels.outcome, labels.source]
    .map(cell)
    .join(",");
  const lines = rows.map((row) =>
    [
      row.sentence,
      row.at ? labels.formatDate(row.at) : "",
      row.actor,
      row.outcome === "failure" ? labels.failure : labels.success,
      labels.sources[row.source],
    ]
      .map(cell)
      .join(","),
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

/** Trigger a client-side download of `content` as `filename`. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

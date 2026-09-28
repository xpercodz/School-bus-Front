import type { AttendanceRow } from "@/data/dashboard";
import { statusKey, translateDataLabel } from "@/lib/i18n/format";
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

import { useMemo } from "react";
import type { GradeSummary } from "@/lib/school-data";
import type { AttendanceRow } from "@/data/dashboard";
import { DASH_STATUS_META, STATUS_DOT } from "@/data/dashboard";
import type { StudentStatus } from "@/data/students";
import type { MessageKey } from "@/lib/i18n/types";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { useLocale } from "@/lib/i18n/context";
import { usePageSlice } from "@/lib/use-page-slice";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import {
  statusKey,
  toLocaleDigits,
  translateDataLabel,
} from "@/lib/i18n/format";

/**
 * What a Reports class card opens: the class's four figures and its students,
 * in name order, as a real (striped) table.
 *
 * The parent owns the attendance history sheet, so a row's History action is
 * just `onViewHistory(name)` — this dialog never builds a second history view.
 * All counts come from the card's own `GradeSummary`; the rows are the same
 * segmented attendance rows the page draws, so the card, this strip and the
 * table cannot disagree.
 */

interface ClassStudentsDialogProps {
  /** The class the open card drew; `null` closes the dialog. */
  summary: GradeSummary | null;
  /** Every attendance row for the page's date + run segment. */
  rows: readonly AttendanceRow[];
  /** School · date · run — the same scope line the page's header composes. */
  scope: string;
  onClose: () => void;
  onViewHistory: (studentName: string) => void;
  /** Leave for the Students screen (the parent navigates and closes). */
  onOpenInStudents: () => void;
}

export function ClassStudentsDialog({
  summary,
  rows,
  scope,
  onClose,
  onViewHistory,
  onOpenInStudents,
}: ClassStudentsDialogProps) {
  const { locale, t } = useLocale();
  const className = summary ? translateDataLabel(summary.grade, locale, t) : "";

  return (
    <Dialog
      open={summary !== null}
      onClose={onClose}
      title={className || t("reports.classes")}
      // Closing clears the summary, which unmounts the body; an exit beat would
      // animate an empty panel out.
      exitAnimation={false}
      panelClassName="w-full max-w-3xl max-h-[88dvh] rounded-t-2xl bg-dash-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:rounded-xl sm:pb-0"
    >
      {summary && (
        <ClassStudentsBody
          summary={summary}
          rows={rows}
          scope={scope}
          onClose={onClose}
          onViewHistory={onViewHistory}
          onOpenInStudents={onOpenInStudents}
        />
      )}
    </Dialog>
  );
}

/**
 * The class's four cells. The fourth is "Unaccounted" — the same figure the
 * page's KPI strip and the class card's own bar use (no record + absent), so a
 * reader is never asked to add two numbers themselves.
 */
const SUMMARY_CELLS: readonly { key: string; labelKey: MessageKey }[] = [
  { key: "assigned", labelKey: "dashboard.th.assigned" },
  { key: "boarded", labelKey: "status.boarded" },
  { key: "droppedOff", labelKey: "status.droppedOff" },
  { key: "unaccounted", labelKey: "busDetail.unaccounted" },
];

/**
 * Explicit cell edges instead of `divide-*`: the phone layout is 2×2, and the
 * divider has to move with it (a vertical rule between the pairs, a horizontal
 * one under the top row) rather than draw one dangling edge. The leading cell of
 * each row keeps the strip flush with the panel's own gutter, and the trailing
 * one stays flush on the right at both widths.
 */
const CELL_PADDING = ["ps-0 pe-4", "ps-4 pe-0 sm:pe-4", "ps-0 pe-4 sm:ps-4", "ps-4 pe-0"];

function cellClass(index: number): string {
  return [
    "min-w-0 py-1",
    CELL_PADDING[index],
    index % 2 === 1 ? "border-s border-dash-outline-variant" : "",
    index >= 2 ? "border-t border-dash-outline-variant sm:border-t-0" : "",
    index > 0 ? "sm:border-s sm:border-dash-outline-variant" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A missing timestamp is a dash, never a dimmed placeholder string. */
function timeText(value: string): string {
  return value.startsWith("--") ? "—" : value;
}

/** The same pale chip + dot the roster and the bus overview use. */
function StatusChip({ status }: { status: StudentStatus }) {
  const { t } = useLocale();
  const label = status === "WAITING" ? t("busDetail.unaccounted") : t(statusKey(status));
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[11.5px] font-medium ${DASH_STATUS_META[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function ClassStudentsBody({
  summary,
  rows,
  scope,
  onClose,
  onViewHistory,
  onOpenInStudents,
}: Omit<ClassStudentsDialogProps, "summary"> & { summary: GradeSummary }) {
  const { t, locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);
  const className = translateDataLabel(summary.grade, locale, t);

  const students = useMemo(
    () =>
      rows
        .filter((row) => row.grade === summary.grade)
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [rows, summary.grade, locale],
  );
  // Ten a page, like every other director list; a class can be 30 children.
  const page = usePageSlice(students, 10, summary.grade);

  const percent =
    summary.assigned === 0
      ? 0
      : Math.round(((summary.boarded + summary.droppedOff) / summary.assigned) * 100);

  const summaryValues: Record<string, number> = {
    assigned: summary.assigned,
    boarded: summary.boarded,
    droppedOff: summary.droppedOff,
    unaccounted: summary.waiting + summary.absent,
  };

  const headers: readonly MessageKey[] = [
    "dashboard.th.studentName",
    "dashboard.th.bus",
    "dashboard.th.morningBoarded",
    "dashboard.th.dropOffTime",
    "dashboard.th.currentStatus",
    "dashboard.th.actions",
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* Sticky sheet header — the class's identity and scope stay reachable
          while the table scrolls under them on a phone. */}
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-dash-outline-variant bg-dash-surface px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] leading-6 font-semibold text-dash-on-surface sm:text-dash-headline-lg">
            {className}
          </h2>
          <p className="mt-0.5 truncate text-[12.5px] leading-4 text-dash-on-surface-variant">
            {scope}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="md"
          icon
          className="flex-none"
          onClick={onClose}
          aria-label={t("dialog.close")}
        >
          <Icon name="close" size={20} variant="outlined" />
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {SUMMARY_CELLS.map((cell, index) => (
            <div key={cell.key} className={cellClass(index)}>
              <dt className="text-[11.5px] leading-4 text-dash-on-surface-variant">
                {t(cell.labelKey)}
              </dt>
              <dd className="mt-1 text-[16px] leading-[1.15] font-semibold tabular-nums text-dash-on-surface">
                {digits(summaryValues[cell.key])}
              </dd>
            </div>
          ))}
        </dl>

        {/* The table scrolls inside its own frame on a phone; the sheet itself
            never scrolls sideways. */}
        <div className="overflow-x-auto rounded-lg border border-dash-outline-variant bg-dash-surface">
          <table className="table-zebra w-full min-w-[640px] border-collapse text-start">
            <caption className="sr-only">
              {t("reports.classCaption", { grade: className })}
            </caption>
            <thead>
              <tr className="border-b border-dash-outline-variant">
                {headers.map((key, index) => (
                  <th
                    key={key}
                    scope="col"
                    className={`h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant ${
                      index === headers.length - 1 ? "text-end" : ""
                    }`}
                  >
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length}
                    className="px-4 py-8 text-center text-[13px] text-dash-on-surface-variant"
                  >
                    {t("dashboard.emptyTitle")}
                  </td>
                </tr>
              ) : (
                page.paged.map((row) => (
                  <tr key={row.id} className="border-b border-dash-outline-variant last:border-b-0">
                    <th
                      scope="row"
                      className="h-11 px-4 text-[13.5px] font-medium whitespace-nowrap text-dash-on-surface"
                    >
                      {row.name}
                    </th>
                    <td className="px-4 text-[13px] tabular-nums text-dash-on-surface-variant">
                      {translateDataLabel(row.bus, locale, t)}
                    </td>
                    <td className="px-4 text-[13px] tabular-nums text-dash-on-surface">
                      {timeText(row.morningBoarded)}
                    </td>
                    <td className="px-4 text-[13px] tabular-nums text-dash-on-surface">
                      {timeText(row.dropOffTime)}
                    </td>
                    <td className="px-4">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="px-4 text-end">
                      <Button
                        type="button"
                        onClick={() => onViewHistory(row.name)}
                        aria-label={t("dashboard.historyAria", { name: row.name })}
                        variant="ghost"
                        size="sm"
                      >
                        <Icon name="history" size={16} variant="outlined" />
                        {t("dashboard.th.actions")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={page} />
      </div>

      {/* Sits at the bottom of the panel and stays there while the table
          scrolls: stacked on a phone, one row at sm+. */}
      <div className="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 border-t border-dash-outline-variant bg-dash-surface px-4 pt-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-[12.5px] leading-4 text-dash-on-surface-variant">
          {t("reports.classCompletion", { percent: digits(percent) })}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="arc-field w-full sm:w-auto"
            onClick={onOpenInStudents}
          >
            <Icon name="arrow_forward" size={16} variant="outlined" />
            {t("busDetail.openInStudents")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            {t("dialog.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}

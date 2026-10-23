import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { RunSegmentId } from "@/data/dashboard";
import {
  summarizeByBus,
  summarizeByGrade,
  useDashboardData,
  todayDateStr,
} from "@/lib/school-data";
import { useStudentList } from "@/lib/use-student-list";
import { buildAttendanceCsv, downloadCsv } from "@/lib/csv";
import { useSchoolName } from "@/lib/school";
import { ReportsSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { AnalyticsModal } from "@/components/dashboard/AnalyticsModal";
import { DateSegmentBar } from "@/components/dashboard/DateSegmentBar";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { KpiStrip } from "@/components/dashboard/Summary";
import { Icon } from "@/components/Icon";
import { Reveal } from "@/components/Reveal";
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { StudentList } from "@/components/dashboard/StudentList";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/lib/i18n/context";
import { formatDate, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

/**
 * `Reveal` keeps a section transparent until it enters the viewport, but Print
 * paints the whole document at once and never runs that observer — a section
 * still below the fold would print blank. `!` is required: globals.css declares
 * `.js .reveal` unlayered, so a plain utility class cannot beat it.
 */
const REVEAL_PRINT = "print:opacity-100! print:transform-none!";

export default function ReportsPage() {
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const schoolName = useSchoolName();

  const [date, setDate] = useState<string | null>(null);
  const [segment, setSegment] = useState<RunSegmentId>("morning");
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const { kpis, attendance, loading, live } = useDashboardData(date, segment);
  const effectiveDate = date ?? todayDateStr();

  const rows = useMemo(
    () => attendance.filter((row) => row.runType === segment),
    [attendance, segment],
  );
  const byBus = useMemo(() => summarizeByBus(rows), [rows]);
  const byGrade = useMemo(() => summarizeByGrade(rows), [rows]);
  const list = useStudentList(rows);

  function handleExport() {
    downloadCsv(`report-${effectiveDate}.csv`, buildAttendanceCsv(list.filtered, t, locale));
    showToast(
      t("toast.exported", {
        count: toLocaleDigits(String(list.filtered.length), locale),
      }),
    );
  }

  /** Completion % = (boarded + dropped) / assigned. */
  function completionOf(assigned: number, boarded: number, droppedOff: number): number {
    return assigned === 0 ? 0 : Math.round(((boarded + droppedOff) / assigned) * 100);
  }

  const empty = live && !loading && rows.length === 0;
  const subtitle = `${schoolName ?? t("dashboard.loading")} · ${formatDate(effectiveDate, locale)} · ${t(
    segment === "morning" ? "runType.morningPickup" : "runType.afternoonDropoff",
  )}`;

  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-4 pt-5 sm:px-6 sm:pt-6 print:hidden">
        <PageHeader
          title={t("reports.title")}
          subtitle={subtitle}
          actions={
            <ReportsActions
              analyticsDisabled={live && loading}
              onAnalytics={() => setAnalyticsOpen(true)}
              onPrint={() => window.print()}
              onExport={handleExport}
            />
          }
        />
      </div>

      {/* Scope row: sticks under the phone header and takes the top edge at lg,
          where the rail replaces that header — same pattern as FilterBar. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-dash-outline-variant bg-dash-background px-4 py-2.5 sm:px-6 lg:top-0 print:hidden">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-3">
          <DateSegmentBar
            date={date}
            onDateChange={setDate}
            segment={segment}
            onSegmentChange={setSegment}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-5 sm:px-6 print:max-w-none print:p-0">
        {!live && (
          <div role="status" className="flex items-center gap-2 text-[13px] text-dash-on-surface-variant">
            <Icon name="info" size={16} variant="outlined" />
            {t("dashboard.liveUnavailable")}
          </div>
        )}
        {live && loading ? (
          <div role="status" aria-label={t("dashboard.loading")}>
            <ReportsSkeleton />
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center gap-1.5 py-12 text-center">
            <Icon name="description" size={24} variant="outlined" className="text-dash-outline" />
            <p className="text-[15px] font-semibold text-dash-on-surface">{t("reports.emptyTitle")}</p>
            <p className="text-[12.5px] text-dash-on-surface-variant">{t("reports.emptySubtitle")}</p>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-3 print:break-inside-avoid">
              <h2 className="text-[15px] font-semibold text-dash-on-surface">
                {t("reports.overview")}
              </h2>
              <KpiStrip kpis={kpis} />
            </section>

            <Reveal delay={50} className={REVEAL_PRINT}>
              <SummaryTable
                title={t("reports.byBus")}
                rows={byBus}
                identityLabel={t("dashboard.th.bus")}
                identity={(row) => translateDataLabel(row.bus, locale, t)}
                withCompletion
                completionOf={completionOf}
              />
            </Reveal>

            <Reveal delay={100} className={REVEAL_PRINT}>
              <SummaryTable
                title={t("reports.byGrade")}
                rows={byGrade}
                identityLabel={t("dashboard.th.grade")}
                identity={(row) => translateDataLabel(row.grade, locale, t)}
              />
            </Reveal>

            {/* The roster rows stagger themselves; a Reveal wrapper here would
                be a second transform on the same rows. */}
            <section className="print:break-inside-avoid">
              <StudentList list={list} onViewHistory={setHistoryStudent} />
            </section>
          </>
        )}
      </div>

      <AnalyticsModal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        date={date}
        byBus={byBus}
        segment={segment}
      />

      <StudentHistorySheet
        studentName={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
    </>
  );
}

/**
 * Title-row actions. Phones keep the primary Export visible and tuck Print /
 * Analytics behind a 44px disclosure; from `sm` up all three sit inline. The
 * disclosure is deliberately a plain `aria-expanded` toggle rather than a
 * `role="menu"`: two buttons are reached by Tab, so it needs no roving
 * tabindex or arrow-key contract. Outside pointerdown and Escape close it, and
 * Escape returns focus to the trigger.
 */
function ReportsActions({
  analyticsDisabled,
  onAnalytics,
  onPrint,
  onExport,
}: {
  analyticsDisabled: boolean;
  onAnalytics: () => void;
  onPrint: () => void;
  onExport: () => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    triggerRef.current?.focus();
    action();
  }

  return (
    <>
      <button
        type="button"
        onClick={onAnalytics}
        disabled={analyticsDisabled}
        className="press hidden h-9 items-center gap-2 rounded-lg border border-dash-control-outline bg-dash-surface px-3 text-[12.5px] text-dash-on-surface hover:bg-dash-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
      >
        <Icon name="monitoring" size={16} variant="outlined" className="text-dash-outline" />
        {t("reports.analytics")}
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="press hidden h-9 items-center gap-2 rounded-lg border border-dash-control-outline bg-dash-surface px-3 text-[12.5px] text-dash-on-surface hover:bg-dash-surface-container-low sm:flex"
      >
        <Icon name="print" size={16} variant="outlined" className="text-dash-outline" />
        {t("reports.print")}
      </button>
      <button
        type="button"
        onClick={onExport}
        className="press flex h-11 items-center gap-2 rounded-lg bg-dash-on-surface px-3.5 text-[12.5px] font-medium text-dash-background hover:opacity-90 sm:h-9"
      >
        <Icon name="download" size={16} variant="outlined" />
        {t("reports.export")}
      </button>

      {/* PageHeader stretches every action child from lg down (`[&>*]:flex-1`);
          the disclosure is a fixed 44px square, so it opts out. */}
      <div
        ref={rootRef}
        className="relative w-11 flex-none! sm:hidden"
        onBlur={(event) => {
          // Tab past the last item closes the disclosure rather than leaving an
          // open panel behind the keyboard focus.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${t("reports.print")} / ${t("reports.analytics")}`}
          className="press flex h-11 w-11 items-center justify-center rounded-lg border border-dash-control-outline bg-dash-surface text-dash-on-surface hover:bg-dash-surface-container-low"
        >
          <Icon name="more_vert" size={20} variant="outlined" className="text-dash-outline" />
        </button>
        {/* Kept mounted and hidden so aria-controls always resolves; `hidden`
            also takes both items out of the tab order while closed. */}
        <div
          id={panelId}
          hidden={!open}
          className="pop-in absolute end-0 top-[calc(100%+0.25rem)] z-30 w-44 origin-top overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface p-1 shadow-float"
        >
          <button
            type="button"
            onClick={() => run(onAnalytics)}
            disabled={analyticsDisabled}
            className="press flex h-11 w-full items-center gap-2 rounded-md px-2.5 text-start text-[13px] text-dash-on-surface hover:bg-dash-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="monitoring" size={16} variant="outlined" className="text-dash-outline" />
            {t("reports.analytics")}
          </button>
          <button
            type="button"
            onClick={() => run(onPrint)}
            className="press flex h-11 w-full items-center gap-2 rounded-md px-2.5 text-start text-[13px] text-dash-on-surface hover:bg-dash-surface-container-low"
          >
            <Icon name="print" size={16} variant="outlined" className="text-dash-outline" />
            {t("reports.print")}
          </button>
        </div>
      </div>
    </>
  );
}

interface SummaryRow {
  assigned: number;
  boarded: number;
  droppedOff: number;
  absent: number;
  waiting: number;
}

/**
 * By-bus / by-grade summary. Desktop keeps the aligned table; below `md` the
 * same rows become labelled cards — identity on line 1, a two-column metric
 * grid, and completion as its own line with a true-ratio bar. No field is
 * dropped from the table, and an empty result keeps the frame.
 */
function SummaryTable<T extends SummaryRow>({
  title,
  rows,
  identityLabel,
  identity,
  withCompletion = false,
  completionOf,
}: {
  title: string;
  rows: readonly T[];
  identityLabel: string;
  identity: (row: T) => string;
  withCompletion?: boolean;
  completionOf?: (assigned: number, boarded: number, droppedOff: number) => number;
}) {
  const { t, locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);

  const emptyLine = (
    <p className="px-4 py-6 text-[13px] leading-5 text-dash-on-surface-variant">
      {t("reports.emptySubtitle")}
    </p>
  );

  return (
    <section className="flex flex-col gap-3 print:break-inside-avoid">
      <h2 className="text-[15px] font-semibold text-dash-on-surface">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface print:overflow-visible">
        {/* Phone: one card per bus / grade. Hidden in print: paper width can be
            narrower than `md`, and the printed report should keep the table. */}
        <div className="md:hidden print:hidden">
          {rows.length === 0 ? (
            emptyLine
          ) : (
            <ul className="divide-y divide-dash-outline-variant">
              {rows.map((row, index) => {
                const completion =
                  withCompletion && completionOf
                    ? completionOf(row.assigned, row.boarded, row.droppedOff)
                    : null;
                return (
                  <li key={index} className="px-4 py-3.5">
                    <p className="break-words text-[13.5px] font-medium leading-5 text-dash-on-surface">
                      {identity(row)}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <Metric label={t("dashboard.th.assigned")} value={digits(row.assigned)} />
                      <Metric label={t("status.boarded")} value={digits(row.boarded)} />
                      <Metric label={t("status.droppedOff")} value={digits(row.droppedOff)} />
                      <Metric label={t("status.absent")} value={digits(row.absent)} />
                      <Metric label={t("dashboard.th.waiting")} value={digits(row.waiting)} />
                    </dl>
                    {completion !== null && (
                      <div className="mt-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[11.5px] leading-4 text-dash-on-surface-variant">
                            {t("dashboard.th.completion")}
                          </p>
                          <p className="text-[12.5px] font-medium leading-4 tabular-nums text-dash-on-surface">
                            {digits(completion)}%
                          </p>
                        </div>
                        <div
                          aria-hidden="true"
                          className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-dash-surface-container"
                        >
                          {completion > 0 && (
                            <span
                              className="block h-full bg-dash-primary"
                              style={{ width: `${completion}%` }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Tablet / desktop: the aligned table, and the printed composition at
            any paper width (`print:block` beats the hidden base class). */}
        <div className="hidden overflow-x-auto md:block print:block">
          <table className="w-full min-w-[560px] border-collapse text-start">
            <thead>
              <tr className="border-b border-dash-outline-variant">
                <th scope="col" className="h-10 px-4 text-[11.5px] font-normal text-dash-on-surface-variant">
                  {identityLabel}
                </th>
                <th scope="col" className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant">
                  {t("dashboard.th.assigned")}
                </th>
                <th scope="col" className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant">
                  {t("status.boarded")}
                </th>
                <th scope="col" className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant">
                  {t("status.droppedOff")}
                </th>
                <th scope="col" className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant">
                  {t("status.absent")}
                </th>
                <th scope="col" className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant">
                  {t("dashboard.th.waiting")}
                </th>
                {withCompletion && (
                  <th scope="col" className="h-10 px-4 text-end text-[11.5px] font-normal text-dash-on-surface-variant">
                    {t("dashboard.th.completion")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={withCompletion ? 7 : 6}>{emptyLine}</td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-dash-outline-variant last:border-b-0 hover:bg-dash-surface-container-low"
                  >
                    <th scope="row" className="h-10 px-4 text-[13.5px] font-medium text-dash-on-surface">
                      {identity(row)}
                    </th>
                    <td className="px-4 text-end text-[13px] tabular-nums text-dash-on-surface">
                      {digits(row.assigned)}
                    </td>
                    <td className="px-4 text-end text-[13px] tabular-nums text-dash-on-surface">
                      {digits(row.boarded)}
                    </td>
                    <td className="px-4 text-end text-[13px] tabular-nums text-dash-on-surface">
                      {digits(row.droppedOff)}
                    </td>
                    <td className="px-4 text-end text-[13px] tabular-nums text-dash-on-surface">
                      {digits(row.absent)}
                    </td>
                    <td className="px-4 text-end text-[13px] tabular-nums text-dash-on-surface">
                      {digits(row.waiting)}
                    </td>
                    {withCompletion && completionOf && (
                      <td className="px-4 text-end text-[13px] tabular-nums text-dash-on-surface">
                        {digits(completionOf(row.assigned, row.boarded, row.droppedOff))}%
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** One label/value pair in the phone summary grid. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <dt className="min-w-0 text-[11.5px] leading-4 text-dash-on-surface-variant">{label}</dt>
      <dd className="flex-none text-[13px] leading-4 tabular-nums text-dash-on-surface">{value}</dd>
    </div>
  );
}

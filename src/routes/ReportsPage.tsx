import { useMemo, useState } from "react";
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
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { StudentList } from "@/components/dashboard/StudentList";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/lib/i18n/context";
import { formatDate, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

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
            <>
              <button
                type="button"
                onClick={() => setAnalyticsOpen(true)}
                disabled={live && loading}
                className="flex h-9 items-center gap-2 rounded-md border border-dash-outline-variant bg-dash-surface px-3 text-[12.5px] text-dash-on-surface transition-colors hover:bg-dash-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="monitoring" size={16} variant="outlined" className="text-dash-outline" />
                {t("reports.analytics")}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-9 items-center gap-2 rounded-md border border-dash-outline-variant bg-dash-surface px-3 text-[12.5px] text-dash-on-surface transition-colors hover:bg-dash-surface-container-low"
              >
                <Icon name="print" size={16} variant="outlined" className="text-dash-outline" />
                {t("reports.print")}
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex h-9 items-center gap-2 rounded-md bg-dash-on-surface px-3.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <Icon name="download" size={16} variant="outlined" />
                {t("reports.export")}
              </button>
            </>
          }
        />
      </div>

      <div className="border-y border-dash-outline-variant bg-dash-background px-4 py-2.5 sm:px-6 print:hidden">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
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

            <SummaryTable
              title={t("reports.byBus")}
              rows={byBus}
              identityLabel={t("dashboard.th.bus")}
              identity={(row) => translateDataLabel(row.bus, locale, t)}
              withCompletion
              completionOf={completionOf}
            />

            <SummaryTable
              title={t("reports.byGrade")}
              rows={byGrade}
              identityLabel={t("dashboard.th.grade")}
              identity={(row) => translateDataLabel(row.grade, locale, t)}
            />

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

interface SummaryRow {
  assigned: number;
  boarded: number;
  droppedOff: number;
  absent: number;
  waiting: number;
}

/** By-bus / by-grade summary: sentence-case headers, right-aligned figures. */
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

  return (
    <section className="flex flex-col gap-3 print:break-inside-avoid">
      <h2 className="text-[15px] font-semibold text-dash-on-surface">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-dash-outline-variant bg-dash-surface print:overflow-visible">
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
            {rows.map((row, index) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

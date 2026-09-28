import { useMemo, useState } from "react";
import type { RunSegmentId } from "@/data/dashboard";
import { summarizeByBus, summarizeByGrade, useDashboardData, todayDateStr } from "@/lib/school-data";
import { useStudentList } from "@/lib/use-student-list";
import { buildAttendanceCsv, downloadCsv } from "@/lib/csv";
import { ReportsSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { AnalyticsModal } from "@/components/dashboard/AnalyticsModal";
import { DateSegmentBar } from "@/components/dashboard/DateSegmentBar";
import { Icon } from "@/components/Icon";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { StudentList } from "@/components/dashboard/StudentList";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

export default function ReportsPage() {
  const { t, dir, locale } = useLocale();
  const ltr = dir === "ltr";
  const { showToast } = useToast();

  const [date, setDate] = useState<string | null>(null);
  const [segment, setSegment] = useState<RunSegmentId>("morning");
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const { kpis, attendance, loading, live } = useDashboardData(date, segment);

  const rows = useMemo(
    () => attendance.filter((row) => row.runType === segment),
    [attendance, segment],
  );
  const byBus = useMemo(() => summarizeByBus(rows), [rows]);
  const byGrade = useMemo(() => summarizeByGrade(rows), [rows]);
  const list = useStudentList(rows);

  function handleExport() {
    const dateStr = date ?? todayDateStr();
    downloadCsv(`report-${dateStr}.csv`, buildAttendanceCsv(list.filtered, t, locale));
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

  return (
    <>
      {/* Interactive header (hidden when printing). */}
      <div className="border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3 sm:px-6 print:hidden">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-dash-headline-lg text-dash-on-surface">{t("reports.title")}</h1>
            <p className="text-dash-body-sm text-dash-on-surface-variant">{t("reports.subtitle")}</p>
          </div>
          <div className="flex items-center gap-4">
            <DateSegmentBar
              date={date}
              onDateChange={setDate}
              segment={segment}
              onSegmentChange={setSegment}
            />
            <button
              type="button"
              onClick={() => setAnalyticsOpen(true)}
              disabled={live && loading}
              className="flex h-12 items-center gap-2 rounded border border-dash-outline px-4 text-dash-label-md uppercase text-dash-on-surface transition-colors hover:bg-dash-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="monitoring" size={16} variant="outlined" />
              {t("reports.analytics")}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-12 items-center gap-2 rounded border border-dash-outline px-4 text-dash-label-md uppercase text-dash-on-surface transition-colors hover:bg-dash-surface-container-high"
            >
              <Icon name="print" size={16} variant="outlined" />
              {t("reports.print")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex h-12 items-center gap-2 rounded border border-dash-outline px-4 text-dash-label-md uppercase text-dash-on-surface transition-colors hover:bg-dash-surface-container-high"
            >
              <Icon name="download" size={16} variant="outlined" />
              {t("reports.export")}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 sm:p-6 print:max-w-none print:p-0">
        {!live && (
          <div role="status" className="flex items-center gap-2 text-dash-body-sm text-dash-on-surface-variant">
            <Icon name="info" size={16} variant="outlined" />
            {t("dashboard.liveUnavailable")}
          </div>
        )}
        {live && loading ? (
          <div role="status" aria-label={t("dashboard.loading")}>
            <ReportsSkeleton />
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Icon name="description" size={40} variant="outlined" className="text-dash-on-surface-variant" />
            <p className="text-dash-headline-lg text-dash-on-surface">{t("reports.emptyTitle")}</p>
            <p className="text-dash-body-sm text-dash-on-surface-variant">{t("reports.emptySubtitle")}</p>
          </div>
        ) : (
          <>
            {/* Overview */}
            <section className="flex flex-col gap-4 print:break-inside-avoid">
              <h2
                className={`flex items-center gap-2 border-b border-dash-outline-variant pb-2 text-dash-label-md uppercase text-dash-on-surface ${
                  ltr ? "tracking-widest" : ""
                }`}
              >
                <Icon name="summarize" size={18} variant="outlined" />
                {t("reports.overview")}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
                {kpis.map((kpi) => (
                  <MetricCard key={kpi.id} kpi={kpi} />
                ))}
              </div>
            </section>

            {/* Summary by bus */}
            <section className="flex flex-col gap-4 print:break-inside-avoid">
              <h2
                className={`flex items-center gap-2 border-b border-dash-outline-variant pb-2 text-dash-label-md uppercase text-dash-on-surface ${
                  ltr ? "tracking-widest" : ""
                }`}
              >
                <Icon name="directions_bus" size={18} variant="outlined" />
                {t("reports.byBus")}
              </h2>
              <div className="overflow-x-auto rounded border border-dash-outline-variant bg-dash-surface print:overflow-visible">
                <table className="w-full min-w-[560px] border-collapse text-start">
                  <thead className="border-b border-dash-outline-variant bg-dash-surface-container text-dash-label-md uppercase text-dash-on-surface-variant">
                    <tr>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("dashboard.th.bus")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("dashboard.th.assigned")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.boarded")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.droppedOff")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.absent")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("dashboard.th.completion")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                    {byBus.map((s) => (
                      <tr key={s.bus}>
                        <td className="px-4 py-3 font-medium">{translateDataLabel(s.bus, locale, t)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.assigned), locale)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.boarded), locale)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.droppedOff), locale)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.absent), locale)}</td>
                        <td className="px-4 py-3 font-mono">
                          {toLocaleDigits(String(completionOf(s.assigned, s.boarded, s.droppedOff)), locale)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Summary by grade */}
            <section className="flex flex-col gap-4 print:break-inside-avoid">
              <h2
                className={`flex items-center gap-2 border-b border-dash-outline-variant pb-2 text-dash-label-md uppercase text-dash-on-surface ${
                  ltr ? "tracking-widest" : ""
                }`}
              >
                <Icon name="school" size={18} variant="outlined" />
                {t("reports.byGrade")}
              </h2>
              <div className="overflow-x-auto rounded border border-dash-outline-variant bg-dash-surface print:overflow-visible">
                <table className="w-full min-w-[480px] border-collapse text-start">
                  <thead className="border-b border-dash-outline-variant bg-dash-surface-container text-dash-label-md uppercase text-dash-on-surface-variant">
                    <tr>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("dashboard.th.grade")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("dashboard.th.assigned")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.boarded")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.droppedOff")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.absent")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                    {byGrade.map((s) => (
                      <tr key={s.grade}>
                        <td className="px-4 py-3 font-medium">{translateDataLabel(s.grade, locale, t)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.assigned), locale)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.boarded), locale)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.droppedOff), locale)}</td>
                        <td className="px-4 py-3 font-mono">{toLocaleDigits(String(s.absent), locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Full roster */}
            <section className="flex flex-col gap-4 print:break-inside-avoid">
              <h2
                className={`flex items-center gap-2 border-b border-dash-outline-variant pb-2 text-dash-label-md uppercase text-dash-on-surface ${
                  ltr ? "tracking-widest" : ""
                }`}
              >
                <Icon name="history_edu" size={18} variant="outlined" />
                {t("reports.roster")}
              </h2>
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

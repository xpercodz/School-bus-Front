import { useMemo, useState } from "react";
import type { RunSegmentId } from "@/data/dashboard";
import { useDashboardData, todayDateStr } from "@/lib/school-data";
import { useStudentList } from "@/lib/use-student-list";
import { buildAttendanceCsv, downloadCsv } from "@/lib/csv";
import { useToast } from "@/components/Toast";
import { BusCard } from "@/components/dashboard/BusCard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Icon } from "@/components/Icon";
import { LiveMapSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { StudentList } from "@/components/dashboard/StudentList";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";

export default function DashboardPage() {
  const [date, setDate] = useState<string | null>(null);
  const [segment, setSegment] = useState<RunSegmentId>("morning");
  const { kpis, buses, attendance, loading, live } = useDashboardData(date, segment);
  const { t, dir, locale } = useLocale();
  const ltr = dir === "ltr";
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  const { showToast } = useToast();

  // The table shows the selected run segment; search/grade/status filters and
  // pagination live in the shared student list state.
  const segmentRows = useMemo(
    () => attendance.filter((row) => row.runType === segment),
    [attendance, segment],
  );
  const list = useStudentList(segmentRows);

  function handleExport() {
    const dateStr = date ?? todayDateStr();
    downloadCsv(`attendance-${dateStr}.csv`, buildAttendanceCsv(list.filtered, t, locale));
    showToast(
      t("toast.exported", {
        count: toLocaleDigits(String(list.filtered.length), locale),
      }),
    );
  }

  // Counts derived from data so the header can never disagree with the grid.
  const enRoute = buses.filter((bus) => bus.status === "IN_PROGRESS").length;

  return (
    <>
      <FilterBar
        segment={segment}
        onSegmentChange={setSegment}
        date={date}
        onDateChange={setDate}
        onExport={handleExport}
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 sm:p-6">
        {!live && (
          <div role="status" className="flex items-center gap-2 text-dash-body-sm text-dash-on-surface-variant">
            <Icon name="info" size={16} variant="outlined" />
            {t("dashboard.liveUnavailable")}
          </div>
        )}
        {live && loading ? (
          <div role="status" aria-label={t("dashboard.loading")}>
            <LiveMapSkeleton />
          </div>
        ) : (
          <>
        {/* KPI cards */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <MetricCard key={kpi.id} kpi={kpi} />
          ))}
        </section>

        {/* Active fleet */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-dash-outline-variant pb-2">
            <h2
              className={`flex items-center gap-2 text-dash-label-md text-dash-on-surface uppercase ${
                ltr ? "tracking-widest" : ""
              }`}
            >
              <Icon name="directions_bus" size={18} variant="outlined" />
              {t("dashboard.activeFleet")}
            </h2>
            <span className="text-dash-body-sm text-dash-on-surface-variant">
              {enRoute === 1
                ? t("dashboard.enRouteOne", { count: toLocaleDigits(String(enRoute), locale) })
                : t("dashboard.enRouteMany", { count: toLocaleDigits(String(enRoute), locale) })}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {buses.map((bus) => (
              <BusCard key={bus.id} bus={bus} />
            ))}
          </div>
        </section>

        {/* Live attendance */}
        <StudentList list={list} onViewHistory={setHistoryStudent} />
          </>
        )}
      </div>

      <StudentHistorySheet
        studentName={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
    </>
  );
}

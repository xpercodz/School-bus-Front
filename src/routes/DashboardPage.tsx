import { useMemo, useState } from "react";
import type { RunSegmentId } from "@/data/dashboard";
import { useDashboardData, todayDateStr } from "@/lib/school-data";
import { useStudentList } from "@/lib/use-student-list";
import { buildAttendanceCsv, downloadCsv } from "@/lib/csv";
import { useSchoolName } from "@/lib/school";
import { useToast } from "@/components/Toast";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { FleetList } from "@/components/dashboard/FleetList";
import { Icon } from "@/components/Icon";
import { LiveMapSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { ManifestSummary } from "@/components/dashboard/Summary";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DispatchModal } from "@/components/dashboard/DispatchModal";
import { StudentHistorySheet } from "@/components/StudentHistorySheet";
import { StudentList } from "@/components/dashboard/StudentList";
import { useLocale } from "@/lib/i18n/context";
import { formatDate, toLocaleDigits } from "@/lib/i18n/format";

export default function DashboardPage() {
  const [date, setDate] = useState<string | null>(null);
  const [segment, setSegment] = useState<RunSegmentId>("morning");
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const { kpis, summary, finding, buses, attendance, loading, live } =
    useDashboardData(date, segment);
  const { t, locale } = useLocale();
  const schoolName = useSchoolName();
  const [historyStudent, setHistoryStudent] = useState<string | null>(null);
  const { showToast } = useToast();

  // The table shows the selected run segment; search/grade/status filters and
  // pagination live in the shared student list state.
  const segmentRows = useMemo(
    () => attendance.filter((row) => row.runType === segment),
    [attendance, segment],
  );
  const list = useStudentList(segmentRows);

  const effectiveDate = date ?? todayDateStr();
  const subtitle = t("dashboard.scope", {
    school: schoolName ?? t("dashboard.loading"),
    date: formatDate(effectiveDate, locale),
    segment: t(
      segment === "morning" ? "runType.morningPickup" : "runType.afternoonDropoff",
    ),
  });

  function handleExport() {
    downloadCsv(`attendance-${effectiveDate}.csv`, buildAttendanceCsv(list.filtered, t, locale));
    showToast(
      t("toast.exported", {
        count: toLocaleDigits(String(list.filtered.length), locale),
      }),
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <PageHeader
          title={t("dashboard.title")}
          subtitle={subtitle}
          finding={live && !loading ? finding : undefined}
          actions={
            <>
              <button
                type="button"
                onClick={handleExport}
                className="flex h-11 items-center gap-2 rounded-md border border-dash-outline-variant bg-dash-surface px-3 text-[12.5px] text-dash-on-surface transition-colors hover:bg-dash-surface-container-low sm:h-9"
              >
                <Icon name="download" size={16} variant="outlined" className="text-dash-outline" />
                {t("dashboard.export")}
              </button>
              <button
                type="button"
                onClick={() => setDispatchOpen(true)}
                className="flex h-11 items-center gap-2 rounded-md bg-dash-on-surface px-3.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 sm:h-9"
              >
                <Icon name="directions_bus" size={16} variant="outlined" />
                {t("dashboard.addRun")}
              </button>
            </>
          }
        />
      </div>

      <FilterBar
        segment={segment}
        onSegmentChange={setSegment}
        date={date}
        onDateChange={setDate}
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-5 sm:px-6">
        {!live && (
          <div
            role="status"
            className="flex items-center gap-2 text-[13px] text-dash-on-surface-variant"
          >
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
            <ManifestSummary summary={summary} kpis={kpis} />
            <FleetList buses={buses} />
            <StudentList list={list} onViewHistory={setHistoryStudent} />
          </>
        )}
      </div>

      <DispatchModal open={dispatchOpen} onClose={() => setDispatchOpen(false)} />
      <StudentHistorySheet
        studentName={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
    </>
  );
}

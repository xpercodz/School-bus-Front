import { useMemo, useState } from "react";
import type { RunSegmentId } from "@/data/dashboard";
import { useDashboardData, todayDateStr } from "@/lib/school-data";
import { useSelectedDate } from "@/lib/selected-date";
import { usePageReveal } from "@/lib/use-page-reveal";
import { buildAttendanceCsv, downloadCsv } from "@/lib/csv";
import { useSchoolName } from "@/lib/school";
import { useToast } from "@/components/Toast";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { FleetList } from "@/components/dashboard/FleetList";
import { BusOverviewModal } from "@/components/dashboard/BusOverviewModal";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/arc/button/button";
import { LiveMapSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { ManifestSummary } from "@/components/dashboard/Summary";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DispatchModal } from "@/components/dashboard/DispatchModal";
import { useLocale } from "@/lib/i18n/context";
import { formatDate, toLocaleDigits } from "@/lib/i18n/format";

export default function DashboardPage() {
  // This screen's own day — remembered for the tab, never shared with the
  // other day-scoped pages.
  const [date, setDate] = useSelectedDate("live");
  const [segment, setSegment] = useState<RunSegmentId>("morning");
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const { kpis, summary, finding, findingKind, buses, attendance, loading, live } =
    useDashboardData(date, segment);
  const { t, locale } = useLocale();
  const schoolName = useSchoolName();
  // One coordinated reveal when the data blocks actually render; a live
  // snapshot update does not replay it (ready does not change).
  usePageReveal(!loading);
  const [overviewBusId, setOverviewBusId] = useState<string | null>(null);
  const { showToast } = useToast();

  // The selected run segment's rows. The bus overview filters these to one bus;
  // Export writes all of them. The roster that used to read them lives on the
  // Students screen now, so there is no page-level list state here any more.
  const segmentRows = useMemo(
    () => attendance.filter((row) => row.runType === segment),
    [attendance, segment],
  );

  // The overview is live: it holds the bus id, then re-derives from the current
  // snapshot, so counts and student states keep updating while it is open.
  const overviewBus = overviewBusId
    ? (buses.find((bus) => bus.id === overviewBusId) ?? null)
    : null;
  const overviewRows = useMemo(
    () => (overviewBus ? segmentRows.filter((row) => row.busId === overviewBus.id) : []),
    [overviewBus, segmentRows],
  );

  const effectiveDate = date ?? todayDateStr();
  const subtitle = t("dashboard.scope", {
    school: schoolName ?? t("dashboard.loading"),
    date: formatDate(effectiveDate, locale),
    segment: t(
      segment === "morning" ? "runType.morningPickup" : "runType.afternoonDropoff",
    ),
  });

  // Export still reads the whole selected run segment, not the removed roster's
  // filtered page: the monitor no longer has filters of its own.
  function handleExport() {
    downloadCsv(`attendance-${effectiveDate}.csv`, buildAttendanceCsv(segmentRows, t, locale));
    showToast(
      t("toast.exported", {
        count: toLocaleDigits(String(segmentRows.length), locale),
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
          findingTone={findingKind}
          actions={
            <>
              <Button
                type="button"
                onClick={handleExport}
                aria-label={t("dashboard.export")}
                variant="secondary"
                size="md"
                data-hint="export"
                className="arc-field flex-none!"
              >
                <Icon name="download" size={16} variant="outlined" />
                <span className="hidden min-[360px]:inline">{t("dashboard.export")}</span>
              </Button>
              <Button
                type="button"
                onClick={() => setDispatchOpen(true)}
                variant="primary"
                size="md"
                data-hint="dispatch"
              >
                <Icon name="directions_bus" size={16} variant="outlined" />
                {t("dashboard.addRun")}
              </Button>
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
            {/* No Reveal here: each route row already has its own stagger, and
                a wrapper transform on top of that moved the rows twice. */}
            <FleetList buses={buses} onOpenBus={(bus) => setOverviewBusId(bus.id)} />
          </>
        )}
      </div>

      <DispatchModal open={dispatchOpen} onClose={() => setDispatchOpen(false)} />
      <BusOverviewModal
        bus={overviewBus}
        rows={overviewRows}
        onClose={() => setOverviewBusId(null)}
      />
    </>
  );
}

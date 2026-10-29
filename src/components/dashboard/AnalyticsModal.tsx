import { useMemo, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { BarChart } from "@/components/arc/bar-chart/bar-chart";
import { Button } from "@/components/arc/button/button";
import { DonutChart } from "@/components/arc/donut-chart/donut-chart";
import { SlideSegments } from "@/components/SlideSegments";
import type { BusSummary } from "@/lib/school-data";
import { useLocale } from "@/lib/i18n/context";
import { formatDate, toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";
import type { RunSegmentId } from "@/data/dashboard";

/** The donut's parts are buses, not statuses: a single-hue ramp keeps it from
 *  borrowing the status series palette, where red would mean "absent". */
function busTone(index: number, count: number): string {
  const step = count > 1 ? index / (count - 1) : 0;
  return `color-mix(in oklab, var(--color-primary) ${Math.round(100 - step * 55)}%, var(--color-surface-container-lowest))`;
}

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  /** Date of the report the modal was opened from (shown as context). */
  date: string | null;
  /** Bus totals for the report's selected date + segment (already computed). */
  byBus: readonly BusSummary[];
  /** Run segment of the report the modal was opened from (names the chart's period). */
  segment: RunSegmentId;
}

/**
 * Attendance analytics for the report the director is viewing — an overlay
 * opened from the Reports toolbar. One chart, two designs (bars or donut) over
 * the same completed-trips-per-bus series for that day and run segment. Every
 * number comes from the Reports page the modal was opened from; there is no
 * query in here, which is why opening it is instant.
 *
 * On a phone it is an 88dvh bottom sheet (the Dialog's auto placement); from
 * sm up it is the wide centered dialog. The panel classes are supplied in full
 * because `panelClassName` replaces the placement defaults, not extends them.
 */
export function AnalyticsModal({ open, onClose, date, byBus, segment }: AnalyticsModalProps) {
  const { t } = useLocale();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("analytics.title")}
      exitAnimation={false}
      panelClassName="w-full max-w-2xl max-h-[88dvh] rounded-t-2xl bg-dash-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:rounded-xl sm:pb-0 print:hidden"
    >
      {open && <AnalyticsBody date={date} byBus={byBus} segment={segment} onClose={onClose} />}
    </Dialog>
  );
}

const SEGMENT_LABEL_KEY: Record<RunSegmentId, "runType.morningPickup" | "runType.afternoonDropoff"> = {
  morning: "runType.morningPickup",
  afternoon: "runType.afternoonDropoff",
};

function AnalyticsBody({
  date,
  byBus,
  segment,
  onClose,
}: {
  date: string | null;
  byBus: readonly BusSummary[];
  segment: RunSegmentId;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();

  // The chart design is a drawing choice, not a data choice: both designs read
  // this same completed count per bus.
  const [chart, setChart] = useState<"bar" | "donut">("bar");
  const formatCount = (value: number) => toLocaleDigits(String(value), locale);
  const periodLabel = `${date ? formatDate(date, locale) : t("dashboard.today")} · ${t(SEGMENT_LABEL_KEY[segment])}`;
  const completedByBus = useMemo(
    () =>
      byBus.map((row) => ({
        key: row.bus,
        label: translateDataLabel(row.bus, locale, t),
        axisLabel: toLocaleDigits(row.bus.replace(/\D/g, ""), locale),
        value: row.boarded + row.droppedOff,
      })),
    [byBus, locale, t],
  );

  const sectionTitle = (icon: string, label: string) => (
    <h2
      className="flex items-center gap-2 text-[15px] font-semibold text-dash-on-surface"
    >
      <Icon name={icon} size={18} variant="outlined" />
      {label}
    </h2>
  );

  return (    <>
      {/* Sticky inside the sheet/dialog scroll area, solid (no glass). */}
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold leading-6 text-dash-on-surface sm:text-dash-headline-lg">
            {t("analytics.title")}
          </h2>
          <p className="mt-0.5 text-dash-body-sm text-dash-on-surface-variant">
            {date ? formatDate(date, locale) : t("dashboard.today")}
            {" · "}
            {t(SEGMENT_LABEL_KEY[segment])}
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

      <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">
        {byBus.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Icon
              name="query_stats"
              size={40}
              variant="outlined"
              className="text-dash-on-surface-variant"
            />
            <p className="text-dash-headline-lg text-dash-on-surface">{t("analytics.emptyTitle")}</p>
            <p className="text-dash-body-sm text-dash-on-surface-variant">
              {t("analytics.emptySubtitle")}
            </p>
          </div>
        ) : (
          <>
            {/* Per-bus comparison — one measure, two designs. Both read the same
                completed count per bus, so switching the drawing can never change
                the numbers it draws. */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {sectionTitle("directions_bus", t("analytics.perBus"))}
                <SlideSegments
                  variant="dash-box"
                  ariaLabel={t("analytics.chartDesign")}
                  options={[
                    { id: "bar", label: t("analytics.chartBar") },
                    { id: "donut", label: t("analytics.chartDonut") },
                  ]}
                  value={chart}
                  onChange={setChart}
                />
              </div>

              <div className="rounded-lg border border-dash-outline-variant bg-dash-surface p-3">
                {chart === "bar" ? (
                  <BarChart
                    data={completedByBus}
                    label={t("analytics.chartCompleted")}
                    period={periodLabel}
                    unit={t("analytics.studentsUnit")}
                    valueLabel={t("analytics.chartCompleted")}
                    categoryLabel={t("dashboard.th.bus")}
                    averageLabel={t("analytics.fleetAverage")}
                    averageValueLabel={t("analytics.averageShort")}
                    noDataLabel={t("analytics.noData")}
                    showAverage
                    formatValue={formatCount}
                  />
                ) : (
                  <DonutChart
                    data={completedByBus.map((bus, index) => ({
                      ...bus,
                      color: busTone(index, completedByBus.length),
                    }))}
                    label={t("analytics.chartCompleted")}
                    unit={t("analytics.studentsUnit")}
                    totalLabel={t("analytics.chartCompleted")}
                    emptyLabel={t("analytics.emptyTitle")}
                    formatValue={formatCount}
                  />
                )}
              </div>
            </section>

          </>
        )}
      </div>
    </>
  );
}

import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import type { BusSummary, TrendDay } from "@/lib/school-data";
import { useAttendanceTrend } from "@/lib/school-data";
import { useLocale } from "@/lib/i18n/context";
import {
  formatDate,
  toLocaleDigits,
  translateDataLabel,
} from "@/lib/i18n/format";
import type { RunSegmentId } from "@/data/dashboard";

const MAX_TREND_SPAN_DAYS = 31;

/** Days between two "YYYY-MM-DD" strings (inclusive of start). */
function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd).getTime();
  const e = new Date(ey, em - 1, ed).getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

/**
 * Segmented horizontal bar showing a share of a total.
 */
function RateBar({ value, total, tone }: { value: number; total: number; tone: string }) {
  const { locale } = useLocale();
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded bg-dash-surface-container-highest">
        <div className={`h-full rounded ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-dash-body-sm text-dash-on-surface-variant">
        {toLocaleDigits(String(pct), locale)}%
      </span>
    </div>
  );
}

/** One stacked column of the multi-day trend chart. */
function TrendBar({ day, max }: { day: TrendDay; max: number }) {
  const { t, locale } = useLocale();
  const segments = [
    { count: day.boarded, label: t("status.boarded"), cls: "bg-dash-success" },
    { count: day.droppedOff, label: t("status.droppedOff"), cls: "bg-dash-primary" },
    { count: day.absent, label: t("status.absent"), cls: "bg-dash-error" },
    { count: day.waiting, label: t("status.waiting"), cls: "bg-dash-warning" },
  ];
  return (
    <div className="flex min-w-8 flex-col items-center gap-1">
      <div className="flex h-36 w-8 flex-col-reverse justify-end overflow-hidden rounded-t bg-dash-surface-container-highest/40">
        {segments.map((seg) =>
          seg.count === 0 ? null : (
            <div
              key={seg.label}
              role="img"
              aria-label={`${seg.label}: ${toLocaleDigits(String(seg.count), locale)}`}
              className={`w-full ${seg.cls}`}
              style={{ height: `${(seg.count / max) * 100}%` }}
            />
          ),
        )}
      </div>
      <span className="text-[10px] text-dash-on-surface-variant">
        {formatDate(day.date, locale)}
      </span>
    </div>
  );
}

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  /** Date of the report the modal was opened from (shown as context). */
  date: string | null;
  /** Bus totals for the report's selected date + segment (already computed). */
  byBus: readonly BusSummary[];
  /** Run segment of the report the modal was opened from (trends follow it). */
  segment: RunSegmentId;
}

/**
 * Attendance analytics for the report the director is viewing — a modal opened
 * from the Reports toolbar. Shows the two views the printable report doesn't:
 * a visual per-bus rate-bar comparison and the multi-day trend chart. All
 * single-day data comes from the Reports page (no re-query); only the trend
 * fetches Firestore, and only while the modal is open (the body mounts on
 * open, DispatchModal-style).
 */
export function AnalyticsModal({ open, onClose, date, byBus, segment }: AnalyticsModalProps) {
  const { t } = useLocale();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("analytics.title")}
      panelClassName="w-full max-w-4xl rounded-2xl bg-dash-surface-container-low print:hidden"
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
  const { t, dir, locale } = useLocale();
  const ltr = dir === "ltr";

  const [trendStart, setTrendStart] = useState<string | null>(null);
  const [trendEnd, setTrendEnd] = useState<string | null>(null);

  // Trend range validation — only query when the range is sane.
  const rangeInvalid = Boolean(trendStart && trendEnd && trendStart > trendEnd);
  const rangeTooLong = Boolean(
    trendStart && trendEnd && daysBetween(trendStart, trendEnd) > MAX_TREND_SPAN_DAYS,
  );
  const rangeError = rangeInvalid
    ? t("analytics.rangeInvalid")
    : rangeTooLong
      ? t("analytics.rangeTooLong")
      : null;
  const trend = useAttendanceTrend(
    rangeError ? null : trendStart,
    rangeError ? null : trendEnd,
    segment,
  );

  const trendEmpty =
    trend.days.length > 0 &&
    trend.days.every((day) => day.boarded + day.droppedOff + day.absent + day.waiting === 0);
  const maxTotal = Math.max(
    1,
    ...trend.days.map((day) => day.boarded + day.droppedOff + day.absent + day.waiting),
  );

  const sectionTitle = (icon: string, label: string) => (
    <h2
      className={`flex items-center gap-2 border-b border-dash-outline-variant pb-2 text-dash-label-md uppercase text-dash-on-surface ${
        ltr ? "tracking-widest" : ""
      }`}
    >
      <Icon name={icon} size={18} variant="outlined" />
      {label}
    </h2>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-dash-outline-variant bg-dash-surface-container-low px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-dash-headline-lg text-dash-on-surface">{t("analytics.title")}</h2>
          <p className="text-dash-body-sm text-dash-on-surface-variant">
            {date ? formatDate(date, locale) : t("dashboard.today")}
            {" · "}
            {t(SEGMENT_LABEL_KEY[segment])}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
        >
          <Icon name="close" size={20} variant="outlined" />
        </button>
      </div>

      <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-5">
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
            {/* Per-bus comparison */}
            <section className="flex flex-col gap-4">
              {sectionTitle("directions_bus", t("analytics.perBus"))}
              <div className="overflow-x-auto rounded border border-dash-outline-variant bg-dash-surface">
                <table className="w-full min-w-[560px] border-collapse text-start">
                  <thead className="border-b border-dash-outline-variant bg-dash-surface-container text-dash-label-md uppercase text-dash-on-surface-variant">
                    <tr>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("dashboard.th.bus")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("dashboard.th.assigned")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.boarded")}</th>
                      <th scope="col" className="h-10 px-4 py-2 font-medium">{t("status.absent")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-outline-variant text-dash-body-sm text-dash-on-surface">
                    {byBus.map((s) => (
                      <tr key={s.bus} className="hover:bg-dash-surface-container-low">
                        <td className="px-4 py-3 font-medium">
                          {translateDataLabel(s.bus, locale, t)}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {toLocaleDigits(String(s.assigned), locale)}
                        </td>
                        <td className="px-4 py-3">
                          <RateBar value={s.boarded} total={s.assigned} tone="bg-dash-success" />
                        </td>
                        <td className="px-4 py-3">
                          <RateBar value={s.absent} total={s.assigned} tone="bg-dash-error" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Multi-day trend */}
            <section className="flex flex-col gap-4">
              {sectionTitle("monitoring", t("analytics.trendTitle"))}
              <p className="text-dash-body-sm text-dash-on-surface-variant">{t("analytics.trendHint")}</p>

              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-dash-body-sm text-dash-on-surface-variant">{t("analytics.startDate")}</span>
                  <input
                    type="date"
                    value={trendStart ?? ""}
                    onChange={(e) => setTrendStart(e.target.value || null)}
                    className="h-10 rounded border border-dash-outline-variant bg-dash-surface px-3 text-dash-body-sm text-dash-on-surface focus:border-dash-primary focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-dash-body-sm text-dash-on-surface-variant">{t("analytics.endDate")}</span>
                  <input
                    type="date"
                    value={trendEnd ?? ""}
                    onChange={(e) => setTrendEnd(e.target.value || null)}
                    className="h-10 rounded border border-dash-outline-variant bg-dash-surface px-3 text-dash-body-sm text-dash-on-surface focus:border-dash-primary focus:outline-none"
                  />
                </label>
              </div>

              {rangeError && (
                <p role="alert" className="text-dash-body-sm text-dash-error">{rangeError}</p>
              )}

              {trend.loading ? (
                <div role="status" className="flex items-center gap-2 py-8 text-dash-body-sm text-dash-on-surface-variant">
                  <Icon name="progress_activity" size={16} variant="outlined" className="animate-spin" />
                  {t("analytics.trendLoading")}
                </div>
              ) : trendEmpty ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Icon name="insights" size={32} variant="outlined" className="text-dash-on-surface-variant" />
                  <p className="text-dash-body-sm text-dash-on-surface-variant">{t("analytics.trendEmpty")}</p>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {trend.days.map((day) => (
                    <TrendBar key={day.date} day={day} max={maxTotal} />
                  ))}
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-dash-body-sm text-dash-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-dash-success" aria-hidden="true" />
                  {t("status.boarded")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-dash-primary" aria-hidden="true" />
                  {t("status.droppedOff")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-dash-error" aria-hidden="true" />
                  {t("status.absent")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-dash-warning" aria-hidden="true" />
                  {t("status.waiting")}
                </span>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

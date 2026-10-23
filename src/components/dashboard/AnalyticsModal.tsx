import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { staggerStyle } from "@/lib/motion";
import type { BusSummary, TrendDay } from "@/lib/school-data";
import { useAttendanceTrend } from "@/lib/school-data";
import { useLocale } from "@/lib/i18n/context";
import {
  formatDate,
  formatDayMonth,
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
function RateBar({
  value,
  total,
  tone,
  trackClassName = "w-24",
}: {
  value: number;
  total: number;
  tone: string;
  trackClassName?: string;
}) {
  const { locale } = useLocale();
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div
        className={`h-2 min-w-0 overflow-hidden rounded bg-dash-surface-container-highest ${trackClassName}`}
      >
        <div className={`h-full rounded ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="flex-none text-dash-body-sm tabular-nums text-dash-on-surface-variant">
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
    <div
      className="flex min-w-8 shrink-0 flex-col items-center gap-1.5"
      title={formatDate(day.date, locale)}
    >
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
      {/* Axis label: 11px, day + month, never wraps inside the 32px column.
          The column may grow to fit a longer Arabic month and the row scrolls. */}
      <span className="whitespace-nowrap text-center text-[11px] leading-tight text-dash-on-surface-variant">
        {formatDayMonth(day.date, locale)}
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
 * Attendance analytics for the report the director is viewing — an overlay
 * opened from the Reports toolbar. Shows the two views the printable report
 * doesn't: a visual per-bus rate-bar comparison and the multi-day trend chart.
 * All single-day data comes from the Reports page (no re-query); only the trend
 * fetches Firestore, and only while the modal is open (the body mounts on
 * open, DispatchModal-style).
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
      panelClassName="w-full max-w-4xl max-h-[88dvh] rounded-t-2xl bg-dash-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:rounded-xl sm:pb-0 print:hidden"
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
      className="flex items-center gap-2 text-[15px] font-semibold text-dash-on-surface"
    >
      <Icon name={icon} size={18} variant="outlined" />
      {label}
    </h2>
  );

  const dateInputClass =
    "h-11 w-full min-w-0 rounded-lg border border-dash-control-outline bg-dash-surface px-3 text-[16px] text-dash-on-surface outline-none transition-[border-color,box-shadow] duration-[var(--t-hover)] focus:border-dash-primary focus:ring-2 focus:ring-dash-primary/35 sm:h-10 sm:w-auto sm:text-dash-body-sm";

  return (
    <>
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
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="press flex h-11 w-11 flex-none items-center justify-center rounded-full text-dash-on-surface-variant hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
        >
          <Icon name="close" size={20} variant="outlined" />
        </button>
      </header>

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

              {/* Phones: one compact card per bus — no sideways-scrolling
                  table. Bar tracks flex to the card width. */}
              <ul className="flex flex-col gap-2 md:hidden">
                {byBus.map((s, index) => (
                  <li
                    key={s.bus}
                    className="stagger-in rounded-lg border border-dash-outline-variant bg-dash-surface-container-low px-3 py-3"
                    style={staggerStyle(index, byBus.length)}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[14px] font-medium text-dash-on-surface">
                        {translateDataLabel(s.bus, locale, t)}
                      </span>
                      <span className="flex-none text-[12.5px] text-dash-on-surface-variant">
                        {t("dashboard.th.assigned")}{" "}
                        <span className="font-medium tabular-nums text-dash-on-surface">
                          {toLocaleDigits(String(s.assigned), locale)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-16 flex-none text-[12px] text-dash-on-surface-variant">
                          {t("status.boarded")}
                        </span>
                        <RateBar
                          value={s.boarded}
                          total={s.assigned}
                          tone="bg-dash-success"
                          trackClassName="flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 flex-none text-[12px] text-dash-on-surface-variant">
                          {t("status.absent")}
                        </span>
                        <RateBar
                          value={s.absent}
                          total={s.assigned}
                          tone="bg-dash-error"
                          trackClassName="flex-1"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* md and up: the table. */}
              <div className="hidden overflow-x-auto rounded border border-dash-outline-variant bg-dash-surface md:block">
                <table className="w-full min-w-[560px] border-collapse text-start">
                  <thead className="border-b border-dash-outline-variant text-[11.5px] text-dash-on-surface-variant">
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
                        <td className="px-4 py-3 tabular-nums">
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

              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-dash-body-sm text-dash-on-surface-variant">{t("analytics.startDate")}</span>
                  <input
                    type="date"
                    value={trendStart ?? ""}
                    onChange={(e) => setTrendStart(e.target.value || null)}
                    className={dateInputClass}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-dash-body-sm text-dash-on-surface-variant">{t("analytics.endDate")}</span>
                  <input
                    type="date"
                    value={trendEnd ?? ""}
                    onChange={(e) => setTrendEnd(e.target.value || null)}
                    className={dateInputClass}
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
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {trend.days.map((day) => (
                    <TrendBar key={day.date} day={day} max={maxTotal} />
                  ))}
                </div>
              )}

              {/* Two columns on the narrowest screens, one flowing row above
                  sm — never four cramped columns. */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-dash-body-sm text-dash-on-surface-variant sm:flex sm:flex-wrap sm:gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 flex-none rounded bg-dash-success" aria-hidden="true" />
                  {t("status.boarded")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 flex-none rounded bg-dash-primary" aria-hidden="true" />
                  {t("status.droppedOff")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 flex-none rounded bg-dash-error" aria-hidden="true" />
                  {t("status.absent")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 flex-none rounded bg-dash-warning" aria-hidden="true" />
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

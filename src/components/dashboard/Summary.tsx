import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { DashboardSummary, KPI } from "@/data/dashboard";
import { STATUS_DOT } from "@/data/dashboard";
import type { StudentStatus } from "@/data/students";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";

/** Ink stays ink; the tone only colours the small mark beside the label. */
const MARK_CLASS: Record<StudentStatus, string> = {
  BOARDED: STATUS_DOT.BOARDED,
  DROPPED_OFF: STATUS_DOT.DROPPED_OFF,
  WAITING: STATUS_DOT.WAITING,
  ABSENT: STATUS_DOT.ABSENT,
};

/** The bar's inter-segment gap, in px, matching the track's `gap-0.5`. */
const BAR_GAP_PX = 2;
/** Width transition shared by every moving count/proportion on the screen. */
const WIDTH_MOTION = "transition-[width] duration-[var(--t-data)] ease-[var(--ease-out-soft)] motion-reduce:transition-none";

function KpiCell({
  kpi,
  mark,
  reserveLabelLines = false,
  className,
}: {
  kpi: KPI;
  mark?: StudentStatus;
  /** Reserve two label lines on phones so every figure starts on one baseline. */
  reserveLabelLines?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);

  return (
    <div className={`min-w-0 px-2.5 py-3.5 sm:px-5 sm:py-4 ${className ?? ""}`}>
      <div
        className={`flex items-start gap-1.5 ${reserveLabelLines ? "min-h-8 sm:min-h-0" : ""}`}
      >
        {mark && (
          <span
            className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${MARK_CLASS[mark]}`}
            aria-hidden="true"
          />
        )}
        {kpi.pulse && (
          <span
            className="pulse-dot mt-1 h-1.5 w-1.5 flex-none rounded-full bg-dash-success"
            aria-hidden="true"
          />
        )}
        {/* No truncate: at 360 a long label wraps to a second line rather than
            becoming an ellipsis. The figure below stays 26px. */}
        <p className="min-w-0 text-[11px] leading-4 font-medium text-dash-on-surface-variant sm:text-[11.5px]">
          {kpi.label}
        </p>
      </div>
      <p className="mt-1.5 text-[26px] leading-none font-semibold tabular-nums text-dash-on-surface">
        <AnimatedNumber value={kpi.value} format={digits} />
      </p>
      {/* The caption stays static text: only the figure travels. */}
      <p className="mt-1.5 text-[11px] leading-4 text-dash-on-surface-variant">{kpi.footer}</p>
    </div>
  );
}

/**
 * The dashboard's answer in one block: the accounted-for ratio, the run's
 * proportion as a four-part bar, and three counts. The total lives in the ratio
 * only, so no figure is printed twice.
 */
export function ManifestSummary({
  summary,
  kpis,
}: {
  summary: DashboardSummary;
  kpis: readonly KPI[];
}) {
  const { t, locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);
  const byId = (id: KPI["id"]) => kpis.find((kpi) => kpi.id === id);
  const onboard = byId("onboard");
  const dropped = byId("dropped");
  const unaccounted = byId("absent");

  const parts: { status: StudentStatus; value: number }[] = [
    { status: "BOARDED", value: summary.onboard },
    { status: "DROPPED_OFF", value: summary.dropped },
    { status: "WAITING", value: summary.waiting },
    { status: "ABSENT", value: summary.absent },
  ];
  const total = summary.total;

  // Zero-share segments are not rendered. Each width is reduced by its share of
  // the inter-segment gaps, so the segments plus the gaps add up to exactly
  // 100% — the bar cannot overflow its track at any proportion.
  const visibleParts = parts.filter((part) => part.value > 0);
  const gapCount = Math.max(0, visibleParts.length - 1);

  return (
    <section
      aria-label={t("dashboard.accounted", {
        accounted: digits(summary.accounted),
        total: digits(summary.total),
      })}
      data-page-reveal className="lift overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface"
    >
      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.6fr)]">
        <div className="border-b border-dash-outline-variant px-4 py-4 sm:px-5 lg:border-b-0 lg:border-e">
          <p className="text-[11.5px] font-medium text-dash-on-surface-variant">
            {t("dashboard.accountedLabel")}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <AnimatedNumber
              value={summary.accounted}
              format={digits}
              className="text-[34px] leading-none font-semibold tabular-nums text-dash-on-surface"
            />
            <span className="text-[13.5px] leading-5 text-dash-on-surface-variant">
              / {digits(summary.total)}
            </span>
          </div>

          {/* The run as one proportion. The counts beside it are the legend, so
              the bar carries no labels of its own. */}
          <div
            className="mt-4 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-dash-surface-container"
            aria-hidden="true"
          >
            {total > 0 &&
              visibleParts.map((part) => {
                const share = part.value / total;
                const pxGap = gapCount * BAR_GAP_PX * share;
                return (
                  <span
                    key={part.status}
                    className={`${MARK_CLASS[part.status]} h-full flex-none ${WIDTH_MOTION}`}
                    style={{ width: `calc(${(share * 100).toFixed(4)}% - ${pxGap.toFixed(2)}px)` }}
                  />
                );
              })}
          </div>
          <p className="mt-2 text-[11.5px] leading-4 text-dash-on-surface-variant">
            {t("kpi.total.footer", { count: digits(summary.totalBuses) })}
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-dash-outline-variant">
          {onboard && <KpiCell kpi={onboard} mark="BOARDED" reserveLabelLines />}
          {dropped && <KpiCell kpi={dropped} mark="DROPPED_OFF" reserveLabelLines />}
          {unaccounted && <KpiCell kpi={unaccounted} mark="WAITING" reserveLabelLines />}
        </div>
      </div>
    </section>
  );
}

/**
 * Border classes for one cell of a 2-up (phone) / 4-up (sm+) strip. Explicit
 * edges instead of `divide-x`/`divide-y`: the old pair drew an end rule on the
 * first cell of the second row, so the 2x2 grid had a dangling divider.
 */
function stripCellClass(index: number, count: number): string {
  if (count === 0) return "";
  const aloneOnLastRow = count % 2 === 1 && index === count - 1;
  const endsRow = index % 2 === 0 && index < count - 1;
  const hasNextInRow = index < count - 1;
  const hasRowBelow = index < count - (count % 2 === 0 ? 2 : 1);
  return [
    aloneOnLastRow ? "col-span-2" : "",
    endsRow ? "border-e" : "",
    hasRowBelow ? "border-b sm:border-b-0" : "",
    hasNextInRow ? "sm:border-e" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A plain four-cell strip for the printable report (no ratio block). */
export function KpiStrip({ kpis }: { kpis: readonly KPI[] }) {
  return (
    <section className="card-enter lift grid grid-cols-2 overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface sm:grid-cols-4">
      {kpis.map((kpi, index) => (
        <KpiCell
          key={kpi.id}
          kpi={kpi}
          className={`border-dash-outline-variant ${stripCellClass(index, kpis.length)}`}
        />
      ))}
    </section>
  );
}

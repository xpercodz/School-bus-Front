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

function KpiCell({ kpi, mark }: { kpi: KPI; mark?: StudentStatus }) {
  const { locale } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);

  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-center gap-1.5">
        {mark && (
          <span
            className={`h-1.5 w-1.5 flex-none rounded-full ${MARK_CLASS[mark]}`}
            aria-hidden="true"
          />
        )}
        {kpi.pulse && (
          <span
            className="pulse-dot h-1.5 w-1.5 flex-none rounded-full bg-dash-success"
            aria-hidden="true"
          />
        )}
        <p className="truncate text-[11.5px] font-medium text-dash-on-surface-variant">
          {kpi.label}
        </p>
      </div>
      <p className="mt-1.5 text-[26px] leading-none font-semibold tabular-nums text-dash-on-surface">
        {digits(kpi.value)}
      </p>
      <p className="mt-1.5 hidden text-[11px] leading-4 text-dash-on-surface-variant sm:block">
        {kpi.footer}
      </p>
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

  return (
    <section
      aria-label={t("dashboard.accounted", {
        accounted: digits(summary.accounted),
        total: digits(summary.total),
      })}
      className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface"
    >
      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.6fr)]">
        <div className="border-b border-dash-outline-variant px-4 py-4 sm:px-5 lg:border-b-0 lg:border-e">
          <p className="text-[11.5px] font-medium text-dash-on-surface-variant">
            {t("dashboard.accountedLabel")}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[34px] leading-none font-semibold tabular-nums text-dash-on-surface">
              {digits(summary.accounted)}
            </span>
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
              parts.map((part) =>
                part.value > 0 ? (
                  <span
                    key={part.status}
                    className={`${MARK_CLASS[part.status]} h-full`}
                    style={{ width: `${(part.value / total) * 100}%` }}
                  />
                ) : null,
              )}
          </div>
          <p className="mt-2 text-[11.5px] leading-4 text-dash-on-surface-variant">
            {t("kpi.total.footer", { count: digits(summary.totalBuses) })}
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-dash-outline-variant">
          {onboard && <KpiCell kpi={onboard} mark="BOARDED" />}
          {dropped && <KpiCell kpi={dropped} mark="DROPPED_OFF" />}
          {unaccounted && <KpiCell kpi={unaccounted} mark="WAITING" />}
        </div>
      </div>
    </section>
  );
}

/** A plain four-cell strip for the printable report (no ratio block). */
export function KpiStrip({ kpis }: { kpis: readonly KPI[] }) {
  return (
    <section className="grid grid-cols-2 divide-x divide-y divide-dash-outline-variant overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface sm:grid-cols-4 sm:divide-y-0">
      {kpis.map((kpi) => (
        <KpiCell key={kpi.id} kpi={kpi} />
      ))}
    </section>
  );
}

import type { KPI } from "@/data/dashboard";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits } from "@/lib/i18n/format";

interface MetricCardProps {
  kpi: KPI;
}

/**
 * One KPI stat card for the director dashboard.
 *
 * Faithful to code.html's Material 3 light cards. Three tones:
 * - "default": neutral surface card, optional label accent (success/error);
 * - "success": green container card with a start-hand accent bar and a live
 *   pulse dot beside the label;
 * - "error": red-outlined card with a start accent border and an error icon.
 *
 * label/footer arrive already localized from useDashboardData; only the number
 * needs locale-aware digit conversion here.
 */
export function MetricCard({ kpi }: MetricCardProps) {
  const { locale, dir } = useLocale();
  const ltr = dir === "ltr";
  const baseClass = "relative flex flex-col gap-2 rounded border p-4";

  let cardClass: string;
  let labelClass: string;
  let valueClass: string;
  let footerClass: string;

  if (kpi.tone === "success") {
    cardClass = `${baseClass} border-dash-success-container bg-dash-success-container`;
    labelClass = "text-dash-on-success-container";
    valueClass = "text-dash-on-success-container";
    footerClass = "text-dash-on-success-container";
  } else if (kpi.tone === "error") {
    cardClass = `${baseClass} border-dash-error/30 border-s-4 border-s-dash-error bg-dash-error-container/20`;
    labelClass = "text-dash-error";
    valueClass = "text-dash-error";
    footerClass = "text-dash-error";
  } else {
    cardClass = `${baseClass} border-dash-outline-variant bg-dash-surface`;
    labelClass =
      kpi.labelAccent === "success"
        ? "text-dash-success"
        : kpi.labelAccent === "error"
          ? "text-dash-error"
          : "text-dash-on-surface-variant";
    valueClass = "text-dash-on-surface";
    footerClass = "text-dash-on-surface-variant";
  }

  const isSuccess = kpi.tone === "success";

  return (
    <div className={cardClass}>
      {isSuccess && (
        <div className="absolute end-0 top-0 h-full w-1 bg-dash-success" aria-hidden="true" />
      )}
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`text-dash-label-md uppercase ${ltr ? "tracking-widest" : ""} ${labelClass}`}
        >
          {kpi.label}
        </h3>
        {kpi.pulse && (
          <span
            className="mt-1 h-3 w-3 rounded-full bg-dash-success pulse-dot"
            aria-hidden="true"
          />
        )}
      </div>
      <div className={`font-mono text-dash-metric-xl ${valueClass}`}>
        {toLocaleDigits(String(kpi.value), locale)}
      </div>
      <div
        className={`mt-auto flex items-center justify-end gap-1 text-end text-dash-body-sm ${footerClass}`}
      >
        {kpi.footerIcon && <Icon name={kpi.footerIcon} size={14} variant="outlined" />}
        <span>{kpi.footer}</span>
      </div>
    </div>
  );
}

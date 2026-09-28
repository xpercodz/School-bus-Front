import type { Bus } from "@/data/dashboard";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

/**
 * One fleet bus card in the "Active Fleet Status" grid.
 *
 * Card shows the bus name/driver, a status badge (pulsing for in-progress runs),
 * route progress, and a live onboard / dropped-off / waiting tally. Presentational
 * and inert in the UI-only build.
 */
export function BusCard({ bus }: { bus: Bus }) {
  const { t, locale } = useLocale();
  const isInProgress = bus.status === "IN_PROGRESS";

  return (
    <div
      className={`flex flex-col gap-4 rounded border p-4 ${
        isInProgress ? "border-dash-primary/30 bg-dash-surface" : "border-dash-outline-variant bg-dash-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-semibold text-dash-on-surface">
            {translateDataLabel(bus.name, locale, t)}
          </h4>
          <p className="font-mono text-dash-body-sm text-dash-on-surface-variant">
            {t("dashboard.driver", { name: bus.driver })}
          </p>
        </div>
        {isInProgress ? (
          <span className="flex items-center gap-1 rounded border border-dash-primary/20 bg-dash-primary-container px-2 py-0.5 text-dash-label-md uppercase text-dash-on-primary-container">
            <span className="h-1.5 w-1.5 rounded-full bg-dash-primary animate-pulse" aria-hidden="true" />
            {t("dashboard.inProgress")}
          </span>
        ) : (
          <span className="rounded border border-dash-outline bg-dash-surface-container px-2 py-0.5 text-dash-label-md uppercase text-dash-on-surface-variant">
            {t("dashboard.completed")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between font-mono text-dash-label-md text-dash-on-surface-variant">
          <span>{t("dashboard.routeProgress")}</span>
          <span>{toLocaleDigits(String(bus.progress), locale)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-dash-surface-container-highest">
          <div
            className={`h-full rounded-full ${isInProgress ? "bg-dash-primary" : "bg-dash-success"}`}
            style={{ width: `${bus.progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 border-t border-dash-outline-variant/50 pt-2 text-center font-mono">
        <div className="flex flex-col">
          <span className="text-dash-success">{toLocaleDigits(String(bus.onboard), locale)}</span>
          <span className="text-[10px] uppercase text-dash-on-surface-variant">{t("dashboard.in")}</span>
        </div>
        <div className="flex flex-col border-x border-dash-outline-variant/50">
          <span className="text-dash-on-surface">{toLocaleDigits(String(bus.droppedOff), locale)}</span>
          <span className="text-[10px] uppercase text-dash-on-surface-variant">{t("dashboard.out")}</span>
        </div>
        <div className="flex flex-col">
          <span className={bus.waiting > 0 ? "text-dash-error" : "text-dash-on-surface-variant"}>
            {toLocaleDigits(String(bus.waiting), locale)}
          </span>
          <span className="text-[10px] uppercase text-dash-on-surface-variant">{t("dashboard.wait")}</span>
        </div>
      </div>
    </div>
  );
}

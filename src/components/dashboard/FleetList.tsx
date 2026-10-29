import type { Bus } from "@/data/dashboard";
import { Icon } from "@/components/Icon";
import { RouteLine } from "@/components/dashboard/RouteLine";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

export function StatusPill({ bus }: { bus: Bus }) {
  const { t, locale } = useLocale();
  const signedOffWithWaiting = bus.status === "COMPLETED" && bus.waiting > 0;

  const className = signedOffWithWaiting
    ? "bg-dash-warning-container text-dash-on-warning-container"
    : bus.status === "IN_PROGRESS"
      ? "bg-dash-primary-container text-dash-on-primary-container"
      : "bg-dash-surface-container text-dash-on-surface-variant";
  const dot = signedOffWithWaiting
    ? "bg-dash-warning"
    : bus.status === "IN_PROGRESS"
      ? "bg-dash-primary"
      : "bg-dash-outline";

  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-medium ${className}`}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${dot}`} aria-hidden="true" />
      {signedOffWithWaiting
        ? `${t("dashboard.completed")} · ${t("dashboard.wait")} ${toLocaleDigits(String(bus.waiting), locale)}`
        : t(bus.status === "IN_PROGRESS" ? "dashboard.inProgress" : "dashboard.completed")}
    </span>
  );
}

interface FleetListProps {
  buses: readonly Bus[];
  /** Open the bus overview (students on board, dropped off, still waiting). */
  onOpenBus: (bus: Bus) => void;
}

/**
 * Routes as rows, not four identical cards: each row is one run with its own
 * route line, the bus's position on it, and the three counts that matter. The
 * line is the product's own object — a route — not decoration.
 *
 * A row opens that bus's overview. The whole row is the hit area, so the target
 * is one overlay button (native Enter/Space, one accessible name) rather than a
 * click handler on an article; the trailing chevron is its visible affordance.
 * The route line and its bead transition once per change; on top of that a
 * highlight runs the travelled part of each live line every few seconds
 * (`.route-flow` in globals.css) — the one looping thing on the screen, and it
 * is switched off under reduced motion.
 */
export function FleetList({ buses, onOpenBus }: FleetListProps) {
  const { t, locale, dir } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);
  const active = buses.filter((bus) => bus.status === "IN_PROGRESS").length;
  const chevron = dir === "rtl" ? "chevron_left" : "chevron_right";
  const chevronClass =
    "flex-none text-dash-outline transition-colors duration-[var(--t-hover)] group-hover:text-dash-primary";

  return (
    <section data-page-reveal aria-labelledby="routes-title" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <h2 id="routes-title" className="text-[15px] font-semibold text-dash-on-surface">
          {t("dashboard.activeFleet")}
        </h2>
        <p className="text-[12.5px] text-dash-on-surface-variant">
          {t("dashboard.enRouteOf", {
            active: digits(active),
            total: digits(buses.length),
          })}
        </p>
      </div>

      <div className="lift overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
        {buses.length === 0 ? (
          <p className="px-4 py-6 text-[13.5px] text-dash-on-surface-variant">
            {t("dashboard.noRoutes")}
          </p>
        ) : (
          buses.map((bus, row) => {
            const busName = translateDataLabel(bus.name, locale, t);
            return (
              <article
                key={bus.id}
                data-page-reveal
                className="group relative grid grid-cols-1 gap-3 border-b border-dash-outline-variant px-4 py-4 transition-colors duration-[var(--t-hover)] last:border-b-0 hover:bg-dash-surface-container-low md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)_auto_auto] md:items-center md:gap-5"
              >
                {/* The row's whole area is the control. One native button keeps
                    the accessible name, Enter/Space, and focus on the row; the
                    ring is inset so it traces the row, not the card. */}
                <button
                  type="button"
                  onClick={() => onOpenBus(bus)}
                  aria-label={t("fleet.openAria", { bus: busName })}
                  className="absolute inset-0 z-10 cursor-pointer rounded-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dash-primary"
                />
                <div className="flex min-w-0 items-start justify-between gap-3 md:block">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-dash-on-surface">
                      {busName}
                    </h3>
                    <p className="mt-0.5 truncate text-[12px] text-dash-on-surface-variant">
                      {bus.driver ? t("dashboard.driver", { name: bus.driver }) : t("dashboard.noDriver")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 md:hidden">
                    <StatusPill bus={bus} />
                    <Icon name={chevron} size={18} variant="outlined" className={chevronClass} />
                  </div>
                </div>

                <div className="min-w-0 md:pe-2">
                  <div className="flex items-center justify-between gap-2 text-[11.5px] text-dash-on-surface-variant">
                    {/* The name is redundant beside a line and a percentage, and
                        below lg it would wrap the row onto a second line. It
                        stays available to assistive tech. */}
                    <span className="hidden lg:inline">{t("dashboard.routeProgress")}</span>
                    <span className="sr-only lg:hidden">{t("dashboard.routeProgress")}</span>
                    <span className="ms-auto tabular-nums">
                      {t("dashboard.routeComplete", { percent: digits(bus.progress) })}
                    </span>
                  </div>
                  <RouteLine
                    progress={bus.progress}
                    completed={bus.status === "COMPLETED"}
                    live={bus.status === "IN_PROGRESS"}
                    sweepRow={row}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 md:w-48">
                  <div>
                    <p className="text-[14px] font-semibold tabular-nums text-dash-on-surface">
                      {digits(bus.onboard)}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-[11.5px] leading-4 text-dash-on-surface-variant">
                      {t("dashboard.in")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold tabular-nums text-dash-on-surface">
                      {digits(bus.droppedOff)}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-[11.5px] leading-4 text-dash-on-surface-variant">
                      {t("dashboard.out")}
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-[14px] font-semibold tabular-nums ${
                        bus.waiting > 0 ? "text-dash-warning" : "text-dash-on-surface"
                      }`}
                    >
                      {digits(bus.waiting)}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap text-[11.5px] leading-4 text-dash-on-surface-variant">
                      {t("dashboard.wait")}
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 md:flex">
                  <StatusPill bus={bus} />
                  <Icon name={chevron} size={18} variant="outlined" className={chevronClass} />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

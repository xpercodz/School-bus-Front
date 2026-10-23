import type { Bus } from "@/data/dashboard";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";
import { toLocaleDigits, translateDataLabel } from "@/lib/i18n/format";

/** One width/offset transition for the route line and the bead that rides it. */
const ROUTE_MOTION = "duration-[var(--t-data)] ease-[var(--ease-out-soft)] motion-reduce:transition-none";

function StatusPill({ bus }: { bus: Bus }) {
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

/**
 * Routes as rows, not four identical cards: each row is one run with its own
 * route line, the bus's position on it, and the three counts that matter. The
 * line is the product's own object — a route — not decoration.
 *
 * Rows are not interactive, so they carry no hover fill; only the route line
 * and its bead move (one 500ms transition per change, never a loop).
 */
export function FleetList({ buses }: { buses: readonly Bus[] }) {
  const { t, locale, dir } = useLocale();
  const digits = (n: number) => toLocaleDigits(String(n), locale);
  const active = buses.filter((bus) => bus.status === "IN_PROGRESS").length;
  // The bead is centred on its point. `translate(-50%)` is physical, so in RTL
  // it skated half a bead to the wrong side of the route mark; mirror it.
  const beadShift = dir === "rtl" ? "translate(50%, -50%)" : "translate(-50%, -50%)";

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
          buses.map((bus) => {
            const progress = Math.min(100, Math.max(0, bus.progress));
            return (
              <article
                key={bus.id}
                data-page-reveal
                className="press-none grid grid-cols-1 gap-3 border-b border-dash-outline-variant px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)_auto_auto] md:items-center md:gap-6"
              >
                <div className="flex min-w-0 items-start justify-between gap-3 md:block">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-dash-on-surface">
                      {translateDataLabel(bus.name, locale, t)}
                    </h3>
                    <p className="mt-0.5 truncate text-[12px] text-dash-on-surface-variant">
                      {bus.driver ? t("dashboard.driver", { name: bus.driver }) : t("dashboard.noDriver")}
                    </p>
                  </div>
                  <div className="md:hidden">
                    <StatusPill bus={bus} />
                  </div>
                </div>

                <div className="min-w-0 md:pe-2">
                  <div className="flex items-center justify-between gap-2 text-[11.5px] text-dash-on-surface-variant">
                    <span>{t("dashboard.routeProgress")}</span>
                    <span className="tabular-nums">
                      {t("dashboard.routeComplete", { percent: digits(progress) })}
                    </span>
                  </div>
                  <div className="relative mt-2 h-5" aria-hidden="true">
                    <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-dash-surface-container-high" />
                    <span
                      className={`absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full ${
                        bus.status === "COMPLETED" ? "bg-dash-outline" : "bg-dash-primary"
                      } transition-[width] ${ROUTE_MOTION}`}
                      style={{ width: `${progress}%` }}
                    />
                    <span
                      className={`absolute top-1/2 flex h-5 w-5 items-center justify-center rounded-full ${
                        bus.status === "COMPLETED"
                          ? "border border-dash-outline bg-dash-surface text-dash-outline"
                          : "bg-dash-primary text-dash-on-primary"
                      } transition-[inset-inline-start] ${ROUTE_MOTION}`}
                      style={{
                        // Clamped so a 0% or 100% bead still sits fully inside
                        // the line instead of hanging over the card edge.
                        insetInlineStart: `clamp(10px, ${progress}%, calc(100% - 10px))`,
                        transform: beadShift,
                      }}
                    >
                      <Icon name="directions_bus" size={12} variant="outlined" />
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:w-52">
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

                <div className="hidden md:block">
                  <StatusPill bus={bus} />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

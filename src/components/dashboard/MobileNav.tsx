import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { NAV_ITEMS } from "@/data/dashboard";
import { activeIdFromPathname } from "@/data/dashboard";
import { useLocale } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/types";

/** Short labels: four destinations must fit a 320px row without truncation. */
const SHORT_LABEL: Record<string, MessageKey> = {
  "live-map": "nav.shortLive",
  reports: "nav.shortReports",
  assignments: "nav.shortAssignments",
  drivers: "nav.shortDrivers",
};

/**
 * Phone navigation for the director area: the four real destinations in a
 * stable bottom bar (the drawer stays for Help/Settings/language/account).
 * A 3px indicator slides between equal-width destinations; the icons are
 * filled for the active page and outlined for the rest, so selection does not
 * rely on colour alone. Safe-area padding keeps it above the home indicator.
 */
export function MobileNav() {
  const { t, dir } = useLocale();
  const { pathname } = useLocation();
  const activeId = activeIdFromPathname(pathname);
  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === activeId),
  );
  const offset = dir === "rtl" ? -activeIndex * 100 : activeIndex * 100;
  const initialActiveId = useRef(activeId);
  const destinationChanged = activeId !== initialActiveId.current;

  return (
    <nav
      aria-label={t("nav.primaryAria")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-dash-outline-variant bg-dash-background pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <div className="relative mx-auto flex h-16 max-w-[560px] items-stretch">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute start-0 top-0 z-10 h-[3px] rounded-full bg-dash-primary transition-transform duration-[var(--t-ui)] ease-[var(--ease-out-soft)] motion-reduce:transition-none"
          style={{
            width: `${100 / NAV_ITEMS.length}%`,
            transform: `translateX(${offset}%)`,
          }}
        />
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              to={item.href}
              aria-current={active ? "page" : undefined}
              className={`press flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 ${
                active
                  ? "text-dash-on-surface"
                  : "text-dash-on-surface-variant hover:text-dash-on-surface"
              }`}
            >
              <span
                key={active ? "on" : "off"}
                className={active ? `${destinationChanged ? "icon-pop " : ""}flex` : "flex"}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  variant={active ? "rounded" : "outlined"}
                  className={active ? "text-dash-primary" : "text-dash-outline"}
                />
              </span>
              <span
                className={`w-full truncate text-center text-[11px] leading-4 ${
                  active ? "font-semibold" : "font-medium"
                }`}
              >
                {t(SHORT_LABEL[item.id])}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

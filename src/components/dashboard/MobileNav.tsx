import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { activeIdFromPathname } from "@/data/dashboard";
import { visibleNavItems } from "@/lib/permissions";
import { useMainDirector } from "@/lib/main-director";
import { useUserProfile } from "@/lib/user-profile";
import { useLocale } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/types";

/** Short labels: the row must fit 320px without truncation (six for the main
 *  director — 53px each, still above the 44px thumb floor). */
const SHORT_LABEL: Record<string, MessageKey> = {
  "live-map": "nav.shortLive",
  students: "nav.shortStudents",
  reports: "nav.shortReports",
  assignments: "nav.shortAssignments",
  drivers: "nav.shortDrivers",
  activity: "nav.shortActivity",
};

/**
 * Phone navigation for the director area: the five real destinations in a
 * stable bottom bar (the drawer stays for Help/Settings/language/account).
 * A 3px indicator slides between equal-width destinations; the icons are
 * filled for the active page and outlined for the rest, so selection does not
 * rely on colour alone. Safe-area padding keeps it above the home indicator.
 *
 * The indicator is exactly one destination wide, and its travel is measured in
 * its own width — so the maths derive from the item count and adding or
 * removing a destination needs no edit here. At 320px, five destinations are
 * 64px each; the main director's seven are ~46px, which is why every label
 * here is a short one and the bar must not grow past seven.
 */
export function MobileNav() {
  const { t, dir } = useLocale();
  const { pathname } = useLocation();
  const { profile } = useUserProfile();
  const mainDirector = useMainDirector();
  const activeId = activeIdFromPathname(pathname);
  // Only the destinations this reader holds. The indicator's width and travel
  // are derived from that count, so losing a destination needs no other edit.
  const items = visibleNavItems(profile, mainDirector);
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );
  const destinationWidth = `${100 / Math.max(1, items.length)}%`;
  // One destination is 100% of the indicator's own width; RTL walks toward the
  // start edge, hence the negative step.
  const offset = (dir === "rtl" ? -activeIndex : activeIndex) * 100;
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
            width: destinationWidth,
            transform: `translateX(${offset}%)`,
          }}
        />
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              to={item.href}
              aria-current={active ? "page" : undefined}
              className={`press flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 ${
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

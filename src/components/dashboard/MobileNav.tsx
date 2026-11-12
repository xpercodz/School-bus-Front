import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { activeIdFromPathname, NAV_LABEL_KEY } from "@/data/dashboard";
import { visibleNavItems } from "@/lib/permissions";
import { useMainDirector } from "@/lib/main-director";
import { useUserProfile } from "@/lib/user-profile";
import { useLocale } from "@/lib/i18n/context";

/**
 * Phone navigation for the director area.
 *
 * Icons only. The bar used to carry a short label under each icon, and with six
 * or seven destinations on a 320px phone the words truncated mid-syllable
 * ("Stude…"), which is worse than no word at all: a label that has to be
 * guessed is not a label. The design is taken from the other client's phone
 * rail — a recessed pill with a raised thumb that slides to the current
 * destination — because that pattern already solves "more destinations than
 * words fit".
 *
 * Consequences worth keeping:
 * - every destination is a fixed 44px cell, so nothing shrinks as the set
 *   grows and the thumb always lands on a square target;
 * - the accessible name is the FULL nav label, not the truncated one, and it is
 *   never hidden by width — the icon is the only thing that changed;
 * - the thumb is measured from the live active link rather than computed from
 *   the item count, so RTL, a font swap or a changed item set needs no maths
 *   here.
 */
export function MobileNav() {
  const { t } = useLocale();
  const { pathname } = useLocation();
  const { profile } = useUserProfile();
  const mainDirector = useMainDirector();
  const activeId = activeIdFromPathname(pathname);
  const items = visibleNavItems(profile, mainDirector);

  const railRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0, ready: false });
  const initialActiveId = useRef(activeId);
  const destinationChanged = activeId !== initialActiveId.current;

  /** Put the raised thumb under whichever link is current. */
  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      // A route this bar has no item for: hide rather than park the thumb under
      // the last destination, which would claim the reader is somewhere else.
      setThumb((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    const { offsetLeft: left, offsetWidth: width } = active;
    setThumb((prev) =>
      prev.left === left && prev.width === width && prev.ready
        ? prev
        : { left, width, ready: true },
    );
  }, []);

  // Route change moves `aria-current`, which moves the thumb.
  useLayoutEffect(() => {
    measure();
  }, [measure, pathname]);

  // A size change (an item appearing, the heading font landing, a rotation)
  // moves the cell without moving the route.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(rail);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(() => measure());
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("nav.primaryAria")}
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden print:hidden"
    >
      <div
        ref={railRef}
        className="relative flex items-center gap-0.5 rounded-full border border-dash-outline-variant bg-dash-surface-container p-1"
      >
        {/* The raised thumb: the only thing on the row with a shadow, because
            it is the only thing that claims to sit on top of the rail. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1 bottom-1 z-0 rounded-full bg-dash-surface ring-1 ring-dash-outline-variant transition-[left,width] duration-[var(--t-ui)] ease-[var(--ease-out-soft)] motion-reduce:transition-none ${
            thumb.ready ? "opacity-100" : "opacity-0"
          }`}
          style={{ left: thumb.left, width: thumb.width }}
        />

        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              to={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={t(NAV_LABEL_KEY[item.id])}
              className={`press relative z-10 flex size-11 items-center justify-center rounded-full max-[360px]:size-10 ${
                active
                  ? "text-dash-on-surface"
                  : "text-dash-outline hover:text-dash-on-surface-variant"
              }`}
            >
              <span
                key={active ? "on" : "off"}
                className={active ? `${destinationChanged ? "icon-pop " : ""}flex` : "flex"}
              >
                <Icon
                  name={item.icon}
                  size={21}
                  variant={active ? "rounded" : "outlined"}
                  className={active ? "text-dash-primary" : undefined}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

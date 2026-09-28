import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { NAV_ITEMS } from "@/data/dashboard";
import { DispatchModal } from "./DispatchModal";
import { useLocale } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/types";

/** Nav label key per item id (labels are translated, ids are stable). */
const NAV_LABEL_KEY: Record<string, MessageKey> = {
  "live-map": "nav.liveMap",
  fleet: "nav.fleet",
  routes: "nav.routes",
  reports: "nav.reports",
  assignments: "nav.assignments",
  drivers: "nav.drivers",
};

interface SidebarProps {
  /** id of the nav item currently shown (e.g. "live-map"); rendered as the active page. */
  activeId: string;
  /** The signed-in tenant's school name (shown as the subtitle). */
  schoolName?: string | null;
  /** Drawer open state — on desktop (≥lg) the sidebar is always visible and this is ignored. */
  open: boolean;
  /** Close the mobile drawer (nav click, close button, backdrop, Escape). */
  onClose: () => void;
}

/**
 * Director dashboard nav rail. On desktop (≥lg) it's the fixed sidebar; below
 * that it becomes an inline-end drawer opened from the top bar (rendered via
 * the shared Dialog so focus trap / Escape / scroll-lock come for free). Flips
 * to the right in RTL — the drawer panel's border-s tracks the content edge.
 */
export function Sidebar({ activeId, schoolName, open, onClose }: SidebarProps) {
  const { t } = useLocale();
  const [dispatchOpen, setDispatchOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed rail, always visible. */}
      <nav className="fixed inset-y-0 start-0 z-20 w-64 border-e border-dash-outline-variant bg-dash-surface-container-low print:hidden max-lg:hidden">
        <SidebarContent
          activeId={activeId}
          schoolName={schoolName}
          onDispatch={() => setDispatchOpen(true)}
        />
      </nav>

      {/* Mobile/tablet: end drawer with its own close button and backdrop. */}
      <Dialog
        open={open}
        onClose={onClose}
        title={schoolName ?? t("dashboard.openNavAria")}
        placement="end"
        panelClassName="h-full w-64 max-w-[90vw] rounded-none border-s border-dash-outline-variant bg-dash-surface-container-low print:hidden"
      >
        <SidebarContent
          activeId={activeId}
          schoolName={schoolName}
          onDispatch={() => setDispatchOpen(true)}
          onNavigate={onClose}
          onClose={onClose}
        />
      </Dialog>

      <DispatchModal open={dispatchOpen} onClose={() => setDispatchOpen(false)} />
    </>
  );
}

/**
 * The nav body — brand header, nav list, and Dispatch button — shared by the
 * desktop rail and the mobile drawer. `onClose` renders the drawer's close
 * button; `onNavigate` fires when a route link is clicked (closes the drawer).
 */
function SidebarContent({
  activeId,
  schoolName,
  onDispatch,
  onNavigate,
  onClose,
}: {
  activeId: string;
  schoolName?: string | null;
  onDispatch: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-8 mt-4 flex items-center justify-between px-4">
        <div>
          <h1 className="text-xl font-bold text-dash-primary">Fleet Ops</h1>
          <p className="truncate text-dash-body-sm text-dash-on-surface-variant">
            {schoolName ?? "Terminal A-12"}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dashboard.closeNavAria")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
          >
            <Icon name="close" size={20} variant="outlined" />
          </button>
        )}
      </div>

      <ul className="flex flex-grow flex-col gap-2 px-2">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          const linkClass = `flex h-12 items-center gap-3 rounded-full px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary ${
            active
              ? "font-bold text-dash-on-secondary-container bg-dash-secondary-container"
              : "text-dash-on-surface-variant transition-all hover:bg-dash-surface-container-high"
          }`;
          const content = (
            <>
              <Icon name={item.icon} size={20} variant="outlined" />
              <span className="text-dash-label-md">{t(NAV_LABEL_KEY[item.id])}</span>
            </>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                // react-router <Link> = client-side transition; a plain <a> would
                // hard-reload the shell and re-trigger the RequireRole guard
                // ("Checking access…").
                <Link
                  to={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate?.()}
                  className={linkClass}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  className={linkClass}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mb-4 mt-auto px-4">
        <button
          type="button"
          onClick={onDispatch}
          className="w-full h-12 rounded-full bg-dash-primary text-dash-on-primary text-dash-label-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
        >
          {t("nav.dispatch")}
        </button>
      </div>
    </div>
  );
}

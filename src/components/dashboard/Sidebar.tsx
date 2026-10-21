import { Link } from "react-router-dom";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ProductMark } from "@/components/ProductMark";
import { NAV_ITEMS, type NavItem } from "@/data/dashboard";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { useUserProfile } from "@/lib/user-profile";
import type { MessageKey } from "@/lib/i18n/types";

/** Nav label key per item id (labels are translated, ids are stable). */
const NAV_LABEL_KEY: Record<string, MessageKey> = {
  "live-map": "nav.liveMap",
  reports: "nav.reports",
  assignments: "nav.assignments",
  drivers: "nav.drivers",
};

interface SidebarProps {
  /** id of the nav item currently shown (e.g. "live-map"); rendered as the active page. */
  activeId: string;
  /** The signed-in tenant's school name (shown under the product name). */
  schoolName?: string | null;
  /** Drawer open state — on desktop (≥lg) the sidebar is always visible and this is ignored. */
  open: boolean;
  /** Close the mobile drawer (nav click, close button, backdrop, Escape). */
  onClose: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

/**
 * Director navigation. The desktop rail sits on the page ground with a single
 * 1px edge; the active row is a neutral grey pill, never a saturated brand
 * pill. Below lg it becomes an end drawer (shared Dialog, so focus trap,
 * Escape and scroll-lock come for free).
 */
export function Sidebar({
  activeId,
  schoolName,
  open,
  onClose,
  onOpenHelp,
  onOpenSettings,
}: SidebarProps) {
  const { t } = useLocale();

  return (
    <>
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-[236px] flex-col border-e border-dash-outline-variant bg-dash-background lg:flex print:hidden">
        <SidebarContent
          activeId={activeId}
          schoolName={schoolName}
          onOpenHelp={onOpenHelp}
          onOpenSettings={onOpenSettings}
        />
      </aside>

      <Dialog
        open={open}
        onClose={onClose}
        title={schoolName ?? t("dashboard.openNavAria")}
        placement="end"
        panelClassName="h-full w-[252px] max-w-[88vw] rounded-none border-s border-dash-outline-variant bg-dash-background print:hidden"
      >
        <SidebarContent
          activeId={activeId}
          schoolName={schoolName}
          onNavigate={onClose}
          onClose={onClose}
          onOpenHelp={onOpenHelp}
          onOpenSettings={onOpenSettings}
        />
      </Dialog>
    </>
  );
}

function SidebarContent({
  activeId,
  schoolName,
  onNavigate,
  onClose,
  onOpenHelp,
  onOpenSettings,
}: {
  activeId: string;
  schoolName?: string | null;
  onNavigate?: () => void;
  onClose?: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const name = profile.displayName ?? user?.email ?? "";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const groups: { id: NavItem["group"]; label: MessageKey }[] = [
    { id: "operate", label: "nav.operate" },
    { id: "manage", label: "nav.manage" },
  ];

  return (
    <div className="flex h-full flex-col px-3 pb-3 pt-4">
      <div className="flex items-start justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <ProductMark size={30} className="flex-none" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-5 text-dash-on-surface">
              {t("meta.title")}
            </p>
            <p className="truncate text-[11.5px] leading-4 text-dash-on-surface-variant">
              {schoolName ?? "—"}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dashboard.closeNavAria")}
            className="flex h-9 w-9 flex-none items-center justify-center rounded text-dash-on-surface-variant hover:bg-dash-surface-container"
          >
            <Icon name="close" size={20} variant="outlined" />
          </button>
        )}
      </div>

      <nav className="mt-7 flex flex-1 flex-col gap-6" aria-label={t("nav.operate")}>
        {groups.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="flex flex-col gap-1">
              <p className="px-2 pb-1 text-[11px] font-medium text-dash-on-surface-variant">
                {t(group.label)}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => onNavigate?.()}
                        className={`flex h-9 items-center gap-2.5 rounded-md px-2 text-[13.5px] ${
                          active
                            ? "bg-dash-secondary-container font-medium text-dash-on-surface"
                            : "text-dash-on-surface-variant hover:bg-dash-surface-container-low hover:text-dash-on-surface"
                        }`}
                      >
                        <Icon
                          name={item.icon}
                          size={18}
                          variant="outlined"
                          className={active ? "text-dash-on-surface" : "text-dash-outline"}
                        />
                        <span>{t(NAV_LABEL_KEY[item.id])}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="mt-6 flex flex-col gap-1 border-t border-dash-outline-variant pt-3">
        <button
          type="button"
          onClick={onOpenHelp}
          className="flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] text-dash-on-surface-variant hover:bg-dash-surface-container-low hover:text-dash-on-surface"
        >
          <Icon name="help" size={18} variant="outlined" className="text-dash-outline" />
          {t("help.title")}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] text-dash-on-surface-variant hover:bg-dash-surface-container-low hover:text-dash-on-surface"
        >
          <Icon name="settings" size={18} variant="outlined" className="text-dash-outline" />
          {t("settings.title")}
        </button>
        <div className="mt-1 px-1">
          <LanguageToggle variant="dash" />
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-2 flex min-w-0 items-center gap-2.5 rounded-md p-2 text-start hover:bg-dash-surface-container-low"
          aria-label={t("settings.account")}
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-dash-surface-container text-[11px] font-semibold text-dash-on-surface">
            {initials || "—"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-dash-on-surface">
              {name || "—"}
            </span>
            <span className="block truncate text-[11.5px] text-dash-on-surface-variant">
              {profile.role ? t(profile.role === "director" ? "role.director" : "role.staff") : ""}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

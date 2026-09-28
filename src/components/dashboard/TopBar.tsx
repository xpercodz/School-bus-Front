import { useState } from "react";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveClock } from "./LiveClock";
import { HelpDialog } from "./HelpDialog";
import { SettingsDrawer } from "./SettingsDrawer";
import { useLocale } from "@/lib/i18n/context";

interface TopBarProps {
  /** Present only below lg — the hamburger that opens the mobile nav drawer. */
  onOpenNav?: () => void;
  /** Whether the nav drawer is currently open (drives the hamburger's aria-expanded). */
  navOpen?: boolean;
}

/**
 * Sticky dashboard header — brand, live clock, utility actions, and the
 * Administrator avatar. Notifications stays inert (no feed yet); Help and
 * Settings are wired to their dialogs. On narrow screens the brand text and
 * clock chip hide and a hamburger appears (when `onOpenNav` is provided) so the
 * drawer-based navigation is reachable.
 */
export function TopBar({ onOpenNav, navOpen = false }: TopBarProps) {
  const { t } = useLocale();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-dash-outline-variant bg-dash-surface px-4 sm:px-6 print:hidden">
      <div className="flex items-center gap-3">
        {onOpenNav && (
          <IconButton
            label={t("dashboard.openNavAria")}
            icon="menu"
            onClick={onOpenNav}
            ariaExpanded={navOpen}
            className="lg:hidden"
          />
        )}
        <Icon name="directions_bus" size={24} variant="outlined" className="text-dash-primary" />
        <span className="hidden text-xl font-bold text-dash-primary md:inline">
          TransitFlow Monitor
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden h-12 items-center gap-2 rounded border border-dash-outline-variant bg-dash-surface-container px-3 py-1.5 text-dash-on-surface-variant md:flex">
          <Icon name="schedule" size={16} variant="outlined" />
          <LiveClock />
        </div>

        <LanguageToggle variant="dash" />
        <IconButton
          label={t("dashboard.notificationsAria")}
          icon="notifications"
          className="hidden sm:inline-flex"
        />
        <IconButton label={t("dashboard.helpAria")} icon="help" onClick={() => setHelpOpen(true)} />
        <IconButton
          label={t("dashboard.settingsAria")}
          icon="settings"
          onClick={() => setSettingsOpen(true)}
        />

        <div className="ms-2 flex h-10 w-10 items-center justify-center rounded-full border border-dash-outline-variant bg-dash-surface-container-highest">
          <span className="text-xs font-semibold text-dash-on-surface" aria-hidden="true">
            AD
          </span>
        </div>
      </div>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}

/** Round icon button for header utility actions (optionally wired). */
function IconButton({
  label,
  icon,
  onClick,
  className = "",
  ariaExpanded,
}: {
  label: string;
  icon: string;
  onClick?: () => void;
  /** Extra classes merged onto the button (e.g. responsive visibility). */
  className?: string;
  /** aria-expanded for toggle buttons (e.g. the nav hamburger). */
  ariaExpanded?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      aria-expanded={ariaExpanded}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary ${className}`}
    >
      <Icon name={icon} size={24} variant="outlined" />
    </button>
  );
}

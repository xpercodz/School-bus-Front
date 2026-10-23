import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProductMark } from "@/components/ProductMark";
import { useLocale } from "@/lib/i18n/context";

interface TopBarProps {
  /** Below lg only — the hamburger that opens the nav drawer. */
  onOpenNav: () => void;
  /** Whether the nav drawer is currently open (drives aria-expanded). */
  navOpen: boolean;
  schoolName?: string | null;
}

/**
 * Phone/tablet header for the director area. On desktop the sidebar carries
 * the product and the canvas carries the title, so this bar does not exist
 * there at all — no second wordmark, no row of inert utility icons.
 */
export function TopBar({ onOpenNav, navOpen, schoolName }: TopBarProps) {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-30 border-b border-dash-outline-variant bg-dash-background pt-[env(safe-area-inset-top)] lg:hidden print:hidden">
      <div className="flex min-h-14 items-center justify-between gap-3 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label={t("dashboard.openNavAria")}
            aria-expanded={navOpen}
            className="press flex h-11 w-11 flex-none items-center justify-center rounded-lg text-dash-on-surface hover:bg-dash-surface-container"
          >
            <Icon name="menu" size={22} variant="outlined" />
          </button>
          <ProductMark size={24} className="flex-none" />
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold leading-4 text-dash-on-surface">
              {schoolName ?? t("meta.title")}
            </p>
            <p className="truncate text-[11px] leading-4 text-dash-on-surface-variant">
              {schoolName ? t("meta.title") : t("dashboard.title")}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          <ThemeToggle variant="dash" />
          <LanguageToggle variant="dash" />
        </div>
      </div>
    </header>
  );
}

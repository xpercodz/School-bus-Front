import { useLocale } from "@/lib/i18n/context";
import { Icon } from "@/components/Icon";

interface LanguageToggleProps {
  /** "default" = mobile palette (rounded icons), "dash" = dashboard palette. */
  variant?: "default" | "dash";
}

/**
 * Switches the whole app between English and Arabic. Shows the label of the
 * language you switch *to* (EN in Arabic mode, عربي in English mode). The
 * preference is persisted by LocaleProvider via a cookie.
 */
export function LanguageToggle({ variant = "default" }: LanguageToggleProps) {
  const { locale, setLocale, t } = useLocale();
  const target = locale === "en" ? "ar" : "en";
  const label = target === "ar" ? "عربي" : "EN";

  const classes =
    variant === "dash"
      ? "flex h-12 items-center gap-1.5 rounded-full px-3 text-dash-label-md text-dash-on-surface-variant transition-colors hover:bg-dash-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary"
      : "flex h-12 items-center gap-1.5 rounded-full px-3 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <button
      type="button"
      onClick={() => setLocale(target)}
      aria-label={t("common.changeLanguageAria")}
      className={classes}
    >
      <Icon name="translate" size={20} variant={variant === "dash" ? "outlined" : "rounded"} />
      <span>{label}</span>
    </button>
  );
}

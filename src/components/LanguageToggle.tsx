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
      ? "press flex h-11 w-11 items-center justify-center gap-1.5 rounded-lg text-[12.5px] text-dash-on-surface-variant hover:bg-dash-surface-container-low hover:text-dash-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary min-[380px]:w-auto min-[380px]:justify-start min-[380px]:px-2 lg:h-9"
      : "press flex h-11 w-11 items-center justify-center gap-1.5 rounded-lg text-[13.5px] text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-[380px]:w-auto min-[380px]:justify-start min-[380px]:px-2";

  return (
    <button
      type="button"
      onClick={() => setLocale(target)}
      aria-label={t("common.changeLanguageAria")}
      className={classes}
    >
      <Icon
        name="translate"
        size={variant === "dash" ? 16 : 20}
        variant={variant === "dash" ? "outlined" : "rounded"}
      />
      <span className="hidden min-[380px]:inline">{label}</span>
    </button>
  );
}

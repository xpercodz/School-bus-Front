import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";
import { LOCALE_LABEL, LOCALES } from "@/lib/i18n/config";

interface LanguageToggleProps {
  /** "default" = mobile palette (rounded icons), "dash" = dashboard palette. */
  variant?: "default" | "dash";
}

/**
 * Chooses the app's language. Three now, so it is a value selector — the
 * trigger shows the language being read, the menu lists the rest — rather than
 * the two-way toggle it was when there were only two.
 *
 * The labels come from `LOCALE_LABEL` and are deliberately not translated:
 * someone looking for their own language has to recognise it without first
 * reading the one they are stuck in. LocaleProvider persists the choice in a
 * cookie.
 */
export function LanguageToggle({ variant = "default" }: LanguageToggleProps) {
  const { locale, setLocale, t } = useLocale();

  return (
    <DropdownMenu
      ariaLabel={t("common.changeLanguageAria")}
      icon={
        <Icon
          name="translate"
          size={variant === "dash" ? 16 : 20}
          variant={variant === "dash" ? "outlined" : "rounded"}
        />
      }
      label={LOCALE_LABEL[locale]}
      align="end"
      triggerClassName={
        variant === "dash" ? "text-dash-on-surface-variant" : "text-on-surface-variant"
      }
      items={LOCALES.map((option) => ({
        label: LOCALE_LABEL[option],
        checked: option === locale,
        onSelect: () => setLocale(option),
      }))}
    />
  );
}

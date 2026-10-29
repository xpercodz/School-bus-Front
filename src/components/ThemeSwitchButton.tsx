import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { useLocale } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme-context";

interface ThemeSwitchButtonProps {
  /** Glyph only — the shape used in every header. */
  iconOnly?: boolean;
}

/**
 * The app's theme flip, wearing the Arc registry switch.
 *
 * `resolved` drives the glyph (the switch has no `system` state) and the label
 * is translated. The switch hands back the element that was pressed and the
 * variant it renders, so `setMode` can wipe the new theme out of that exact
 * control — the flip itself lives in `beginThemeFlip` plus the keyframes in
 * globals.css, ported from `report-fe` so both products animate the same way.
 *
 * One rule for where this may be mounted: it pulls the `motion` runtime into
 * whichever chunk imports it. The roster's entry chunk already pays for it (see
 * AGENTS.md), so the login, director and driver shells can all mount it.
 */
export function ThemeSwitchButton({ iconOnly = false }: ThemeSwitchButtonProps) {
  const { resolved, setMode } = useTheme();
  const { t } = useLocale();

  return (
    <ThemeSwitch
      theme={resolved}
      iconOnly={iconOnly}
      variant="reveal"
      onThemeChange={(next, variant, trigger) => setMode(next, { trigger, flip: variant })}
      label={t(resolved === "dark" ? "theme.toggleToLight" : "theme.toggleToDark")}
    />
  );
}

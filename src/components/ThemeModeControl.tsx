import { SlideSegments } from "@/components/SlideSegments";
import { useLocale } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme-context";
import type { ThemeMode } from "@/lib/theme";

const MODES: readonly ThemeMode[] = ["system", "light", "dark"];

/**
 * Full three-way appearance control for Settings. The top-bar toggle is the
 * quick path; this is where a user can go back to following the OS.
 */
export function ThemeModeControl() {
  const { t } = useLocale();
  const { mode, setMode } = useTheme();

  return (
    <SlideSegments
      variant="dash-box"
      ariaLabel={t("theme.aria")}
      options={MODES.map((id) => ({
        id,
        label: t(id === "system" ? "theme.system" : id === "light" ? "theme.light" : "theme.dark"),
      }))}
      value={mode}
      onChange={setMode}
    />
  );
}

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme-context";

interface ThemeToggleProps {
  /** "default" = mobile palette (rounded icons), "dash" = director palette. */
  variant?: "default" | "dash";
  className?: string;
}

/**
 * One-tap light/dark flip. Choosing a side pins that preference (the Settings
 * drawer exposes the full System / Light / Dark control). The glyph re-mounts
 * on every flip so the sun/moon arrives with a short rotate — under reduced
 * motion the CSS drops the rotate and only the colour changes.
 */
export function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
  const { resolved, toggle } = useTheme();
  // Only a flip animates. The glyph re-mounts on every resolved change, so an
  // unconditional theme-spin made the header twirl on every cold load.
  const [flipped, setFlipped] = useState(false);
  const { t } = useLocale();
  const isDark = resolved === "dark";
  const label = t(isDark ? "theme.toggleToLight" : "theme.toggleToDark");

  const classes =
    variant === "dash"
      ? "press flex h-11 w-11 items-center justify-center rounded-lg text-dash-on-surface-variant hover:bg-dash-surface-container-low hover:text-dash-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary lg:h-9 lg:w-9"
      : "press flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <button
      type="button"
      onClick={() => {
        setFlipped(true);
        toggle();
      }}
      aria-label={label}
      title={label}
      data-theme-toggle={resolved}
      className={`${classes} ${className ?? ""}`}
    >
      <span
        key={resolved}
        className={`${flipped ? "theme-spin " : ""}flex items-center justify-center`}
      >
        <Icon
          name={isDark ? "light_mode" : "dark_mode"}
          size={variant === "dash" ? 18 : 22}
          variant={variant === "dash" ? "outlined" : "rounded"}
        />
      </span>
    </button>
  );
}

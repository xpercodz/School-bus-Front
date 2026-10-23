/**
 * Theme preference: `system`, `light` or `dark`.
 *
 * The resolved theme is a class on <html> (`.dark`) plus `color-scheme`, so
 * both the CSS token overrides in globals.css and native controls follow it.
 * The inline boot script in index.html performs the same resolution before the
 * first paint — keep the storage key and theme-color values in sync there.
 */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/** localStorage key read by the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = "sb:theme";

/** The light/dark theme-color values used by the inline boot script too. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f3f4f1",
  dark: "#101413",
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

/** Stored preference, or "system" when nothing valid is stored. */
export function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    // Private mode / disabled storage: fall back to the OS preference.
    return "system";
  }
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode, system: ResolvedTheme = getSystemTheme()): ResolvedTheme {
  return mode === "system" ? system : mode;
}

export function persistTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // The UI still follows the chosen theme for this session.
  }
}

/**
 * Apply the resolved theme to the document. Idempotent — safe to call from the
 * provider's layout effect, the toggle, and a View Transition callback.
 */
export function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute("content", THEME_COLORS[resolved]);

  // iOS standalone draws the status bar in white text only with
  // `black-translucent`; in light mode `default` gives black text on paper.
  // The header owns the top safe area in both cases.
  document
    .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute("content", resolved === "dark" ? "black-translucent" : "default");
}

/** True when the user asked the OS for less motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** View Transitions API surface (not in every TS lib yet). */
export interface ViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
}

export type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

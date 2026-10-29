import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  applyThemeToDocument,
  beginThemeFlip,
  getSystemTheme,
  persistTheme,
  prefersReducedMotion,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemeFlip,
  type ThemeMode,
  type ViewTransitionDocument,
} from "@/lib/theme";

/** Where a theme change came from: the pressed control, and which wipe it asked for. */
export interface ThemeOrigin {
  trigger?: Element | null;
  flip?: ThemeFlip;
}

interface ThemeContextValue {
  /** What the user chose: "system", "light" or "dark". */
  mode: ThemeMode;
  /** What is actually on screen after resolving "system". */
  resolved: ResolvedTheme;
  /** Persist and apply a preference, optionally wiping from the control that was pressed. */
  setMode: (mode: ThemeMode, origin?: ThemeOrigin) => void;
  /** Flip to the opposite of the current resolved theme (pins the choice). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme provider. The boot script has already put the correct class on <html>;
 * this provider keeps it in sync after hydration, follows OS changes while the
 * preference is "system", and uses the View Transitions API for a soft
 * crossfade when the user toggles (skipped under reduced motion).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredTheme);
  const [system, setSystem] = useState<ResolvedTheme>(getSystemTheme);

  const resolved = resolveTheme(mode, system);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Keep the DOM in sync (also covers a system-theme change while in "system").
  useLayoutEffect(() => {
    applyThemeToDocument(resolved);
  }, [resolved]);

  /**
   * Persist and apply a preference. Pass the control that was pressed so the
   * View Transition wipe opens from it (`report-fe`'s flip); without an origin
   * the circle opens from the middle of the screen.
   */
  const setMode = useCallback((next: ThemeMode, origin?: ThemeOrigin) => {
    const commit = () => {
      persistTheme(next);
      setModeState(next);
      // Apply synchronously so a View Transition captures the new palette.
      applyThemeToDocument(resolveTheme(next, getSystemTheme()));
    };

    const doc = document as ViewTransitionDocument;
    if (prefersReducedMotion() || typeof doc.startViewTransition !== "function") {
      commit();
      return;
    }

    const settle = beginThemeFlip(origin?.flip, origin?.trigger);
    try {
      const transition = doc.startViewTransition(() => {
        // React state changes must flush before the browser snapshots the new
        // state; the class change above is already synchronous.
        flushSync(commit);
      });
      // `finished` rejects when a transition is skipped, so clear the flip on both paths.
      void Promise.resolve(transition.finished).then(settle, settle);
    } catch {
      // A transition already in flight, a hidden document, or an engine quirk:
      // the theme change still has to happen.
      settle();
      commit();
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

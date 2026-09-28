import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCALE_COOKIE, LOCALE_DIR, type Locale } from "./config";
import { getDictionary } from ".";
import type { MessageKey, TVars } from "./types";

interface LocaleContextValue {
  locale: Locale;
  /** Switch language; persists in a cookie (read by the server on next load). */
  setLocale: (locale: Locale) => void;
  /** Text direction for the current locale ("ltr" | "rtl"). */
  dir: "ltr" | "rtl";
  /** Translate a key; unknown keys fall back to English. */
  t: (key: MessageKey, vars?: TVars) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Client locale provider. Seeded from `readLocaleCookie()` (called once in
 * App.tsx before the first render) so the initial paint is already in the right
 * language and direction. On every change it updates <html lang/dir> and writes
 * the cookie.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const dir = LOCALE_DIR[locale];
  const dictionary = getDictionary(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax; secure`;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

  const t = useCallback(
    (key: MessageKey, vars?: TVars): string => {
      const template = dictionary[key] ?? getDictionary("en")[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
        vars[name] != null ? String(vars[name]) : match,
      );
    },
    [dictionary],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, dir, t }),
    [locale, setLocale, dir, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

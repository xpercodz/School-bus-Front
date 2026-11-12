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
import type { MessageKey, PluralKey, TVars } from "./types";

/** Fill `{name}` placeholders; unknown names are left literal so the gap shows. */
function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
    vars[name] != null ? String(vars[name]) : match,
  );
}

interface LocaleContextValue {
  locale: Locale;
  /** Switch language; persists in a cookie (read by the server on next load). */
  setLocale: (locale: Locale) => void;
  /** Text direction for the current locale ("ltr" | "rtl"). */
  dir: "ltr" | "rtl";
  /** Translate a key; unknown keys fall back to English. */
  t: (key: MessageKey, vars?: TVars) => string;
  /** Translate a key whose singular form differs, chosen from the count. */
  tp: (key: PluralKey, count: number, vars?: TVars) => string;
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

  // One lookup for `t` and `tp`: the locale's text, then English, then the key.
  const resolve = useCallback(
    (key: string): string | undefined => {
      const dict = dictionary as Record<string, string | undefined>;
      const fallback = getDictionary("en") as Record<string, string | undefined>;
      return dict[key] ?? fallback[key];
    },
    [dictionary],
  );

  const t = useCallback(
    (key: MessageKey, vars?: TVars): string => interpolate(resolve(key) ?? key, vars),
    [resolve],
  );

  // CLDR plural rules, cached per locale. `tp` exists because a flat template
  // cannot say "1 student": the count picks the form, so a school with one
  // unrecorded child never reads "1 students".
  const pluralRules = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const tp = useCallback(
    (key: PluralKey, count: number, vars?: TVars): string => {
      const category = pluralRules.select(count);
      const template =
        resolve(`${key}.${category}`) ?? resolve(`${key}.other`) ?? resolve(key) ?? key;
      return interpolate(template, vars);
    },
    [pluralRules, resolve],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, dir, t, tp }),
    [locale, setLocale, dir, t, tp],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

/**
 * Locale configuration — the single place that lists supported languages.
 * Only `en` and `ar` exist today; add a locale to the `Locale` union, a
 * dictionary file, and a LOCALE_DIR entry to grow the set.
 */

export type Locale = "en" | "ar";

/** English is the default; drivers switch to Arabic with the UI toggle. */
export const defaultLocale: Locale = "en";

/** Text direction per locale — drives the `dir` attribute on <html>. */
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

/** Cookie the locale preference is persisted in. */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

/**
 * Read the persisted locale straight from `document.cookie`.
 *
 * This app is a pure SPA, so there is no server pass to seed the provider the
 * way the old Next.js root layout did. Reading the cookie synchronously during
 * module init is what keeps an Arabic user from seeing a flash of LTR English
 * before the first effect runs.
 */
export function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return defaultLocale;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  return isLocale(value) ? value : defaultLocale;
}

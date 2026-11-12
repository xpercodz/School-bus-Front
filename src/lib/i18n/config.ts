/**
 * Locale configuration — the single place that lists supported languages.
 *
 * Growing the set means four edits and nothing else: the `Locale` union here,
 * a dictionary file beside `en.ts`/`ar.ts`, an entry in `getDictionary`, and a
 * `LOCALE_DIR` entry (plus `localeCode` in `format.ts` if the locale needs a
 * region tag). `fr.ts` is typed as `Messages`, so a key missing from a
 * language fails `tsc --noEmit` — and `npm run build` runs that first.
 */

export type Locale = "en" | "ar" | "fr";

/** Display order in the language menu. */
export const LOCALES: readonly Locale[] = ["en", "fr", "ar"];

/**
 * Each language's name in ITSELF. Deliberately not translated: a reader looking
 * for their own language must recognise it without already speaking the current
 * one, so "Français" stays "Français" on an Arabic screen.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

/** English is the default; drivers switch to Arabic with the UI toggle. */
export const defaultLocale: Locale = "en";

/** Text direction per locale — drives the `dir` attribute on <html>. */
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  fr: "ltr",
};

/** Cookie the locale preference is persisted in. */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar" || value === "fr";
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

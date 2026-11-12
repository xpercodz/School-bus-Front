/**
 * Locale-aware formatting. Safe on both server and client — no browser-only
 * APIs, no React.
 *
 * Arabic (ar) intentionally formats via `ar-EG`, which produces Eastern Arabic
 * digits (٠١٢٣) and Arabic AM/PM words (ص/م) — the user's chosen numeral style.
 * French formats via `fr-FR` (Latin digits, a comma decimal separator, a narrow
 * no-break space before the percent sign — all from `Intl`, none hand-rolled).
 */

import type { Locale } from "./config";
import type { MessageKey, TFunction } from "./types";

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * Replace 0-9 with Eastern Arabic digits when the locale is Arabic; a no-op for
 * every other locale. Note the negative test: a new locale must NOT inherit
 * Arabic digits, which is what a `locale === "en"` check would have done.
 */
export function toLocaleDigits(input: string, locale: Locale): string {
  if (locale !== "ar") return input;
  return input.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

/**
 * The Intl tag for a locale. Exported so no screen re-derives it inline — the
 * app used to carry `locale === "ar" ? "ar-EG" : "en-US"` in four places, each
 * of which silently sent French users to English formatting.
 */
export function localeCode(locale: Locale): string {
  if (locale === "ar") return "ar-EG";
  if (locale === "fr") return "fr-FR";
  return "en-US";
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Memoized `Intl.DateTimeFormat` — one instance per (locale, options) pair. */
function cachedFormatter(
  code: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${code}|${JSON.stringify(options)}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(code, options);
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/** Format a Date as a localized 12-hour clock; "--:--:--" when null. */
export function formatTime(ts: Date | null, locale: Locale): string {
  if (!ts) return "--:--:--";
  return cachedFormatter(localeCode(locale), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(ts);
}

/**
 * Format a "YYYY-MM-DD" string (the app's date key) as a localized date; ""
 * when null. Built from parts so the Date is timezone-safe (never shifts a
 * day); out-of-range parts are rejected rather than silently rolled over.
 */
export function formatDate(dateStr: string | null, locale: Locale): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return dateStr;
  }
  return cachedFormatter(localeCode(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Day + month without the year, for the compact driver app bar where the full
 * date ("Oct 22, 2026") crowds the run status out of the line.
 */
export function formatDayMonth(dateStr: string | null, locale: Locale): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return dateStr;
  }
  return cachedFormatter(localeCode(locale), {
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Rewrite a translatable prefix embedded in stored data — "Bus 04" → "حافلة ٠٤"
 * and "Grade 4B" → "الصف ٤B". Pass-through for anything else (proper nouns).
 */
export function translateDataLabel(
  input: string,
  locale: Locale,
  t: TFunction,
): string {
  const bus = input.match(/^Bus\s+(\S+)/);
  if (bus) return `${t("bus.bus")} ${toLocaleDigits(bus[1], locale)}`;
  const grade = input.match(/^Grade\s+(\S+)/);
  if (grade) return `${t("bus.grade")} ${toLocaleDigits(grade[1], locale)}`;
  return toLocaleDigits(input, locale);
}

/**
 * A whole-number percentage with the locale's own digits and sign — "96%" in
 * English, "٩٦٪" in Arabic. Use it wherever a bare number is followed by `%`;
 * a template like "{percent}%" cannot carry the Arabic sign, and a hardcoded
 * "%" beside Eastern Arabic digits reads as a different language.
 */
export function formatPercent(value: number, locale: Locale): string {
  // French puts a narrow no-break space before the sign, which is exactly what
  // `Intl.NumberFormat("fr-FR", { style: "percent" })` produces.
  const sign = locale === "ar" ? "٪" : locale === "fr" ? "\u202f%" : "%";
  return `${toLocaleDigits(String(Math.round(value)), locale)}${sign}`;
}

/** `t` key for a status — handy for mapping StudentStatus → MessageKey. */
export function statusKey(status: string): MessageKey {
  switch (status) {
    case "BOARDED":
      return "status.boarded";
    case "WAITING":
      return "status.waiting";
    case "DROPPED_OFF":
      return "status.droppedOff";
    case "ABSENT":
      return "status.absent";
    default:
      return "status.waiting";
  }
}

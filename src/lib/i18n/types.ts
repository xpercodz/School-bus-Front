import type { Messages as EnMessages } from "./dictionaries/en";

/** The full key set, derived from the English dictionary. */
export type Messages = EnMessages;

/** A single translation key — typed so `t('typo.key')` fails to compile. */
export type MessageKey = keyof Messages;

/** Interpolation variables for `t(key, vars)` — `{name}` in the template. */
export type TVars = Record<string, string | number>;

/**
 * Keys whose singular form differs from their plural. The dictionary keeps the
 * plural on the base key and adds `<key>.one`; `tp(key, count, vars)` picks the
 * CLDR category with `Intl.PluralRules` and falls back to `.other`, then to the
 * base key. Listing the base here is what makes `tp` type-safe — a key with no
 * plural forms cannot be passed to it.
 *
 * Only the singular is listed, because that is the form a flat template cannot
 * express: "1 students still unrecorded" is the failure this prevents.
 */
export type PluralKey =
  | "dashboard.finding.allClear"
  | "dashboard.finding.open"
  | "dashboard.finding.completedWithWaiting"
  | "kpi.total.footer"
  | "students.meta"
  | "busDetail.hint"
  | "activity.finding.changes"
  | "activity.finding.failed"
  | "activity.event.runCompleted"
  | "activity.event.runDispatched"
  | "activity.event.imported"
  | "activity.preset.days";

/** The translation function signature shared by the context and helpers. */
export type TFunction = (key: MessageKey, vars?: TVars) => string;

/** Plural-aware translation: `tp(key, count, vars)`. */
export type TPFunction = (key: PluralKey, count: number, vars?: TVars) => string;

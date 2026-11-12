import { messages as en } from "./dictionaries/en";
import { messages as ar } from "./dictionaries/ar";
import { messages as fr } from "./dictionaries/fr";
import type { Locale } from "./config";
import type { Messages } from "./types";

export type { Messages };

const DICTIONARIES: Record<Locale, Messages> = { en, ar, fr };

/** Look up a locale's message map. Unknown locales fall back to English. */
export function getDictionary(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? en;
}

export type { Locale };

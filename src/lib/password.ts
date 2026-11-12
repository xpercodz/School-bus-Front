/**
 * The bar for an operator password, and a generator that clears it.
 *
 * Length first: twelve characters with the four character classes is the
 * practical reading of current guidance — long enough that guessing is hopeless,
 * and still typable when a director hands it over on paper. The checklist in the
 * UI and the API's zod schema both read this same number, so a password that
 * turns every check green is one the server will accept.
 *
 * Generation is client-side on purpose: the account is created server-side, but
 * the password is chosen by the director and must be VISIBLE to them once. It is
 * never sent anywhere except that one create/reset call.
 */

/** Characters required. Mirrored by `createOperatorSchema` in the API contract. */
export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRuleId = "length" | "upper" | "lower" | "digit" | "symbol";

export interface PasswordRule {
  id: PasswordRuleId;
  /** True when the value satisfies this rule. */
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: "length", test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", test: (value) => /[A-Z]/.test(value) },
  { id: "lower", test: (value) => /[a-z]/.test(value) },
  { id: "digit", test: (value) => /[0-9]/.test(value) },
  // Anything that is not a letter or a digit counts — including Arabic script
  // punctuation, and including spaces, which are legitimate in a passphrase.
  { id: "symbol", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

/** The rules `value` does not satisfy yet, in checklist order. */
export function unmetPasswordRules(value: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value));
}

/** Every rule met — the only state that may be submitted. */
export function isPasswordStrong(value: string): boolean {
  return unmetPasswordRules(value).length === 0;
}

/*
 * Ambiguous glyphs are left out of every class: a password is read off a screen
 * by one person and typed by another, and `l` vs `1` vs `I` is exactly where
 * that handover fails.
 */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomIndex(bound: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % bound;
}

function pick(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)];
}

/**
 * A random password that satisfies every rule (one character is taken from each
 * class, then the rest from the union, then shuffled so the guaranteed ones are
 * not always in the same positions).
 */
export function generatePassword(length: number = 16): string {
  const size = Math.max(PASSWORD_MIN_LENGTH, length);
  const chars = [
    pick(UPPER),
    pick(LOWER),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  while (chars.length < size) chars.push(pick(ALL));

  // Fisher–Yates, so the required characters move out of the first four slots.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

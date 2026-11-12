/**
 * Who may open what — the one place the answers live.
 *
 * Two levels exist above the drivers:
 *
 *   - a **director** opens every screen, including the activity log. Exactly one
 *     director carries `owner: true` (the main director) and, with that flag,
 *     also opens the Operators page and may create or re-scope operators. The flag is never a
 *     role: a director already holds everything else, so `owner` only says
 *     "this is the account that hands access to other people".
 *   - an **operator** opens only the screens listed on their profile.
 *
 * ⚠️ THIS FILE DECIDES WHAT IS DRAWN, NOT WHAT IS ALLOWED. Hiding a nav row and
 * redirecting a route are courtesies, so nobody stares at a page they cannot
 * use. The real gate is `firebase/firestore.rules` (which reads the same screen
 * names off the caller's profile) and the API's `requireManager`/`requireOwner`.
 * A change here that rules don't mirror is a broken permission.
 */
import type { OperatorScreen } from "@/lib/api-contract";
import { NAV_ITEMS, type NavItem, type NavScreen } from "@/data/dashboard";
import type { MessageKey } from "@/lib/i18n/types";
import type { UserProfile } from "@/lib/user-profile";

/** Every screen the app gates: the five grantable ones plus the owner's page. */
export type ScreenId = NavScreen;

/**
 * The screens an operator can be granted, in the order the editor lists them —
 * the same order and the same names the API validates.
 */
export const GRANTABLE_SCREENS: readonly OperatorScreen[] = [
  "live",
  "students",
  "reports",
  "assignments",
  "drivers",
];

/**
 * What a new operator starts with: the day's read-mostly work. Drivers and
 * Assignments are left off deliberately — they can create accounts and move
 * children, so granting them is a decision the owner makes, not a default.
 */
export const DEFAULT_OPERATOR_SCREENS: readonly OperatorScreen[] = [
  "live",
  "students",
  "reports",
];

/** A screen's user-facing name (also used by the operator editor's ticks). */
export const SCREEN_LABEL_KEY: Record<OperatorScreen, MessageKey> = {
  live: "operators.screen.live",
  students: "operators.screen.students",
  reports: "operators.screen.reports",
  assignments: "operators.screen.assignments",
  drivers: "operators.screen.drivers",
};

/**
 * The main director's DEFAULT answer: the explicit `owner` flag. Callers inside
 * the shell should pass the RESOLVED value from `useMainDirector()` instead —
 * a school with one director is treated as having a main director even before
 * anything is flagged.
 */
export function isOwner(profile: UserProfile): boolean {
  return profile.role === "director" && profile.owner;
}

/** Anyone who belongs in the dashboard at all (a driver does not). */
export function isManagement(profile: UserProfile): boolean {
  return profile.role === "director" || profile.role === "operator";
}

/**
 * May this profile open `screen`? A driver and a signed-out user may open none.
 *
 * `mainDirector` is the resolved answer (see `useMainDirector`); it defaults to
 * the raw `owner` flag so pure callers stay correct, but the shell passes the
 * resolved value, which also covers a school that has never run the flag script.
 */
export function canOpenScreen(
  profile: UserProfile,
  screen: ScreenId,
  mainDirector: boolean = profile.owner,
): boolean {
  if (profile.role === "director") {
    // Everything, except the operators page for a director who is not the main one.
    return screen === "operators" ? mainDirector : true;
  }
  if (profile.role === "operator") {
    // Two pages are never grantable: Operators (access is handed out there) and
    // Activity (a log the audited can read is a different product). Nothing in
    // `screens` can name them, so the check is explicit rather than incidental.
    if (screen === "operators" || screen === "activity") return false;
    return profile.screens.includes(screen);
  }
  return false;
}

/** The destinations this profile may see, in nav order. */
export function visibleNavItems(
  profile: UserProfile,
  mainDirector: boolean = profile.owner,
): NavItem[] {
  return NAV_ITEMS.filter((item) => canOpenScreen(profile, item.screen, mainDirector));
}

/**
 * Where a denied route should send the reader: the first destination they can
 * actually use. `/` (the driver roster) when they can use none — which the
 * guards treat as "no dashboard", never as an empty shell.
 */
export function firstAllowedHref(
  profile: UserProfile,
  mainDirector: boolean = profile.owner,
): string {
  return visibleNavItems(profile, mainDirector)[0]?.href ?? "/";
}

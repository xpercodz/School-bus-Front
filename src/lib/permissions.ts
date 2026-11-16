/**
 * Who may open what, and what they may do there — the one place the answers live.
 *
 * Two levels exist above the drivers:
 *
 *   - a **director** opens every screen, including the activity log. Exactly one
 *     director carries `owner: true` (the main director) and, with that flag,
 *     also opens the Operators page and may create or re-scope operators. The flag is never a
 *     role: a director already holds everything else, so `owner` only says
 *     "this is the account that hands access to other people".
 *   - an **operator** holds a set of **capabilities**: one `section.action` per
 *     thing they may do. `section.view` is what opens a screen; the rest gate a
 *     control *inside* it (editing a child, moving a bus, exporting a report).
 *
 * A profile that predates capabilities has no `permissions` field and keeps
 * working: its `screens` are read as "every capability of that section". That
 * fallback is the expand/contract of the rollout, and it is the ONE place the
 * two vocabularies meet.
 *
 * ⚠️ THIS FILE DECIDES WHAT IS DRAWN, NOT WHAT IS ALLOWED. Hiding a nav row and
 * redirecting a route are courtesies, so nobody stares at a page they cannot
 * use. The real gate is `firebase/firestore.rules` (which reads the same
 * `permissions` list off the caller's profile, with the same fallback) and the
 * API's `requireManager`/`requireOwner`. A change here that rules don't mirror
 * is a broken permission.
 */
import { useCallback, useMemo } from "react";
import type { OperatorScreen } from "@/lib/api-contract";
import { NAV_ITEMS, type NavItem, type NavScreen } from "@/data/dashboard";
import type { MessageKey } from "@/lib/i18n/types";
import { useUserProfile, type UserProfile } from "@/lib/user-profile";

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

/* ── capabilities ───────────────────────────────────────────────────────────
 *
 * One `section.action` per thing an operator may do. `section.view` opens the
 * screen; every other key gates one control inside it. The list is FROZEN by
 * `firestore.rules` (which names the same keys) and by the API's validation —
 * so a key here and not there is a permission that does nothing, and a key
 * there and not here is a button an operator cannot see while still holding
 * the power. Add to both or neither.
 *
 * It is flat on purpose: a set of keys is what the rules and the profile store,
 * the sections below are only how the editor draws them (the report-fe lesson —
 * the grouping is presentation, so a key filed under the wrong heading is a
 * cosmetic bug, not a permission one).
 */
export type Capability =
  | "live.view"
  | "students.view"
  | "students.edit"
  | "students.import"
  | "students.restore"
  | "students.export"
  | "students.history"
  | "reports.view"
  | "reports.classDetail"
  | "reports.analytics"
  | "reports.print"
  | "reports.export"
  | "assignments.view"
  | "assignments.move"
  | "assignments.driver"
  | "assignments.mode"
  | "drivers.view"
  | "drivers.create"
  | "drivers.rotate";

/** The capabilities of each screen, in the order the editor lists them. */
export const CAPABILITY_GROUPS: readonly {
  screen: OperatorScreen;
  keys: readonly Capability[];
}[] = [
  { screen: "live", keys: ["live.view"] },
  {
    screen: "students",
    keys: [
      "students.view",
      "students.edit",
      "students.import",
      "students.restore",
      "students.export",
      "students.history",
    ],
  },
  {
    screen: "reports",
    keys: [
      "reports.view",
      "reports.classDetail",
      "reports.analytics",
      "reports.print",
      "reports.export",
    ],
  },
  {
    screen: "assignments",
    keys: [
      "assignments.view",
      "assignments.move",
      "assignments.driver",
      "assignments.mode",
    ],
  },
  { screen: "drivers", keys: ["drivers.view", "drivers.create", "drivers.rotate"] },
];

/** Every capability, in editor order — the set a director holds. */
export const ALL_CAPABILITIES: readonly Capability[] = CAPABILITY_GROUPS.flatMap(
  (group) => group.keys,
);

/** The keys of one section (what a legacy screen grant is read as). */
export function capabilitiesOfScreen(screen: OperatorScreen): readonly Capability[] {
  return CAPABILITY_GROUPS.find((group) => group.screen === screen)?.keys ?? [];
}

/** What a new operator starts with: everything the three default screens hold. */
export const DEFAULT_OPERATOR_PERMISSIONS: readonly Capability[] =
  DEFAULT_OPERATOR_SCREENS.flatMap((screen) => capabilitiesOfScreen(screen));

/** One capability's row label in the operator editor. */
export const CAPABILITY_LABEL_KEY: Record<Capability, MessageKey> = {
  "live.view": "operators.cap.live.view",
  "students.view": "operators.cap.students.view",
  "students.edit": "operators.cap.students.edit",
  "students.import": "operators.cap.students.import",
  "students.restore": "operators.cap.students.restore",
  "students.export": "operators.cap.students.export",
  "students.history": "operators.cap.students.history",
  "reports.view": "operators.cap.reports.view",
  "reports.classDetail": "operators.cap.reports.classDetail",
  "reports.analytics": "operators.cap.reports.analytics",
  "reports.print": "operators.cap.reports.print",
  "reports.export": "operators.cap.reports.export",
  "assignments.view": "operators.cap.assignments.view",
  "assignments.move": "operators.cap.assignments.move",
  "assignments.driver": "operators.cap.assignments.driver",
  "assignments.mode": "operators.cap.assignments.mode",
  "drivers.view": "operators.cap.drivers.view",
  "drivers.create": "operators.cap.drivers.create",
  "drivers.rotate": "operators.cap.drivers.rotate",
};

/**
 * The sentence under a capability's label, saying what the tick actually buys.
 * A row of bare labels leaves the reader guessing between "edit a child" and
 * "edit the roster", and a wrong guess here hands out more than intended.
 */
export const CAPABILITY_GLOSS_KEY: Record<Capability, MessageKey> = {
  "live.view": "operators.cap.live.viewHint",
  "students.view": "operators.cap.students.viewHint",
  "students.edit": "operators.cap.students.editHint",
  "students.import": "operators.cap.students.importHint",
  "students.restore": "operators.cap.students.restoreHint",
  "students.export": "operators.cap.students.exportHint",
  "students.history": "operators.cap.students.historyHint",
  "reports.view": "operators.cap.reports.viewHint",
  "reports.classDetail": "operators.cap.reports.classDetailHint",
  "reports.analytics": "operators.cap.reports.analyticsHint",
  "reports.print": "operators.cap.reports.printHint",
  "reports.export": "operators.cap.reports.exportHint",
  "assignments.view": "operators.cap.assignments.viewHint",
  "assignments.move": "operators.cap.assignments.moveHint",
  "assignments.driver": "operators.cap.assignments.driverHint",
  "assignments.mode": "operators.cap.assignments.modeHint",
  "drivers.view": "operators.cap.drivers.viewHint",
  "drivers.create": "operators.cap.drivers.createHint",
  "drivers.rotate": "operators.cap.drivers.rotateHint",
};

const NO_CAPABILITIES: ReadonlySet<Capability> = new Set();

/**
 * What this profile may do. A director holds everything; an operator holds the
 * keys on their profile, or — for a profile written before capabilities existed
 * — every key of the screens they were granted.
 *
 * Unknown keys are dropped rather than trusted: a newer API may store a
 * capability this build has never heard of, and `ALL_CAPABILITIES.filter` is
 * what keeps it from becoming a permission by accident.
 */
export function grantedCapabilities(
  screens: readonly OperatorScreen[],
  permissions: readonly string[] | null,
): ReadonlySet<Capability> {
  const granted = permissions ?? screens.flatMap((screen) => capabilitiesOfScreen(screen));
  return new Set(ALL_CAPABILITIES.filter((capability) => granted.includes(capability)));
}

export function capabilitiesFor(profile: UserProfile): ReadonlySet<Capability> {
  if (profile.role === "director") return new Set(ALL_CAPABILITIES);
  if (profile.role !== "operator") return NO_CAPABILITIES;
  return grantedCapabilities(profile.screens, profile.permissions);
}

/** May this profile do `capability`? */
export function can(profile: UserProfile, capability: Capability): boolean {
  return capabilitiesFor(profile).has(capability);
}

/**
 * The signed-in reader's own check, for a control site:
 * `{can("students.edit") && <EditButton/>}`.
 *
 * The rendered answer and the rules answer come from the same list, so hiding a
 * control never becomes the reason it is safe — `firestore.rules` refuses the
 * write whether or not this button was drawn.
 */
export function useCan(): (capability: Capability) => boolean {
  const { profile } = useUserProfile();
  const held = useMemo(() => capabilitiesFor(profile), [profile]);
  return useCallback((capability: Capability) => held.has(capability), [held]);
}

/** The capability that opens a screen. */
export function viewCapability(screen: OperatorScreen): Capability {
  return `${screen}.view` as Capability;
}

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
    // `permissions` can name them, so the check is explicit rather than
    // incidental.
    if (screen === "operators" || screen === "activity") return false;
    return capabilitiesFor(profile).has(viewCapability(screen));
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

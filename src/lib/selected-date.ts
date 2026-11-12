import { useEffect, useState } from "react";

/** The two screens that can be scoped to one day. */
export type DayScope = "live" | "reports";

const KEY = (scope: DayScope) => `schoolbus:date:${scope}`;
const SCOPES: readonly DayScope[] = ["live", "reports"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function read(scope: DayScope): string | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(KEY(scope));
    return raw !== null && ISO_DAY.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * A screen's own picked date, remembered for this tab.
 *
 * Per screen on purpose: the three day-scoped pages answer different questions
 * (the live monitor's day, a report's date), so a date picked on one must never
 * move another — that was the bug in sharing one value between them. It survives
 * leaving the page and coming back, which is what plain `useState` could not do;
 * it does not survive a new browser tab or a sign-out.
 */
export function useSelectedDate(scope: DayScope) {
  // Read once on mount: returning to the screen restores the day it was left on.
  const [date, setDate] = useState<string | null>(() => read(scope));

  useEffect(() => {
    try {
      if (date === null) window.sessionStorage.removeItem(KEY(scope));
      else window.sessionStorage.setItem(KEY(scope), date);
    } catch {
      // Private mode: the date simply doesn't outlive the page.
    }
  }, [scope, date]);

  return [date, setDate] as const;
}

/** Sign-out: every screen back to its default, so nobody inherits someone's day. */
export function clearSelectedDates(): void {
  try {
    for (const scope of SCOPES) window.sessionStorage.removeItem(KEY(scope));
  } catch {
    // Ignore: nothing is stored if storage is unavailable.
  }
}

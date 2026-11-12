/**
 * "This account has already been ASKED whether it wants the tour."
 *
 * ⚠️ ASKED, NOT TOURED. The first visit to the Live monitor gets a small
 * invitation; either answer — "Show me around" or "Not now" — sets this flag, as
 * does opening the tour from the guidebook. Nothing reopens on its own after
 * that, and the replay path never consults it.
 *
 * One `localStorage` key per UID, because a shared office laptop is the normal
 * case here: the first person to answer "Not now" must not answer for everyone
 * who signs in after them. Per-browser on purpose — a second device asks once
 * there too, which is the harmless direction to fail in and costs no Firestore
 * read.
 *
 * ⚠️ THE VERSION IS IN THE KEY. The steps are derived from permissions and will
 * grow when a screen does; bump `VERSION` when the tour is materially rewritten
 * and everybody sees the new one.
 */
const PREFIX = "school-bus.tourSeen.";
const VERSION = "1";

function keyFor(uid: string): string {
  return `${PREFIX}${VERSION}.${uid}`;
}

export function tourSeen(uid: string): boolean {
  if (uid === "") return false;
  try {
    return window.localStorage.getItem(keyFor(uid)) === "1";
  } catch {
    // Private mode. Erring toward asking is the harmless way to fail.
    return false;
  }
}

export function markTourSeen(uid: string): void {
  if (uid === "") return;
  try {
    window.localStorage.setItem(keyFor(uid), "1");
  } catch {
    /* Storage refused. The answer holds for this session; the question returns
       next time, which is the failure nobody notices. */
  }
}

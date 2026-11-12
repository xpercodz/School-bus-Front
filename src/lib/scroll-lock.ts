/**
 * One body-scroll lock, shared by every overlay.
 *
 * Dialogs used to save `document.body.style.overflow` when they opened and put
 * it back when they closed. That is only correct if overlays close in the
 * reverse order they opened: open A (saves ""), open B (saves "hidden"), close
 * A (restores ""), close B (restores "hidden") — and the page is stuck with
 * `overflow: hidden` for the rest of the session, so no screen scrolls until a
 * reload. A counter cannot get that wrong: the first lock hides, the last
 * release restores, whatever order they come and go in.
 *
 * Returns an idempotent release function.
 */
let locks = 0;
let saved = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (locks === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = saved;
  };
}

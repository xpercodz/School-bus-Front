import { useLayoutEffect } from "react";
import { prefersReducedMotion } from "@/lib/theme";

/**
 * The dashboard-reveal effect: every block on the screen rises in reading
 * order over one fixed total (1650 ms), rather than each block using its own
 * duration. The gap is derived from the block count:
 *
 *   gap = (total - travel) / (blocks - 1)
 *
 * so a sparse screen and a dense one both finish at 1650 ms. One block travels
 * 620 ms; the rest of the budget is the queue.
 *
 * `backwards` fill only: after a block lands it must hand transform back, or a
 * card's hover lift and a button's press scale die for the rest of the session.
 * The first-interaction skip in `src/lib/motion.ts` finishes every running
 * reveal (a pointer, key or wheel), so nothing is hidden under the finger.
 *
 * While the queue is live the class also holds `pointer-events: none`; an
 * invisible-but-clickable row was a real bug earlier. Any interaction removes
 * the class (the reference's skip), which both lands every block at its final
 * state and restores pointer events immediately.
 */
export const PAGE_REVEAL_TOTAL_MS = 1650;
export const PAGE_REVEAL_TRAVEL_MS = 620;

export function usePageReveal(ready = true): void {
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const items = [
      ...document.querySelectorAll<HTMLElement>("[data-page-reveal]"),
    ].filter((el) => el.offsetParent !== null);

    for (const el of items) {
      el.classList.remove("page-reveal");
    }
    if (!ready || prefersReducedMotion() || items.length === 0) return;

    const gap =
      items.length > 1
        ? Math.max(0, (PAGE_REVEAL_TOTAL_MS - PAGE_REVEAL_TRAVEL_MS) / (items.length - 1))
        : 0;
    const gapMs = `${gap.toFixed(1)}ms`;

    for (const [index, el] of items.entries()) {
      el.style.setProperty("--reveal-i", String(index));
      el.style.setProperty("--reveal-gap", gapMs);
    }
    // Force one reflow so a replay after a load cycle restarts the animation
    // instead of being a no-op on an element that already carries the class.
    void document.body.offsetWidth;
    for (const el of items) el.classList.add("page-reveal");

    let timer = 0;
    const clear = () => {
      window.clearTimeout(timer);
      for (const el of items) el.classList.remove("page-reveal");
      for (const event of interactions) {
        window.removeEventListener(event, clear, true);
      }
    };
    const interactions = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const event of interactions) {
      window.addEventListener(event, clear, { capture: true, once: true, passive: true });
    }
    // Safety net: if nothing is touched, the class (and its pointer-events
    // gate) is removed as soon as the last block has landed.
    timer = window.setTimeout(clear, PAGE_REVEAL_TOTAL_MS + 120);
    return clear;
  }, [ready]);
}

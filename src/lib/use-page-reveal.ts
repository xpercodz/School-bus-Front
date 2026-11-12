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
 *
 * ## Taps during the queue
 *
 * Two rules, and they only work together:
 *
 * 1. **A block takes taps once it is visibly arriving**, not for the whole
 *    queue. `reveal-ready` is added per block (below); until then the block is
 *    behind the `pointer-events` gate, because an invisible-but-clickable row
 *    was a real bug earlier.
 * 2. **The queue is skipped on `pointerup`, not `pointerdown`.** Landing the
 *    queue moves every block to its final position, and the browser resolves a
 *    click from the pointerdown and pointerup targets — so clearing on the way
 *    down slid the row out from under the finger and dropped the tap. Measured
 *    in headless Chrome on the same button: clear on pointerdown → 0 clicks,
 *    clear on pointerup → 1.
 *
 * Together that is the difference between "the first tap only lands the page"
 * and "the first tap lands the page and does what it was aimed at": a driver
 * who taps Board mid-reveal boards the child in one tap.
 */
export const PAGE_REVEAL_TOTAL_MS = 1650;
export const PAGE_REVEAL_TRAVEL_MS = 620;
/**
 * How long a block must have been arriving before it accepts a tap.
 * `--ease-expo` is a very fast start: 100 ms in, the block is already about
 * two-thirds opaque with ~6 px of its 18 px left to travel, so a tap is aimed
 * at something the reader can see and landing the queue under the finger
 * cannot move it far.
 */
export const PAGE_REVEAL_TAP_LEAD_MS = 100;

export function usePageReveal(ready = true): void {
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const items = [
      ...document.querySelectorAll<HTMLElement>("[data-page-reveal]"),
    ].filter((el) => el.offsetParent !== null);

    for (const el of items) el.classList.remove("page-reveal", "reveal-ready");
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

    // `pointerup` rather than `pointerdown`: see the note at the top.
    const interactions = ["pointerup", "pointercancel", "keydown", "wheel"] as const;
    let timer = 0;
    const releases: number[] = [];

    const clear = () => {
      window.clearTimeout(timer);
      for (const release of releases) window.clearTimeout(release);
      for (const el of items) el.classList.remove("page-reveal", "reveal-ready");
      for (const event of interactions) {
        window.removeEventListener(event, clear, true);
      }
    };

    for (const event of interactions) {
      window.addEventListener(event, clear, { capture: true, once: true, passive: true });
    }
    // Each block opens itself to taps as it comes into view, so a tap on a row
    // that has arrived acts in one press instead of only landing the page.
    for (const [index, el] of items.entries()) {
      releases.push(
        window.setTimeout(
          () => el.classList.add("reveal-ready"),
          PAGE_REVEAL_TAP_LEAD_MS + Math.round(index * gap),
        ),
      );
    }
    // Safety net: if nothing is touched, the classes (and the gate) are removed
    // as soon as the last block has landed.
    timer = window.setTimeout(clear, PAGE_REVEAL_TOTAL_MS + 120);
    return clear;
  }, [ready]);
}

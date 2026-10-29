import type { CSSProperties } from "react";

/**
 * Motion maths and the one global skip.
 *
 * The CSS vocabulary (curves, durations, keyframes) lives in globals.css. This
 * module only holds the two things CSS cannot express on its own: a stagger
 * whose STEP is derived from the block count, and the "first interaction ends
 * a running entrance" rule.
 */

/** 620ms — the longest move in the scale; keep in sync with --t-travel. */
export const STAGGER_TOTAL_MS = 620;
/** 320ms — one row's own travel; keep in sync with --t-enter. */
export const STAGGER_TRAVEL_MS = 320;

/**
 * Delay for row `index` of `count`.
 *
 * The total is fixed, so the step is derived:
 *   step = (total - travel) / (blocks - 1)
 * A dense list therefore gets a tight wave and a sparse one a wider one, and
 * the last row lands at 620ms in both cases. A fixed step would make the
 * screen's entrance length equal to its data volume.
 */
export function staggerDelay(index: number, count: number): number {
  if (count <= 1) return 0;
  const step = (STAGGER_TOTAL_MS - STAGGER_TRAVEL_MS) / (count - 1);
  return Math.round(Math.max(0, index) * step);
}

/** Style for one `stagger-in` row. Pair with `stagger-in` itself. */
export function staggerStyle(index: number, count: number): CSSProperties {
  return { "--stagger-delay": `${staggerDelay(index, count)}ms` } as CSSProperties;
}

/**
 * Animations that are entrances (not exits, not progress/spinner loops). When
 * one is still running and the user interacts, it is finished immediately so
 * the screen becomes complete under the pointer instead of swallowing the tap
 * or completing in front of it.
 *
 * Keep in sync with the keyframe utilities in globals.css: an entrance that is
 * not listed here simply will not be skipped (it still lands normally).
 */
const ENTRANCE_ANIMATIONS = new Set([
  "rise-in",
  "card-enter",
  "page-reveal-rise",
  "page-in",
  "pop-in",
  "icon-pop",
  "theme-spin",
  "grow-x",
  "code-issue",
  "code-scan",
  "panel-in",
  "sheet-in",
  "toast-in",
  "dlg-fade-in",
]);

let installed = false;

/**
 * How long after an entrance starts a user interaction may still need to skip
 * it. The longest entrance is the 620ms stagger total; the margin covers event
 * and frame latency.
 */
const ENTRANCE_WINDOW_MS = 800;

/**
 * Install the first-interaction skip once per document. `finish()` is the skip
 * itself — no second animation is built to undo the first, and because the
 * finished animation uses fill `backwards` the element lands on its normal
 * style (visible, no transform).
 *
 * `document.getAnimations()` flushes style, so it is only read while an
 * entrance is inside its window. Once the screen has settled, a scroll wheel
 * or an auto-repeating key costs one timestamp comparison, not a document
 * recalc.
 */
export function installEntranceSkip(): void {
  if (installed || typeof document === "undefined") return;
  // No Web Animations API: there is nothing to finish, and the listeners would
  // only throw on every tap.
  if (typeof document.getAnimations !== "function") return;
  installed = true;

  // The first render's animations start a frame or two after install; arm the
  // window immediately so an interaction in that gap still skips them.
  let lastEntranceStart = performance.now();
  document.addEventListener(
    "animationstart",
    (event) => {
      if (ENTRANCE_ANIMATIONS.has((event as AnimationEvent).animationName)) {
        lastEntranceStart = performance.now();
      }
    },
    true,
  );

  const finishEntrances = () => {
    if (performance.now() - lastEntranceStart > ENTRANCE_WINDOW_MS) return;
    // One skip per wave; a new entrance re-arms the window via animationstart.
    lastEntranceStart = -Infinity;
    for (const animation of document.getAnimations()) {
      const name = (animation as CSSAnimation).animationName;
      if (!name || !ENTRANCE_ANIMATIONS.has(name)) continue;
      try {
        animation.finish();
      } catch {
        // Infinite or not associated with a running timeline: leave it alone.
      }
    }
  };

  const interactions = ["pointerdown", "keydown", "wheel"] as const;
  for (const type of interactions) {
    window.addEventListener(type, finishEntrances, {
      capture: true,
      passive: true,
    });
  }
}

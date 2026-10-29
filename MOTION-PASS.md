# Motion pass — School Bus Transit web client

Scope: **how the app moves**, not how it looks. No colours, spacing, copy,
layout or dependencies changed. The movement target is the local spike
`/home/xp/projects/report-fe/spikes/dashboard-reveal/index.html`: one
coordinated page reveal (1.65 s total, 620 ms per block, gap derived from the
block count, any interaction skips), plus the stat cards' hover lift.

## Stack and existing vocabulary

Vite + React 19 + Tailwind v4 + plain CSS keyframes; **no motion library**.
The project already had a curve (`--ease-out-soft`, quint-out), an exit curve,
and a set of durations. The pass kept that vocabulary and closed it.

| Token | Value | Used for |
| --- | --- | --- |
| `--t-press` | 140 ms | press feedback (`transform: scale(.97)`) |
| `--t-hover` | 180 ms | hover/press colour, input border/focus ring |
| `--t-ui` | 240 ms | popovers, menus, small glyph changes, sliding indicators |
| `--t-enter` | 320 ms | a screen, dialog, sheet or row arrives |
| `--t-data` | 500 ms | a count/proportion travelling to a new value |
| `--t-travel` | 620 ms | the longest move (scroll reveal) and the stagger **total** |
| `--t-exit` | 160 ms | overlays leaving |
| `--t-exit-sheet` | 220 ms | bottom sheet leaving |

Every transition picks a value from this list. Tailwind's bare
`transition-colors` defaults were also pointed at the 180 ms/house-curve pair,
so an ad-hoc `duration-200`/`ease-out` can no longer introduce a second
vocabulary.

## The five failures, and what was done

1. **Arrives in pieces.** Status glyphs, the theme glyph, the completed-run
   check and the mobile-nav glyph all played their `icon-pop`/`theme-spin` on
   first mount, as separate specks after the row/screen. They now animate only
   when the value actually changes (status, theme flip, run completion,
   destination). Headers, toolbars and legends were already unanimated blocks.
2. **Moves twice.** Two sources:
   - Every entrance used `animation-fill-mode: both`. After settling, 33
     finished `CSSAnimation`s per roster load were still current and holding a
     transform. Entrances now use `backwards`; only exits keep a forward fill.
   - Above-fold `Reveal` blocks combined `page-enter` with their own 620 ms
     transform, and the dashboard wrapped `FleetList` in a `Reveal` whose rows
     also staggered. Above-fold blocks now appear with the screen, and the
     `Reveal` wrappers around self-staggering lists were removed
     (`DashboardPage`, `ReportsPage`, `DriversPage`). Only content that enters
     later on scroll gets the reveal transition.
3. **The fill mode eats the interaction.** Fixed by the `backwards` change.
   Measured press transform on a control inside the animated screen:
   `matrix(0.97, 0, 0, 0.97, 0, 0)`; `document.getAnimations()` after settle is
   empty (except the intentional live dot / spinner).
4. **A queue, not a wave.** The old stagger was a fixed 45 ms step capped at
   index 9: 10 rows landed ~800 ms after the first (825 ms by construction) and
   an 18-row list still landed at 825 ms, but the last nine all arrived
   together. `staggerDelay(index, count)` now derives the step from the block
   count so the last row lands at 620 ms regardless:
   `step = (620 − 320) / (blocks − 1)`.
   Measured: 4 rows → 100 ms step → last lands 620 ms after the first start;
   10 rows → 33 ms step → last lands 620 ms after the first start. Same end
   time on dense and sparse lists. The dashboard and phone roster now use the
   coordinated 1650 ms page reveal instead (below); the derived-step wave
   remains on the row lists that are not part of a page reveal (reports,
   assignments, drivers, history, analytics).
5. **A dead zone.** Three causes, all removed:
   - **Rows delayed in the stagger were fully transparent but still
     hit-testable.** An adversarial hit-test found that at 120 ms a tap on a
     not-yet-started row could toggle a status the user could not see. The row
     wave is now **transform-only** (it rises; it does not fade), so every row is
     opaque and hit-testable exactly where it looks from its first frame. The
     screen-level fade still comes from `page-enter`.
   - An overlay kept `pointer-events` while fading out; the exiting dialog
     wrapper is now `pointer-events-none`.
   - A screen whose entrance is longer than ~400 ms gets an out. The first
     `pointerdown`/`keydown`/`wheel` finishes the entrances that are still
     current (`Animation.finish()` in `src/lib/motion.ts`), so the screen is
     complete under the pointer. Content is never gated on an animation.

## Other collisions fixed

- **`press` vs `transition-colors`.** On the Complete Run button, the
  `transition-colors` utility replaced `press`'s transition list, so the press
  scale snapped instead of easing. The utility was removed; `press` owns the
  whole list. Verified: `transform 0.14s`, colour `0.18s`.
- **Reduced motion was leaking travel.** `SettingsDrawer` (inline `translateX`)
  and the `Dialog` end drawer (inline `scaleX`) kept animating under
  `prefers-reduced-motion: reduce`; their inline transitions cannot be beaten by
  a plain media rule. Both now carry `.dlg-end-panel` (a reduced-motion
  `transition: none !important`) and render their open state directly when
  reduced motion is on. Verified: transform identity at t=0, no transition and
  zero animation events.
- **Toast exit** said 180 ms in TS but 160 ms in CSS; both are now 160 ms
  (`--t-exit`).
- **History sheet slid out empty.** The sheet clears its paginated entries the
  moment `studentName` becomes null, and the new `Dialog` exit beat would show
  the "no history" empty state for most of the 220 ms slide. It now uses
  `exitAnimation={false}` like the other data-driven sheets; closing is instant.
- **Boot splash moved under reduced motion.** The 3×3 BanterLoader was a second
  looping animation with no reduce rule; it now stops (the grid stays as a
  static mark) instead of sliding for the whole boot. Real spinners still spin.
- **The skip is armed only during a wave.** `document.getAnimations()` flushes
  style, so it is read only within 800 ms of an entrance start (tracked from a
  single `animationstart` listener); a wheel tick on a settled screen costs one
  timestamp comparison. It is also feature-guarded for engines without the Web
  Animations API.
- **Durations/curves** (`200/250/260/280/300/360/420/520`, explicit `ease-out`)
  were mapped onto the scale and the house curve. The modal panel-in is 240 ms,
  sheets 320 ms, the page reveal is 1650 ms total / 620 ms per block, data
  500 ms.
- **Reveal on a restored scroll position**: content whose top is already above
  the fold is shown immediately instead of waiting for an observer that may
  never fire.

## The page reveal (the spike's effect)

`src/lib/use-page-reveal.ts` + `[data-page-reveal]` on the page blocks. On
arrival (after the data lands, not during the skeleton) the hook collects every
visible block in reading order and plays one queue:

| | |
| --- | --- |
| total | **1650 ms** (the last block lands here) |
| travel | **620 ms** per block, `cubic-bezier(.16,1,.3,1)` |
| gap | `(1650 − 620) / (blocks − 1)` |
| motion | `translateY(18px) scale(.985)` + opacity → none, `fill: backwards` |

The dashboard reveals **8 blocks** on desktop (page title, summary card, routes
section, four route rows, roster section) and the phone roster **13** (run
totals, search, filter tabs, ten student rows), so the gap adapts (147 ms vs
86 ms) and both finish at 1.65 s.

- **Any interaction clears the queue** (pointer/key/wheel/touch), exactly the
  spike's "any click skips". While the queue runs the class also holds
  `pointer-events: none`, so a tap on a not-yet-revealed row cannot change a
  student's status by accident; the first tap lands the whole page, the next
  tap operates it.
- The **page head title** is a block; the **Export / Dispatch actions are
  outside the reveal**, so the top bar is usable immediately. Same for the
  filter bar and bottom bar.
- **Reduced motion** never adds the class (zero animation events); **print**
  forces every block to its final state, so a print dialog opened mid-reveal
  cannot print a blank block.

## Card hover + arrival

- **`lift`**: the summary, routes, report KPI and mobile run-total cards rise
  `5px` over 180 ms on hover (pointer-fine devices only). Measured hover:
  `matrix(1, 0, 0, 1, 0, -5)`, `transform 0.18s`, after the reveal has landed.
  No shadow, no colour.
- **`card-enter`** remains for the report KPI strip (that screen does not use
  the page reveal): 620 ms, 18 px + a whisper of scale.
- **`page-enter` is opacity-only**; the blocks are what travel.
- Reduced motion removes the lift and the card travel; print forces both to
  their final state.

## Evidence (headless Chrome, CDP, real layout)

Probe: `.taste-skill/motion/probe.mjs` (local, gitignored, no npm deps), raw
JSON + screenshots at ~400 ms and ~800 ms after the first entrance.
`document.getAnimations()` after settling, computed transforms, real pointer
events, emulated reduced motion.

| Screen | Viewport | Blocks | Step | First start | Last entrance end | Span | Lingering after settle | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard page reveal | 1440×900 | 8 blocks | 147 ms | 430 ms | 2076 ms | 1646 ms | live dot only (intentional) | 0 |
| Roster page reveal | 390×844 | 13 blocks | 86 ms | ~400 ms | ~2050 ms | ~1650 ms | none | 0.0002 |
| Login | 390×844 | page body | — | 160 ms | 472 ms | 312 ms | none | 0.0001 |
| Roster, reduced motion | 390×844 | 0 | — | — | — | — | none | 0.0006 |

Card motion: hover `translateY(-5px)` over 180 ms after the reveal; reduced
motion `transform: none`, `transition: none`. The page reveal is 1.65 s to the
last block on both the dashboard (8 blocks) and the roster (13).

Acceptance checks:

- [x] Nothing arrives in pieces — rows move as blocks; glyph pops only on change.
- [x] Nothing animates twice — zero current entrance animations after settling;
      no element holds a finished `both` fill. The page reveal deliberately
      nests a section and its rows (the spike's columns + cards), but each
      element carries one animation.
- [x] Hover/press lift still works — measured `scale(.97)` on the status pill and
      Complete Run button after the screen settled, and `translateY(-5px)` on the
      summary/routes cards under a fine pointer.
- [x] First interaction mid-reveal completes the screen — pointer at 200 ms
      during the roster queue clears every block at once (`pointer-events`
      gate restored); the screen is complete and usable. That first tap is the
      skip, so it does not also change a status; the next tap does.
- [x] No invisible-but-clickable row — during the queue the blocks hold
      `pointer-events: none`; the first interaction clears the queue. There is
      no window in which an invisible status button can be activated.
- [x] Reduced motion: zero entrance animation events; end drawer and settings
      drawer appear at final position with `transition: none`; hover colour
      still changes; press scale is suppressed; `animate-spin` still runs
      (`spin 1s running`); the boot loader's box travel is stopped.
- [x] No layout shift from the motion — CLS ≤ 0.0006 (font metrics), no row
      reflow; entrances are transform/opacity only.
- [x] Typecheck, lint, production build and `npm run test:offline` (20/20) pass.
- [x] The first-interaction skip still works after the perf change (pointer at
      200 ms during the reveal: queue cleared, screen complete).
- [x] The page reveal lands its last block at **1650 ms** on both an 8-block
      (dashboard) and a 13-block (roster) screen; row lists still on
      `stagger-in` keep the derived 620 ms last-land.

Independently re-measured by a second agent with its own adversarial inspector
(`.taste-skill/motion/verify/verification-report.md`), seven of seven checks
PASS: 24/24 press controls lift, all rows opaque at 120 ms, zero entrance
animations left after settling, zero animation events under reduced motion, and
the same 620 ms last-land on a 10-row and a 4-row list (that check predates the
page reveal; the reveal's 1650 ms total is measured separately in this file).
Its remaining notes are the deviations listed under "Deliberately left alone"
(the run rail, the three proportion bars, and desktop table asymmetry).

Overlays, measured: bottom sheet slides 320 ms from `translateY(59px)` to none;
settings drawer 320 ms from `translateX(16px)` to none; nav drawer 320 ms
`scaleX(0→1)`; all instant under reduced motion. Theme flip keeps its View
Transition (160/320 ms) and glyph spin, but no longer spins on cold load.

## Deliberately left alone

- **The three data-proportion bars** (`StatusChips`, `ManifestSummary`,
  `FleetList` route line/bead) animate `width` / `inset-inline-start`. Here the
  width *is* the datum; a composited rewrite needs previous-share bookkeeping
  (or measurement for the bead) and would distort the rounded caps and the bus
  glyph. They run only when a count changes, inside 2–8 px tracks, and already
  drop their transition under reduced motion. Flagged rather than silently
  changed.
- **`dash-pulse`** animates `box-shadow` on the 6 px live dot (decorative,
  disabled under reduced motion). A transform/opacity ring would be a visual
  change to the dot, not a timing change.
- **The page entrance and the row wave compose**: `main` fades/rises 8 px over
  320 ms and the rows inside it rise 10 px on their derived stagger. That is one
  container arrival plus the content wave, not a second animation on the same
  node; the 620 ms `Reveal` blocks that duplicated a block's own move were the
  real failure and are gone. Kept deliberately, because a pure page fade would
  lose the screen's arrival on slow data. (The boot loader is excluded: see
  above.)
- **The run rail keeps its per-tick cascade** (10 ticks, 0→300 ms delays,
  landing at 620 ms). The ticks are <40 px, so this is the one header element
  that arrives piecewise: it is a data mark, `aria-hidden`, and the wave is the
  signature "one tick per child" read. Stricter reading: drop the per-tick
  delay and let the rail grow as one block.
- **Desktop attendance rows are not staggered** (phone rows are): a 10-row data
  table arriving as one block stays calmer, and the asymmetry follows the two
  different compositions.
- **Below-fold `Reveal`** is a 620 ms transform/opacity transition, not covered
  by the pointer skip: it is triggered by scroll, not a screen or overlay
  entrance, and it now runs only where the content is not already on screen.
- **`AnimatedNumber`** keeps its 500 ms count tween (a real value change) and
  prints the value immediately under reduced motion.
- **The 1650 ms reveal is the spike's own total**, not a 620 ms cap. It is
  skipped by any interaction, and it starts only after the data is on screen
  (not behind the skeleton).
- **Non-motion nits left untouched** (seen while reviewing, out of scope): the
  unused `isOpenRef` in `Dialog.tsx`, the `data-reveal`/`data-run-rail` test
  hooks, and the no-op `scroll-behavior: auto` under reduced motion.
- Unrelated screens and the visual design were not touched.

## Later additions (2026-10-29)

Three motions landed after this pass. All follow the rules above — reduced motion
keeps the final state, nothing is gated on an animation.

- **The theme flip became a wipe.** `beginThemeFlip()` (`src/lib/theme.ts`) is
  called from the theme provider with the element that was pressed; it puts that
  control's centre and its distance to the far corner on `<html>` as
  `--theme-x/--theme-y/--theme-r` and sets `data-theme-flip`. The
  `::view-transition` keyframes in `globals.css` then clip the new theme in as a
  circle out of the switch (480 ms, the house ease), with the old snapshot pinned
  so the clip is the only thing that moves. Ported from `report-fe` on request, so
  both products flip identically. Without the View Transitions API it is a plain
  swap.
- **The route line gained a travelling highlight** (`.route-flow`). One band of
  light sweeps the *travelled* part of each live route line every 3.8 s, then the
  line rests; each row is delayed by −0.42 s so the four lines read as a wave.
  It is the app's only looping decoration, and the only motion here that is
  purely decorative — it is therefore paint-only (`background-position` +
  `drop-shadow` + `hue-rotate`, never layout), it runs only on `IN_PROGRESS`
  rows, and it is removed entirely under `prefers-reduced-motion`.
- **An issued access code arrives once** (`.code-issued` / `.code-scan` in
  `globals.css`). The digits rise 5 px over 320 ms and one paint-only light band
  crosses them over 620 ms, then everything rests; the node is keyed by the code,
  so rotating a code replays it. Event-driven, never looping, and under reduced
  motion the code is simply there with the band removed.

## Limits

- There are no test credentials for the signed-in director screens. The
  roster, dashboard and login were measured in a real browser through a local
  preview harness that renders the real presentational components with fixtures.
  Reports / Assignments / Drivers use the same primitives (`page-enter`,
  `stagger-in`, `Reveal`, `Dialog`); their counts and wrappers were corrected in
  source but those three page bodies were not opened against live Firestore.
- Hover **colour** cannot be measured in headless Chrome (`(hover: hover)` is
  false and CDP ignores media overrides there); the press lift was measured
  directly (`scale(.97)`), and hover colour is the unchanged Tailwind rule.
- The probe harness (`.taste-skill/motion/`) and screenshots are gitignored;
  they are local evidence, not shipped code.

## Reproduce

```bash
npm run dev -- --host 127.0.0.1 --port 5199
node .taste-skill/motion/probe.mjs \
  --url 'http://127.0.0.1:5199/.taste-skill/preview/preview.html?view=roster' \
  --label roster --out .taste-skill/motion/final --width 390 --height 844 \
  --hover 'button[data-status]'
node .taste-skill/motion/summarize.mjs .taste-skill/motion/final
npm run typecheck && npm run lint && npm run build && npm run test:offline
```

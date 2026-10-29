# Local patches to the vendored Arc components

Everything under `src/components/arc/` is Arc registry source (https://uiarc.dev,
installed with `npx shadcn@latest add @uiarc/<name>`). It is copied-in code we
own, not a dependency, so it is edited here rather than fought from outside —
but every edit must be listed below, because **re-running `shadcn add
--overwrite` silently reverts it**.

The one rule that keeps this list short: change a file only when the behaviour
cannot be reached through a prop. Prefer passing `label` / `formatValue` /
`presets` / `emptyLabel` from the app.

## Why patched at all

Two hard requirements in `AGENTS.md` conflict with the files as shipped:

1. **No hardcoded user-facing strings.** Several components bake English copy in
   places that are not props (the OTP per-digit label, the date picker's
   `Presets` / `Cancel` / `Apply` / `n day(s)`, the user menu's `Status` /
   `Theme` / `Sign out`, the charts' empty states).
2. **RTL.** The app runs `dir="rtl"` for Arabic. Some physical geometry cannot
   be fixed from the outside (see each entry).

## otp-input

| File | Patch |
| --- | --- |
| `otp-input.tsx` | Added `sanitize?: (value: string) => string`. The shipped sanitiser is `replace(/\D/g, "")`, which **deletes** Arabic-Indic digits (٠-٩) — a driver typing on an Arabic keyboard watched every digit vanish. `LoginPage` now passes `normalizeDigits`. |
| `otp-input.tsx` | Added `digitLabel?: (index, total) => string` for the per-slot `aria-label`, so screen-reader output is translated. |
| `otp-input.module.css` | `.inputs { direction: ltr }` — a one-time code must read left to right in Arabic too. Without it the digits render mirrored (246810 → 018642) while the arrow keys stay LTR-semantic, so the code is unenterable. |

## user-menu

| File | Patch |
| --- | --- |
| `user-menu.tsx` | Removed an `eslint-disable-next-line @next/next/no-img-element` comment. This repo is a Vite SPA with no Next config, so the directive referenced a rule that does not exist and failed `npm run lint`. |

## button

| File | Patch |
| --- | --- |
| `button.tsx` | Added `icon?: boolean` and `.icon { padding-inline: 0; aspect-ratio: 1 }`. Every icon-only control in the app was a hand-rolled square `w-N h-N` button; without this the Arc Button keeps its 16px inline padding and an 18px glyph renders in a 50px pill. `aria-label` still carries the name. |
| `button.tsx` | Added `align?: "center" \| "start"`. A rail row, a sheet row and a dialog row lead with their icon; the shipped Button centres its label, so `Sidebar`'s footer and the driver shell's menu rows floated in the middle of a left-aligned rail (the client's screenshot). `start` also tightens the inline padding to 8px so the icon column lands under the `<Link>` rows' icons — a prop cannot reach either rule. |

## dropdown-menu

| File | Patch |
| --- | --- |
| `dropdown-menu.tsx` | `label` is optional, plus `ariaLabel`, `align`, `disabled`, `triggerClassName`, `matchTriggerWidth` and a per-item `checked`. The registry component only ever renders a text trigger aligned `end`, which cannot express the six value selectors it now replaces (current value in the trigger, `start`-aligned, full-width on a phone, a check on the selected row) or the Reports icon-only disclosure. |
| `dropdown-menu.tsx` | An `icon`-only trigger renders as a square `.iconTrigger` and drops the chevron; the accessible name comes from `ariaLabel`. |
| `dropdown-menu.module.css` | `.menu` went from `z-index: 60` to `90`. The app's dialogs are `z-[80]`, so a menu opened *inside* one (the dispatch sheet's bus picker, the analytics range menu) painted behind the panel and only its shadow showed at the edge. |
| `dropdown-menu.module.css` | `.menu` gained `max-height: var(--radix-dropdown-menu-content-available-height)` and `overflow-y: auto`. A bus selector holds 12+ items; without it the menu runs past the viewport and its last rows are unreachable. `[data-match-trigger]` makes a full-width select's menu at least as wide as its trigger. |

## calendar

| File | Patch |
| --- | --- |
| `calendar.tsx` | Added `labels?: { today, previousMonth, nextMonth, todayWithDate }`. `Today` / `Previous month` / `Next month` were literals; the app must ship both languages (`AGENTS.md`). |
| `calendar.tsx` | The weekday header no longer slices to two letters (`day.slice(0, 2)`), and Arabic uses `weekday: "narrow"`. Arabic short weekday names are whole words ("الثلاثاء"); slicing produced "ال" in every column, and the unsliced word overflows the 7-column header. |
| `calendar.module.css` | `:global([dir="rtl"]) .navButton svg { transform: scaleX(-1) }`. The month arrows are physical chevrons; in Arabic the header flows right-to-left, so "previous" must point right. |

## date-picker

| File | Patch |
| --- | --- |
| `date-picker.tsx` | Added `labels?: { clear, chooseDay, selected, calendar, today, previousMonth, nextMonth, todayWithDate }`. `Clear` / `Choose a day` / `Selected …` / `"$label calendar"` were literals. |
| `date-picker.tsx` | Added `inline` and `hideLabel`. The report's date control is a chip in a filter row, not a labelled form field: `inline` shrink-wraps the trigger and `hideLabel` keeps the label for screen readers only. In the Analytics modal the same component is a normal labelled field. |
| `date-picker.module.css` | `.popover` anchors with `inset-inline-start` (was physical `left: 0`; the same for `right: 0` in the ≤360px rule). In Arabic the calendar opened away from its trigger and could clip the viewport edge. |

## bar-chart

| File | Patch |
| --- | --- |
| `bar-chart.tsx` | Added `averageValueLabel` and `noDataLabel`. The average line read `Avg 5` and the scrubber's empty reading `No data` as literals, which showed up untranslated on the Arabic Analytics modal (`متوسط الأسطول` heading above a label still saying `Avg`). |

## expanding-search

| File | Patch |
| --- | --- |
| `expanding-search.tsx` | Added controlled `value` / `onValueChange` and made `items` optional. The shipped field owns its query and always unfolds a results panel; three screens here already have a list on the page and need the *field* to filter it in place (roster, Reports toolbar, Assignments). With no `items` and no `suggestions` no panel is opened, so `mode` is guarded to `null`. Collapsing clears the parent's query through `onValueChange("")`, which is what "folded back to an icon" has to mean for a filter. |
| `expanding-search.tsx` | Added `clearLabel` — the clear button's `aria-label` was the literal `"Clear search"`. |
| `expanding-search.module.css` | Anchors moved to logical edges: the shell and panel used physical `right: 0` / `left: 0`, the glyph `left:`, the clear button `right: 7px`, and the input's padding was physical (`0 40px 0 38px`). In Arabic the field grew from the wrong edge and the glyph sat over the clear button. |
| `expanding-search.module.css` | `@media (max-width: 767px) { .input { font-size: 16px } }` — iOS Safari zooms a focused field under 16px, which breaks the fixed phone shell the roster lives in. |

## pagination

| File | Patch |
| --- | --- |
| `pagination.tsx` | Added `labels?: { previous, next, page }`. `Previous page`, `Next page` and `Page {n}` were literals — this app ships both languages. |
| `pagination.module.css` | `:global([dir="rtl"]) .nav .step svg { transform: scaleX(-1) }`. The step arrows are physical chevrons; in Arabic "previous" has to point right. The travelling mark uses `offsetLeft`, which is already physical, so it needed nothing. |

## Still unpatched (known, listed so they are not forgotten)

- `bar-chart` / `donut-chart`, now that the Analytics modal ships them: the bar
  chart draws left-to-right regardless of `dir` (Arabic reads the series in the
  opposite order to the legend), and their assistive-technology summaries
  (`Label, period. Highest X…`, `Press a segment to show or hide it`) are still
  English strings inside the component. The visible UI is translated; a full
  summary formatter is the fix, and it is a bigger prop than the two above.

- `date-range-picker.tsx`: mirrored range band in RTL (physical `left:%` over an
  RTL-flowing grid), `weekday.slice(0, 2)` truncates Arabic to two letters, and
  `Presets` / `Cancel` / `Apply` / `n day(s)` are literals.
- `expanding-search`: physical `right: 0` anchor, icon and clear button sides,
  asymmetric padding — broken in RTL.
- `slope-chart`: start/end columns pinned with physical `left`, and its line
  draw-in never completes (`stroke-dasharray: 1px, 1px` stuck) so the lines are
  invisible unless `prefers-reduced-motion` is on.
- `user-menu`: panel placement uses physical `rect.left/right`, and the theme
  segmented thumb slides the wrong way in RTL.
- `bar-chart`: no empty state (renders a 4-tick axis reading "Daily average 0").
- Dark-mode selectors: `bar-chart` and `user-menu` style against
  `[data-theme="dark"]`. These **do** match — `src/lib/theme.ts` writes
  `data-theme` onto `<html>` as well as the `.dark` class — so no patch is
  needed there, unlike the registry-context assumption.

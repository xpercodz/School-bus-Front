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
| `button.module.css` | `.primary` now fills from `var(--action-bg)` / `var(--action-fg)` instead of `var(--foreground)` / `var(--background)`. The shipped rule paints the committing action in ink, so the app's one accent colour never appeared on the one control that means "do it". The two tokens are declared in `arc-tokens.css` **as references** to `--color-primary` / `--color-on-primary`, so the palette still lives in `globals.css` and `.dark` flips it; no hex is added here. (A colour prop would have meant editing every call site; the mapping is the intended seam.) |

## dropdown-menu

| File | Patch |
| --- | --- |
| `dropdown-menu.module.css` | The menu's filter field moved from inline styles to a `.search` class with an explicit focus state: `outline: none`, `border-color: --border-strong`, and a grey wash (`--focus-ring-soft`) instead of the app's accent-coloured `:focus-visible` ring. Chrome/Safari also draw a native ring on a `type="search"` input, so the field was showing two blue outlines inside an open menu — the ring is now quiet enough that the list being filtered stays the loudest thing. The native clear button is deliberately kept. |
| `dropdown-menu.tsx` | `label` is optional, plus `ariaLabel`, `align`, `disabled`, `triggerClassName`, `matchTriggerWidth` and a per-item `checked`. The registry component only ever renders a text trigger aligned `end`, which cannot express the six value selectors it now replaces (current value in the trigger, `start`-aligned, full-width on a phone, a check on the selected row) or the Reports icon-only disclosure. |
| `dropdown-menu.tsx` | An `icon`-only trigger renders as a square `.iconTrigger` and drops the chevron; the accessible name comes from `ariaLabel`. |
| `dropdown-menu.module.css` | `.menu` went from `z-index: 60` to `90`. The app's dialogs are `z-[80]`, so a menu opened *inside* one (the dispatch sheet's bus picker, the analytics range menu) painted behind the panel and only its shadow showed at the edge. |
| `dropdown-menu.module.css` | `.menu` gained `max-height: var(--radix-dropdown-menu-content-available-height)` and `overflow-y: auto`. A bus selector holds 12+ items; without it the menu runs past the viewport and its last rows are unreachable. `[data-match-trigger]` makes a full-width select's menu at least as wide as its trigger. |
| `dropdown-menu.tsx` | Added the optional `searchable?: { placeholder, emptyLabel }` prop: a controlled search field in a sticky first row filters `items` by a case-insensitive substring of `item.label`. Reports needs a class picker over a dozen classes, and the search belongs *inside* the menu — a second search field beside the dropdown would search the page, not the list the dropdown is about to show. The field keeps focus (printable keys are stopped before Radix's typeahead can jump to a matching row), ArrowDown moves to the first visible row, Escape closes, and picking a row clears the query. Without the prop the rendered markup and behaviour are unchanged. `shadcn add @uiarc/dropdown-menu --overwrite` reverts the field, the filtering, the focus handling and the sticky row — and `ClassGrid` then fails to typecheck, because it passes `searchable` (the prop is simply gone). |
| `dropdown-menu.tsx` | Added `DropdownItem.meta` (a right-hand row value, e.g. a class's student count) and `DropdownMenuProps.badge` (the same value in the trigger). The class filter shows "All classes `12`" and each row's count; neither has a slot in the shipped markup. Both are absent-safe, and `meta` does not take part in the search filter. `--overwrite` drops them, and `ClassGrid`'s counts disappear (again, a typecheck failure rather than a silent regression). |

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
| `date-picker.module.css` | The ≤360px rule set `inset-inline-end: 0` **and** `width: auto`. With both insets set, `width: auto` resolves to the containing block, which for the dashboard's compact `inline` chip is ~110px — so the phone calendar laid itself out in a third of the screen: overlapping day numbers and a clipped month title. The rule now sets a real width (`min(320px, 100vw - 24px)`) and keeps only the tighter padding. |

## bar-chart

| File | Patch |
| --- | --- |
| `bar-chart.tsx` | Added `averageValueLabel` and `noDataLabel`. The average line read `Avg 5` and the scrubber's empty reading `No data` as literals, which showed up untranslated on the Arabic Analytics modal (`متوسط الأسطول` heading above a label still saying `Avg`). |
| `bar-chart.tsx` | Added `ariaSummary` and `scrubberLabel`. The chart built its screen-reader sentence itself (`"{label}, {period}. Daily average 5. Highest Bus 04, 7."`) and its scrubber name (`"{label}, explore by day"`), so a French or Arabic reader heard English around translated data. Both are complete strings now, composed by the caller — word order is not the component's to decide — and the built-in English sentence is only a fallback. |

## donut-chart

| File | Patch |
| --- | --- |
| `donut-chart.tsx` | Added `legendAriaLabel`, `rowLabel`, `hiddenLabel` (and our caller now passes `otherLabel`). The legend list announced `"{label}, segments. Press a segment to show or hide it"`, each row `"{label}, {value}, {share}. Includes …"` and a hidden row `"{label}, hidden"` — all literals. `rowLabel` receives the value and share already formatted, so the caller only supplies words. |

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

## file-dropzone

Installed from `@uiarc/file-dropzone` for the Assignments import. Its registry
dependency `arc-motion-tokens` was already present and was **not** overwritten —
the local copies differ from the registry's only by a doc comment. The component
needs no CSS re-map: every custom property its module reads is already in
`arc-tokens.css` except the two added with it (next section).

| File | Patch |
| --- | --- |
| `file-dropzone.tsx` | Removed the shipped `eslint-disable-next-line @next/next/no-img-element` comment, for the same reason as `user-menu`: this is a Vite SPA with no Next config, so the directive referenced a rule that does not exist and failed `npm run lint`. The explanatory comment is kept. |
| `file-dropzone.tsx` | Added `labels?: Partial<FileDropzoneLabels>`, an object prop after the shape `date-picker` and `otp-input` already use, plus a `fill()` helper for its `{name}` / `{count}` placeholders (same `{var}` syntax as the app's `t()`). It reaches the strings the registry writes itself, which no existing prop could: the file list's `aria-label`, the remove button's `aria-label` and `title`, the retry button's label and `title`, the drag-over copy (still losing to `dropLabel`), the failure row's screen-reader `Failed:` prefix and its fallback reason, and the two visible refusals (wrong type, one file and several; over `maxFiles`). Every default is the shipped English, so a consumer that passes no labels renders exactly what it did before. `AssignmentsPage` passes all twelve from `t()` via `sheet.dz.*`. **`shadcn add @uiarc/file-dropzone --overwrite` reverts this**, and the page then fails to typecheck because the `labels` prop is simply gone (a loud failure, not a silent regression). |

**Strings.** `label`, `description`, `note` and `dropLabel` are props, and
Assignments passes `t()` for all four. Everything else the component writes now
comes from the `labels` prop. Three shipped strings stay English on purpose,
because nothing in this app's usage reaches them and `sheet.*` has no key for
them: the `"Drop to upload"` drag label (needs `onUpload`, which Assignments
never passes), `File is larger than …` (needs `maxSize`), and the live-region
announcements (`… added`, `… removed`, `Retrying …`, `… uploaded`). The last
is the one worth a follow-up: it is the only one a screen-reader user would meet
if upload or size limits are ever wired up.

**One wording nuance in the defaults.** The shipped over-`maxFiles` line
pluralised on the cap (`You can add up to 1 file` / `… files`). The
one-placeholder shape cannot express that, so the default template carries the
plural form. Unreachable here (Assignments passes `maxFiles={1}` *with* labels,
and the `sheet.dz.tooMany` key says `{count} files at most` in both languages),
but it is a deliberate choice rather than an accident.

## Tokens added for file-dropzone

`arc-tokens.css` gained two mappings, by reference like the rest of the adapter:

| Token | Maps to | Why |
| --- | --- | --- |
| `--radius-surface` | `var(--radius-panel)` | The drop target is a card-sized surface, so it takes the panel step (14px). |
| `--ease-in-out` | `var(--ease-standard)` | The drop target's breathe loop and state transitions; the app has one in-out curve, so no second one was introduced. |

## Still unpatched (known, listed so they are not forgotten)

- `bar-chart` / `donut-chart`: the charts' **accessible strings are now ours**
  (see the entries above), but the bar chart still draws **left-to-right
  regardless of `dir`**. Mirroring it means inverting the bar geometry, the axis
  label fitting, the scrubber's hit-test and the average line together — a
  rewrite of the plot rather than a swap, and one that needs a visual check in
  Arabic, which no test in this repo can perform. Recorded here as a decision,
  not an oversight: a time axis that reads left-to-right is a convention many
  Arabic dashboards keep, while every label, unit and number around it is
  localized.

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
- `file-dropzone`: the three strings its `labels` prop deliberately does not
  cover — the `onUpload` drag label, the `maxSize` refusal, and the live-region
  announcements. See its section above; the rest of its copy now comes from
  `t()`.
- Dark-mode selectors: `bar-chart` and `user-menu` style against
  `[data-theme="dark"]`. These **do** match — `src/lib/theme.ts` writes
  `data-theme` onto `<html>` as well as the `.dark` class — so no patch is
  needed there, unlike the registry-context assumption.

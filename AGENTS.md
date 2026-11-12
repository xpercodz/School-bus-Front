# Agent notes — School-bus-Front (frontend)

This repository is the **web client only** (Vite + React 19 + React Router SPA).
The privileged backend is a **separate repository** at `../School-bus-API`
(Hono on Node 22). They are independent git repos with independent deploys.

## Before you write code

Load the `karpathy-guidelines` skill with the skill tool and follow it for every
task that touches code — including work delegated to a subagent, which does **not**
inherit it from the parent conversation and must be told to load it.

- **Think first.** State assumptions, surface the trade-off, and ask when a
  request admits two readings. Do not pick an interpretation silently.
- **Simplest thing that works.** No speculative abstraction, no configurability
  nobody asked for, no handling for impossible states.
- **Surgical changes.** Every changed line traces to the request. Match the
  existing voice instead of improving it; mention unrelated dead code rather than
  deleting it.
- **Verify, don't assert.** Turn the task into a checkable goal (`npm run
  typecheck`, `npm run lint`, `npm run build`, `npm run test:offline`) and run the
  check before saying it is done.

## The one architectural rule

**Firestore client SDK for realtime and offline. The API for anything privileged.**
Do not add Next.js, do not add server rendering, and do not move Firestore reads
behind the API.

- **Reads and roster writes go straight to Firestore** from the browser, via the
  Firebase client SDK in `src/lib/school-data.ts` / `src/lib/school-admin.ts`,
  using `onSnapshot` plus the persistent local cache configured in
  `src/lib/firebase.ts`. This is deliberate and load-bearing: drivers lose signal
  on a bus route, and the durable IndexedDB write queue is what stops a "Boarded"
  tap from being silently lost.
- **Privileged operations go to the API** through `src/lib/api.ts`: director
  sign-in, driver access-code verification, driver creation, code rotation.
  Firebase Auth users and `users` profiles are Admin-SDK-only, so these can never
  run from the client.

If a change seems to need a new Firestore read on a privileged collection,
that is a signal the endpoint belongs in the API repo instead.

## Offline: two layers, and they are not interchangeable

Offline support is deliberately split, and both halves are required:

1. **Data** — Firestore's `persistentLocalCache` (IndexedDB) in `src/lib/firebase.ts`.
   Serves reads from disk and queues attendance writes durably, so a "Boarded" tap
   survives a dead zone, a reload, and a phone restart.
2. **App shell** — the service worker from `vite-plugin-pwa` (see the `VitePWA`
   block in `vite.config.ts`). Precaches `index.html`, the JS/CSS, the bundled
   @fontsource webfonts, and the icons, with `navigateFallback: /index.html` for
   SPA routes.

Layer 1 alone is not enough: without layer 2, a driver who reloads while offline
gets the browser's error page even though their queued writes are safe on disk.
`src/lib/service-worker.ts` also reloads on `controllerchange` — without it an
open page keeps running old JS after a deploy while `cleanupOutdatedCaches` has
already dropped its route chunks.

**Rules when touching `workbox` config:**

- Every `urlPattern` must be **self-contained**. Workbox stringifies these into
  the generated `sw.js`, so referencing an outer variable (e.g. a captured API
  origin) emits a dangling reference that throws on every fetch. Use string
  literals, regex literals, or workbox's own matcher options.
- **Never add runtime caching for Firebase, Auth, or the API — and do not add
  `NetworkOnly` "guard" routes either.** An earlier version did exactly that, on
  the theory that explicitly-not-caching is harmless. It broke production:
  Firestore's WebChannel falls back to a **long-polling GET**
  (`.../Listen/channel?...TYPE=xmlhttp`) that stays open for a long time, and any
  matching route makes Workbox `respondWith(fetch(...))` it. Chrome reports "A
  ServiceWorker intercepted the request and encountered an unexpected error",
  Firestore never connects, and — because the loading gate waits for a *server*
  snapshot — the dashboard shows skeletons forever. `runtimeCaching` is
  deliberately `[]`: a request matching no route is never `respondWith`'d, so the
  browser handles it natively, which is what Firestore needs. The guard against a
  future broad rule is the comment in `vite.config.ts` plus the
  `npm run test:offline` assertions, not a route.
- `firebase.json` pins `Cache-Control: no-cache` on `/sw.js`, `/registerSW.js`
  and `/manifest.webmanifest`. Don't remove those or deploys stop reaching
  clients that already have a worker.

**Precache size — read this before "optimising" it.** It is ~2.14 MiB, and the
composition is not what the filenames suggest: the Firebase SDK + motion vendor
chunk (~823 KiB, named after whichever module Vite happened to bundle with it —
currently `createLucideIcon-*`, which is misleading and has been `motion-*` and
`button-*` in earlier builds) and the app entry (~288 KiB) are needed by every
user, and the genuinely director-only route chunks are only ~90 KiB
(`ReportsPage` is 40 of it). The rest is fonts — including the ~111 KiB icon
subset (both families).

Legacy `.woff` is excluded via `globIgnores`. `@fontsource` emits both formats for
every face, and the Arabic package alone makes that 269 KiB; only clients that can
run a service worker can use this precache at all, and every one of those supports
woff2, so those woff files are unreachable. `npm run test:offline` asserts they
stay out.

Font **subsets** are deliberately left alone. `@fontsource` ships greek, cyrillic,
vietnamese and latin-ext for IBM Plex Sans that an en/fr/ar UI never renders — but
dropping a subset makes text in that script fall back to a system font (a student's
name in Cyrillic, say). That is a product call about who the app is for, not a
build tweak. If you do decide to trim, import the subset-specific CSS in
`src/main.tsx` (e.g. `@fontsource-variable/ibm-plex-sans/latin.css`) rather than
ignoring files at precache time, so online and offline behave identically.

Verify with `npm run build && npm run test:offline`. It boots the built app in
headless Chrome, stops the server outright, reloads, and asserts the document was
served `fromServiceWorker` — so it catches a broken fallback or a precache glob
that misses a chunk. It skips (exit 0) when no Chrome is installed.

## Layout

```
src/
  main.tsx                  entry: fonts + globals.css + <App/>
  App.tsx                   BrowserRouter, route table, per-route document meta
  routes/                   one file per screen (MobilePage, LoginPage, Dashboard*, …)
  components/               presentational components (most are framework-free)
  components/dashboard/     director-area components + the RouteFallback shell
  data/                     types + presentation config only — no data, no fetching
  lib/
    api.ts                  typed client for the API (the only backend call site)
    api-contract.ts         MIRROR of the API contract — see "Contract drift"
    firebase.ts             the single Firebase client init (realtime + offline cache)
    school-data.ts          realtime roster/dashboard/trend Firestore hooks
    school-admin.ts         director-admin Firestore hooks + assignments writes
    use-page-slice.ts       pagination for any in-memory list + auto load-more
    date-value.ts           YYYY-MM-DD <-> Date, the bridge to the Arc pickers
    motion.ts               stagger maths + first-interaction entrance skip
    persistent-storage.ts   asks for an IndexedDB eviction exemption
    service-worker.ts       reloads the page when a new worker takes over
    i18n/                   typed en/fr/ar dictionaries, LocaleProvider, Intl formatting
public/icons/               generated PWA/apple-touch icons (see "Offline")
public/fonts/               generated Material Symbols subset (see "Conventions")
scripts/build-icon-font.mjs regenerates the icon subset (run when icons change)
scripts/offline-smoke.mjs   headless-Chrome offline regression test
```

## Who may open what (roles, screens, the main director)

Three roles live on `users/{uid}`: `director`, `operator`, `staff` (the driver,
code-only sign-in).

- **operator** — office staff below the director. Signs in with email + password
  on the same tab as the director, and may open only the screens listed in their
  profile's `screens` array: `live`, `students`, `reports`, `assignments`,
  `drivers`. Operators can never reach the Operators page, so they can never
  hand out access.
- **director** — every screen. Exactly one director also carries
  `owner: true` — the **main director**, the only account that sees the Operators
  page and may create, re-scope or remove operators. `owner` is a flag, not a
  role, because a director already holds everything the rules grant.
- **staff** — unchanged: a 6-digit code, writes only their own bus's
  runs/attendance.

**The three places that have to agree, or the permission is a hidden link:**

1. `src/lib/permissions.ts` — `canOpenScreen` decides what is DRAWN (nav rows,
   route guards). `RequireAccess` admits the management shell; `RequireScreen`
   gates each route and redirects to the first screen the reader CAN use.
2. `firebase/firestore.rules` — reads the same `screens` names off the caller's
   profile and grants a collection to the union of screens that need it.
   Writes are narrower and split by grant, each with its own field list: an
   operator granted **Students** may **create** a student and correct a `name`
   or `grade`; one granted **Assignments** may change the `busId` and nothing
   else (`diff().affectedKeys().hasOnly([...])`). Neither list is a subset of
   the other, so handing out one grant can never quietly hand out the other —
   and a caller holding **both** gets the union, including `grade` + `busId` in
   one write, which is what a sheet import sends (one row, one decision, one
   batch). A grant is the authority: a secretary granted Students does the
   roster's work. **Deleting** a student, renaming the school and the Operators
   page stay director-only.
3. `School-bus-API` — `requireManager(screen)` for the privileged driver
   endpoints, `requireOwner` for `/v1/operators*`. Accounts can only be created
   there: Firebase Auth users and profiles are Admin-SDK-only.

The main director is resolved in one place, `src/lib/main-director.tsx`
(`MainDirectorProvider` in the shell), because the rail, the phone bar and every
route guard must read the same answer. The rule has two steps:

1. `owner: true` on a director's profile — set by the seed, or by
   `npm run owner -- <director-email>` in the API repo (`scripts/set-owner.mjs`,
   which also clears the flag from the school's other director profiles);
2. **a school with exactly one director** — that director is the main one,
   because there is no other account the flag could mean.

Step 2 exists because gating on the flag alone made the feature ship dark on
every existing deployment: the row was invisible, and a director reasonably
concluded it had not been built. `requireOwner` in the API applies the same two
steps, so the client and the server never disagree. Once a school has a second
director, step 2 stops applying and the flag decides.

**`assignmentMode` on `schools/{schoolId}`** (`"bus"` | `"driver"`, absent =
`"bus"`) decides whether Assignments labels a student's assignment by the bus or
by the driver. It is the school's value, not the device's, so two colleagues
read the same column; a director or an operator granted Assignments may write
that one field, and the rules refuse every other field on the document.

## Contract drift

The HTTP contract is duplicated on purpose because the repos are independent:

- **Source of truth:** `School-bus-API/src/contract.ts`
- **Mirror:** `src/lib/api-contract.ts`

Nothing enforces this at build time. If you change a path, a request/response
shape, or an error code in the API, update the mirror in the same sitting.
If the contract outgrows a handful of endpoints, publish the backend module as a
private package instead of mirroring it.

## Registry components (Arc UI)

`src/components/arc/` holds components copied in from the Arc registry
(https://uiarc.dev) with `npx shadcn@latest add @uiarc/<name>`. They are our own
code now, not a dependency. Installed set: `button`, `dropdown-menu`,
`date-picker` + `calendar`, `date-range-picker`, `expanding-search`,
`pagination`, `theme-switch`, `icon-morph`, `otp-input`, `user-menu`,
`file-dropzone` and the `bar-chart` / `donut-chart` / `slope-chart` family:

- **Tokens.** They read a generic surface (`--foreground`, `--surface`,
  `--accent`, `--radius-control`, `--duration-*`) that this app does not have.
  `src/components/arc/arc-tokens.css` maps every name onto our `--color-*` tokens
  **by reference**, so a palette change or a `.dark` flip needs no edit there.
  Never restyle the vendored `.module.css` files to fix a colour — change the
  mapping, or pass a `color` prop where the API offers one.
  One recorded exception (in `PATCHES.md`): `Button`'s `.primary` fills from
  `--action-bg` / `--action-fg`, declared in `arc-tokens.css` as references to
  `--color-primary` / `--color-on-primary`. The shipped rule filled the one
  committing action with ink, so the app's only accent colour never appeared on
  the control that means "do it". Keep those two tokens as references — the
  palette stays in `globals.css`, and `.dark` flips them for free.
- **Patches.** Edits to the vendored source are listed in
  `src/components/arc/PATCHES.md` with the reason. `shadcn add --overwrite`
  reverts them silently, so re-read that file after any re-install.
- **Strings.** The components ship English defaults. Anything user-facing must
  come from `t()` in both dictionaries; where a string is not reachable as a
  prop it is patched (see PATCHES.md), never left in English. `file-dropzone`
  is the newest example: it grew a `labels` prop because its refusals, Retry /
  Remove labels and list name were literal strings.
- **RTL.** Arabic sets `dir="rtl"` on `<html>`. Components that position things
  with physical `left`/`right` are broken there — check the RTL column in
  PATCHES.md before adopting one.
- **Performance: the animation runtime and the roster entry.** `motion` (a
  dependency of these components) is ~59 KiB gzip. `LoginPage` and
  `DirectorShell` are `lazy()`-loaded so their arc components stay in route
  chunks, and the **entry chunk itself is still ~90 KiB gzip** (`index-*.js`,
  90.5 KiB measured). But the roster is the entry route: once `PhoneShell`,
  `TopAppBar`, `MobilePage` and `StudentCard` all render Arc Buttons and the Arc
  theme switch, the motion runtime becomes reachable from the entry, is hoisted
  into the vendor chunk the entry loads (measured: `createLucideIcon-*.js`
  823 KiB raw / 249.4 KiB gzip, preloaded in `index.html`), and the driver's
  first paint pays it. That is the accepted cost
  of one button component everywhere. **If the offline-critical first paint
  budget ever wins again**, the move is to keep the roster-path controls on raw
  `<button>`s (or a motion-free Button) rather than to un-lazy a route — and
  then re-check `dist/index.html`, not just `dist/assets/index-*.js`.

## Conventions

- `@/*` maps to `src/*` (see `tsconfig.json` and `vite.config.ts`). Keep both in
  sync if you ever change it.
- User-facing strings are **never** hardcoded — add a key to
  `src/lib/i18n/dictionaries/en.ts` (which defines the `Messages` type), then to
  `ar.ts` **and** `fr.ts`, and resolve via `t()`. Every language must stay
  complete: the two translations are typed as `Messages`, so a missing key fails
  `tsc --noEmit`, which `npm run build` runs first. Three languages means three
  dictionaries, not two and a fallback — a key that exists only in English
  renders English to a French or Arabic reader with no warning at runtime.
  `docs/i18n-glossary.md` is the shared vocabulary (élève, conducteur, trajet,
  présence); follow it rather than inventing a second word for the same object.
- A string that embeds a **count** uses `tp(key, count, vars)`, not `t`: the
  dictionary keeps the plural on the base key and adds `<key>.one`, and
  `tp` picks the CLDR category with `Intl.PluralRules` (falling back to
  `.other`, then the base key). Base keys listed in `PluralKey`
  (`src/lib/i18n/types.ts`) are the ones with plural forms. Without it a
  school with one unrecorded child reads "1 students". Pass the raw number to
  `tp` and the localized digits (`toLocaleDigits`) as the `{count}` var.
- `src/data/` holds types and presentation config (statuses, KPI ids, nav items).
  No data lives there.
- Material Symbols Rounded/Outlined is **self-hosted as a subset** in
  `public/fonts/` — there is no CDN and no runtime external asset load left. Those
  `.woff2` files are build artifacts: `scripts/build-icon-font.mjs` scans the source
  for `<Icon name="…">` and for **any property ending in `Icon`** (`icon:`,
  `footerIcon:`, …), then asks the Google Fonts API for only those glyphs (~111 KiB
  for both families, versus **5.2 MiB per family** for the full font). **Re-run it
  whenever an icon is added or removed** — a missing glyph renders as its literal
  ligature name (and an unknown name that starts with a real icon, such as
  `directions_bus_off`, renders that glyph plus the leftover `_off`). Google
  silently drops unknown names; verify a new one in a browser after building.
  Two traps, both of which have already bitten once:
  - Scanning only `icon:` missed `footerIcon: "warning"`, so the live dashboard
    rendered the literal word "WARNING". Keep the property match broad — a spare
    glyph costs bytes, a missing one is a visible bug.
  - The filenames are **stable but the content is regenerable**, so `firebase.json`
    pins `Cache-Control: no-cache` on `/fonts/**`. Without it a client keeps an old
    subset (and thus the old missing glyph) for the whole `max-age`.
  Names built dynamically can't be grepped, so they live in the script's
  `EXTRA_ICONS` (e.g. `TopAppBar`'s RTL back arrows).
- Icon CSS lives in `src/globals.css` and must **re-declare everything Google's
  CDN stylesheet used to supply**. Icons render by *ligature* — the element's text
  is the icon name and the font substitutes one glyph — which only works when the
  text is exact-lowercase, not letter-spaced, and `liga` is enabled. The CDN's
  `.material-symbols-*` rule reset all of that, shielding icons from surrounding
  styles; e.g. `AttendanceTable` puts `uppercase` and `tracking-widest` on a
  heading that *contains* an icon. Removing the CDN `<link>` without these resets
  made those icons fall back to literal text ("DIRECTIONS_BUS"), and the missing
  `font-feature-settings: "liga"` is why Firefox broke hardest. `direction: ltr`
  matters too — this app runs in English, French and Arabic, and RTL would
  reverse the ligature. So the
  classes carry `text-transform: none`, `letter-spacing: normal`,
  `font-feature-settings: "liga"`, and `direction: ltr`. **Do not remove them**,
  and prefer wrapping a label in its own span over styling a container that holds
  an icon.
- The `@font-face` rules use `font-display: block`, deliberately unlike the text
  fonts: the fallback for an icon glyph is the icon's own name, so showing text is
  worse than showing nothing briefly.

## Controls: one Button, one Dropdown, one DatePicker

Every **action** control in the app is `@/components/arc/button/button`. Every
**value selector** is `@/components/arc/dropdown-menu/dropdown-menu`. Every
**date field** is `@/components/arc/date-picker/date-picker`.

What is deliberately *not* a Button: navigation items (links), `SlideSegments` /
`SegmentedTabs` (their sliding thumb is the control), status-filter chips (a
pressed-state rail), `StudentCard`'s status pill (its tint *is* the roster's
status language, and the Button module owns colour), and calendar day cells.
They look like buttons but are a different control with its own geometry;
converting them flattens the pattern.

**Button grammar** — pick by meaning, not by what the old `<button>` looked like:

| variant | used for |
| --- | --- |
| `primary` | the one committing action: save, sign in, confirm, export, create |
| `secondary` | everything outlined: cancel, toolbar actions, load more, row actions |
| `ghost` | borderless: dialog close, dismiss, inline icon controls |
| `danger` | destructive: sign out, remove, revoke |

`size="sm"` is the 36px desktop control row (`h-9`), `size="md"` the 44px thumb
floor (`h-11`), `lg` 48px. `icon` makes it a square with no label — always pair
it with `aria-label`. For a rail, sheet or menu **row** pass `align="start"`: the
shipped Button centres its label, and a centred row in a left-aligned rail is
exactly what made the sidebar footer look detached from the nav above it.
Outlined buttons need the 3:1 edge, so pass `className="arc-field"` with
`secondary`/`danger`. `loading` replaces a hand-rolled spinner. Always pass
`type="button"` (or `submit` inside a form).

**Two traps when converting:**

1. **Tailwind cannot beat a CSS module.** The vendored `.module.css` is unlayered,
   utilities are layered, so `hidden`, `sm:flex`, `bg-*`, `text-*`, `rounded-*`,
   `px-*`, `gap-*` and any height below the selected size are silently ignored on
   a Button or dropdown trigger. For responsive display or a distinct surface,
   wrap the control in a `<div>` and put those classes there. `w-full`, `w-auto`,
   margins, `self-*` and `ms-auto` are safe (the module sets no width/margin).
2. **One child slot.** `<Button><Icon/>{label}</Button>` keeps icon and label on
   the module's 8px gap. Do not pass `flex`/`justify-*`/`text-*`; the component
   owns centring and type.

The `press` utility is for the controls that stayed custom — an Arc Button presses
itself.

**Every search field is `@uiarc/expanding-search`** — an icon that unfolds into
the field and folds back when emptied: the phone roster (`SearchBar`), the
Students roll toolbar, Assignments and the Drivers access-codes list. The bus
sheet has no search field: it pages its students instead, and a search box in a
twelve-row dialog was a second way to do the same thing. They use its *filter* form (controlled `value`/`onValueChange`, no
`items`), because the page already renders the list the search narrows; passing
`items` would turn filtering into a jump-to panel. Leave `anchor="start"` so the
field grows from the leading edge in both directions, and keep the container's
width (the field never grows past it). **Inside a `Dialog`, stop Escape from
propagating out of the field** (see `BusOverviewModal`): the field collapses on
Escape and the dialog's document listener would close the whole overlay on the
same press. `Dialog` now also ignores an Escape it did not handle itself
(`event.defaultPrevented`), so a menu or popover inside a dialog can close
without taking the dialog with it. Filter local state, not the page's pagination or Firestore.

**State-changing icons are `@uiarc/icon-morph`** where one of its families fits
(`menu`, `play`, `plus`, `copy`, `theme`, `chevron`, `bell`, `heart`): drive it
with `state` inside an Arc Button and let the button carry the name. Today that is
the access-code copy button (`copy` → check → back, plus the toast). The eye
toggle, the hamburger and the theme glyph deliberately stay as they are — there is
no eye family, the hamburger is covered while its sheet is open, and the sun/moon
belongs to `theme-switch`.

**A one-time access code is state, not a toast.** Codes are hashed at rest, so
`POST /v1/drivers/regenerate` returns the plaintext exactly once — the Drivers
page must keep that answer in component state (`issuedCodes`), not throw it
away. Discarding it was the "Generate code does nothing" bug: the toast fired,
`useDriverCodes` still had no plaintext, and the row kept showing "Generate
code". The issued code is revealed in the row with the once-per-code
`code-issued` / `code-scan` animation and the "copy it now" hint; leaving the
page loses it by design, so the hint must never promise persistence.

**A whole-row action is one overlay button.** A fleet row opens the bus overview,
so the row's hit area is a single absolute `<button>` (inset 0, `aria-label`,
`focus-visible` inset ring) above the non-interactive content — never a click
handler on the `<article>`, and never other controls inside it. The trailing
chevron is that button's visible affordance.

**A student's name lives in two places, and an edit must fix both.** `students`
is the record; `attendance` documents snapshot `studentName`/`grade` at dispatch
time, and the driver's sheet and the day view read the copies while the roll
reads the record. `updateStudent` (`school-admin.ts`) therefore corrects today's
attendance copies in the same batch — except for a run that is already
`COMPLETED`, whose record of the day stands — and never touches past days. When
you add another screen that edits a student, do the same or the two screens will
disagree until the next dispatch.

**Every director list is paged, and pages are one component.** `PaginationBar`
takes any `Pagination` (from `usePageSlice`, or the roster's `useStudentList`)
and renders "Showing X–Y of Z" beside `@uiarc/pagination` (a five-number window
whose numbers travel like a belt, one shared mark gliding to the current page —
do not hand-roll page buttons). Page size is 10.

- Lists already fully loaded (staff, a student's history, a loaded cursor page)
  are sliced with `usePageSlice(items, 10, resetKey)`. The page **clamps** when
  rows change under it, so a live snapshot never bounces the reader to page 1,
  but a changed `resetKey` (the search text, the open student) goes back to 1.
- A cursor-paginated list (Assignments students) pages over the rows it has
  loaded and calls `useAutoLoadMore` when the reader reaches the last loaded
  page, so there is no "Load more" button left anywhere.
- The **driver's roster is deliberately not paged**: a driver has to see every
  child on the run, offline, without an extra tap between them and a student.
- The **class cards on Reports page 8 at a time**, not 10: the grid is four
  across, so eight is exactly two rows and every page closes its last row. Ten
  would leave page 1 ending on a two-card row.

**The roll is the whole of `/dashboard/students`, and it has no date.**
`StudentsPage` answers one question — who is on the roll, and how is each child
doing — so it reads `useSchoolRoll` + `useRollSummary` and nothing else: every
child in `schools/{schoolId}/students`, whatever happened today, with present
days, absent days, attendance % and the last recorded day + state over the
90-day retention window (`ROLL_SUMMARY_DAYS`). `rollRow` fills the day-only
fields of `AttendanceRow` with the app's own "no time" placeholder, which the
table never renders.

- **A date picker here was removed, deliberately. Don't put it back.** It
  switched the page into a per-day run view (segment, Off place, boarded /
  dropped times, status), which is Reports' question — and having it here made
  the screen a second Reports wearing the roll's title. The screen is not
  day-scoped; `useSelectedDate` has no `"students"` scope any more.
- **One day is answered where it is already sliced**: per bus on the live
  monitor (a route opens that bus's sheet) and per class on Reports (a class
  card opens its students). An all-students day table was the only thing the
  picker added, and it was the least useful cut of the same data.
- **A class is picked, never typed.** `EditStudentDialog` offers the classes the
  school already has (distinct `grade` values on its students); a genuinely new
  class arrives with the sheet import. Free text was what turned `4A`, `4a` and
  `Class 4A` into three cards on Reports. Classes are still strings — there is
  no `classes` collection, no enrolment history, and none is needed while a
  child's class is only ever "where he belongs today".
- Consequences of the roll being the only view: there is **no run-order sort**
  (a place in a run is a fact about a day) and **no status filter** (the roll's
  state is a 90-day tally, not a status) — `useStudentList` carries search,
  class and pagination only.

**Each day-scoped screen owns its own date.** Live monitor and Reports call
`useSelectedDate("live" | "reports")` (`src/lib/selected-date.ts`), which
remembers that screen's choice in `sessionStorage` — so leaving Reports and
coming back keeps the day, while picking a day on Reports never moves the Live
monitor. Sharing one value between them was tried and reverted: the two screens
answer different questions, and a date is part of the question. `null` means the
live day on both. Cleared on sign-out; the run segment is still per-page state.

The presence counts are **days**, not runs: a morning + afternoon pair is one
schoolday, so "42 present · 2 absent" reads as schooldays. `useRollSummary` is
one newest-first paginated range read (500/page, 20,000 docs) rather than a
query per student; the newest-first order means a truncated window keeps the
most recent records. The Live monitor no longer lists students — it shows the
day's totals and the routes, and a route opens that bus's sheet.

**The Off column is the run's order, and it belongs to the bus sheet.** Inside
`BusOverviewModal` the students are numbered 1, 2, 3 … in the order they came
off that bus — the number restarts per bus, because the sheet is scoped to one
bus, and "who came off first" is a question about that bus. The last numbered
row carries a stronger rule so the sequence visibly ends; everyone after it is
still on board, absent, or has no record.

**"Waiting" is not a status any more — it is the absence of one.** A child on
today's sheet that nobody has recorded anything about is still a `WAITING`
document in Firestore (the value is kept so records written earlier stay
readable), but the word never reaches a user:

- the director sees those children only as the **unaccounted** count
  (waiting + absent), and as a neutral chip reading `Unaccounted` where an
  individual row must say something (`STATUS_META.WAITING` /
  `DASH_STATUS_META.WAITING` are neutral — never the amber `--color-waiting`);
- the driver's pill reads **"Board"** (`mobile.markBoarded`) — the action, not a
  state — and carries a control edge (white fill, `--color-control-outline`
  border) while the settled states stay flat and tinted, so weight alone says
  "still needs a tap"; the tint stays neutral, never the amber
  `--color-waiting`, and the manifest rail tick under `TopAppBar` is neutral too;
- the pill guards a second press for 350 ms (`STATUS_TAP_GUARD_MS`): the cycle
  is WAITING → BOARDED → DROPPED_OFF, so an accidental double tap would record
  a child as off the bus;
- no filter, tab, chip rail or KPI cell offers it. `TABS` and `CHIPS` are the
  states people act on.

Do not re-introduce the word, and do not give the neutral state a status hue:
the whole point is that a child with no record must not read as a warning next
to a child who is actually absent.

**Zebra tables are one utility.** Every table renders
`className="table-zebra"` (`globals.css`): even rows take one tone step and the
1px row rule is removed inside a striped table, because a stripe and a rule are
two encodings of the same thing. Do not hand-roll stripes, and do not add zebra
to the phone card lists (they are `divide-y` lists, not tables).

**A sheet import is read, matched, then written — in that order.**
`src/lib/sheet-import.ts` parses CSV and XLSX **without a dependency** (XLSX is
a zip: `DecompressionStream("deflate-raw")` plus `DOMParser` over
`xl/worksheets/sheet1.xml` and `sharedStrings.xml`), so the import adds nothing
to the bundle and works offline. `guessColumns` matches the school's own
headers to Student name / Class / Bus; `buildAssignmentPlan` then decides, per
row, whether it **corrects** a child (class and/or bus), **creates** one, or is
reported as not applied; and only then does `applyAssignmentPlan` write, in
batches of ≤400, each correction carrying only the fields it actually changes.

**The import is how a school's whole roster arrives, so these rules matter:**

- **A name that matches no child becomes one.** Before this, a sheet could only
  re-point children who already existed, which meant a real school had no way
  in. A new child needs a **class**, because a class is the fact that puts them
  on a class card — a row without one is reported, never half-created.
- **The name is the key and the class is the tie-break.** The plan prefers the
  matching child who is already in that class, and dedupes creations by
  (name, class), so two children who share a name stay two children while a
  duplicated row cannot invent a twin. The last row still wins per child.
- **Class spellings are folded, not compared** (`classKey`): case, spacing,
  punctuation and the leading `Class` / `Grade` / `Classe` / `Niveau` / `الصف`
  word are noise, so a sheet written today (`Class 4A`) lands in the class the
  roster still spells `Grade 4A`. A class nobody is in yet is flagged **new** in
  the preview, because that is a decision, not a detail.
- **A bus the school does not have is never guessed**: that row is reported.
- **The preview is the guard**, since a name is the only key. It names the
  children to be created and the rows that will not be applied, beside the class
  tallies — a typo shows up as a second child *before* anything is written.
- **Creating needs `can('students')`**, not the directorship: a secretary runs
  the roster. An operator holding Assignments but not Students still imports bus
  moves; the dialog says what it cannot write and omits exactly that half.

The dialog shows the mapping and a preview before anything is written; nothing
is guessed at apply time — unmatched rows are reported, not dropped. The drop target itself is a
**disclosure, closed by default, capped at `max-w-xl`** — the cap is on the
**card**, so the summary row and the drop target share one width instead of a
page-wide band with a small box inside: importing is a
once-a-term job, and a page-wide drop zone pushed the roster (the screen's
actual job) below the fold. Its summary row keeps the chosen file's name, so a
read sheet is never hidden behind a collapsed panel.

**A dropdown over data grows a search field.** `@uiarc/dropdown-menu` already
renders a sticky filter field; pass
`searchable={{ placeholder: t("dropdown.searchPlaceholder"), emptyLabel: t("dropdown.searchEmpty") }}`
on every value selector whose options come from Firestore — classes, buses,
drivers — once it has **four or more** real options (a leading
"all / no bus" reset row does not count). Below that, keep the plain menu: a
field over three rows is noise. Sort and action menus never get it.

**The Assignments student list is filtered, not just searched.** Bus and class
dropdowns sit beside the search field, both reset by one clear action, with a
"X of Y students" line while narrowed; the page reset key includes the search
and both filters so narrowing lands on page 1, while a live change to the rows
alone does not.

**A bus move shows its own answer, not a re-read.** `students` is a one-shot
cursor page, so after `assignStudentToBus` the page keeps an override
(`busOverrides[studentId]`) that both the trigger label and the `checked` flags
read. An immediate `getDocs` can return the pre-write document, which is what
made a saved move snap back to the old bus — so a single move never re-reads.
The override is dropped when the list does re-read (a sheet import), and the
per-bus counts keep their own `countsVersion` so the totals still refresh.

**Looping decoration is a closed list.** One thing animates on a loop by
design: the route sweep on the live monitor (`.route-flow` in `globals.css`).
Every other animation is a response to an event and stops. The sweep and the
theme flip both vanish under `prefers-reduced-motion`.

**Charts are designs, not data.** The Analytics modal's per-bus section renders
`arc/bar-chart` or `arc/donut-chart` over the *same* completed-trips-per-bus
series (`completedByBus`), switched by a `SlideSegments` labelled
`analytics.chartDesign`. Never let a design switch change the measure — two
designs that show different numbers are a bug, not a feature. The donut's parts
are buses, not statuses, so it takes a single-hue `color-mix` ramp rather than the
status `--series-*` palette (where red means "absent").

## The tour, the guidebook and the hover hints

Three ways to answer "what is this?", sharing one rule: **content is derived from
permissions, never written per role.**

- **The tour** (`src/lib/tour.ts`, `components/dashboard/Tour.tsx`) walks a
  director across the dashboard: Live monitor → Students → Reports →
  Assignments → Drivers → Operators → the guidebook. One step lights one real
  control — a 2px accent stroke on the control's own edge, plus a card beside
  it. It is non-modal on purpose (`aria-modal="false"`, no focus trap, no
  dimming): the page stays usable. A step declares its `path` and a
  `[data-tour="…"]` selector; the tour navigates there, polls ~1.2s for the
  control (route chunk + first snapshot), then places the ring. **The loaded
  profile is passed into `Tour` from the host, never re-read with
  `useUserProfile()` inside it** — a fresh hook mount starts at
  `EMPTY_PROFILE`, so computing the steps on that first render dropped every
  `screen`-gated step and left the tour two cards long. That shipped once. A control that
  never appears (a screen with no data, a rail control behind a closed drawer on
  a phone) centres the card rather than pointing at nothing. The list is frozen
  when the tour opens and filtered by **capability**, not by what is in the DOM —
  steps on other screens are not mounted yet. Tour-driven navigation is exempt
  from the "navigating ends the tour" rule; a link the reader clicks still ends
  it.
- **Asked once, replayable for ever.** `src/lib/tour-seen.ts` keeps one
  `localStorage` key per UID, versioned. The invitation (`TourInvite`) is shown
  once on `/dashboard` and both answers set the flag; **Skip**, Escape, **Done**
  and leaving the page all end it. Replay has three permanent doors: the rail
  footer row **above Guidebook** (`data-tour="replay"`, which the closing card
  points at), the Help dialog, and the guidebook's own button. Replay marks the
  flag too, so the invitation never returns because the tour was replayed before
  it was answered. Navigating YOURSELF while the tour is open closes it; the
  tour's own moves between screens do not.
- **The guidebook** (`src/lib/guide.ts`, `routes/GuidePage.tsx`,
  `components/guide/GuideMap.tsx`) is `/dashboard/guide`, reached from the rail
  footer. `guideContents(profile, mainDirector)` splits pages into `mine` and
  `locked` with the same `canOpenScreen` the route guards use — a reader who
  cannot open a screen still sees its page listed under "Not yours to open",
  because "that is somebody else's screen" is half the answer a manual gives.
  The section is `?s=<id>`, not a path segment: the shell keys `<main>` on
  `pathname`, so a segment would remount and re-animate the rail on every click.
- **Every miniature is drawn, never captured.** `GuideMap` is markup in the
  dashboard's own tokens, so it follows `.dark` and `dir="rtl"` and cannot go
  stale. Pins are rendered *inside* the control they name and the article's
  numbered steps carry the same numbers; that is the contract between the
  drawing and the copy. The stage is `aria-hidden` — the steps are the content.
- **Hover hints** (`src/lib/hints.ts`, `components/HoverHint.tsx`) are the
  three-second rest: `data-hint="<id>"` on a control, one title and one sentence
  from the dictionaries. One document-level listener, innermost annotated
  element wins, so a KPI cell inside the summary answers for itself. Mouse and
  keyboard focus both arm the same timer; **touch never** (`(hover: hover) and
  (pointer: fine)`). Any scroll, click or Escape dismisses it, and it is wired to
  its control with `aria-describedby` while it is up.

Adding a screen? Add one `GUIDE_SECTIONS` entry (`titleKey` reuses the nav key,
plus a TL;DR, a caption, three steps and two words in **both** dictionaries), and
a `GuideMap` case. Adding a control worth explaining? Add the attribute and, for
a hint, an id in `HINT_IDS` plus its two keys. `data-tour` / `data-hint` are on
real elements only — a hint whose id is unknown is ignored, and a tour step
whose control never appears is shown centred instead of pointing at nothing.

## The activity log

`schools/{schoolId}/audit` is the record of what was changed and by whom, and
`/dashboard/activity` is the only reader. Two writers, and the rules keep their
guarantees apart:

- **The Admin SDK** (`logAudit` in the API) writes account and sign-in events.
  Evidence: verified token, server clock.
- **The browser** appends roll, assignment and settings entries *in the same
  atomic batch as the change*. The rules pin `actorUid` to the caller, `at` to
  `request.time`, the vocabulary to a role-scoped allowlist, and refuse
  update/delete. It cannot lie about who or when; its `changes` values are
  unverified — a claim, not evidence. Both halves say which they are on screen.
- **The records carry their own provenance.** `stamped()` in the rules refuses
  any write to `attendance`, `runs`, `students`, `buses` or `schools/{id}`
  without `updatedBy == request.auth.uid` and `updatedAt == request.time`. This
  is the half that cannot be skipped, so a new write path MUST set both.

Adding an event means: a name in `AuditEvent` (`src/lib/audit.ts`), a family in
`EVENT_FAMILY`, a sentence key in `EVENT_LABEL_KEY` **and both dictionaries**,
the matching entry in `auditEventAllowed()` in `firestore.rules`, and — if it is
a client event — one `queueAudit(...)` in the batch that makes the change.
Never store a sentence (the UI builds it in both languages), never store a
child's name (resolve the id against `students`), and never put a code, password
or token in an entry. Retention is `AUDIT_RETENTION_DAYS` + a TTL policy on
`expiresAt`; entries are immutable by design, so there is no delete path to add.

## Deploying

Firebase Hosting serves `dist/`. `firebase.json` also carries the security
headers that used to live in `next.config.ts` and the SPA rewrite
(`**` → `/index.html`) that React Router needs.

```bash
npm run deploy          # build + deploy hosting
npm run deploy:rules    # firestore rules
npm run deploy:indexes  # firestore indexes
```

Project is pinned by the committed `.firebaserc` (`school-bus-a4f23`). The Firebase
CLI is not a dependency — run it with `npx firebase-tools@latest …`.

### Hosting is live; the API is not

The web app is on Hosting. The **backend is not**: the project is on Spark, so
Cloud Run refuses a deploy (`BILLING_DISABLED`) and the API runs locally. The
hosted app's `/v1/**` calls therefore answer **503**, and sign-in on the deployed
site cannot work until the API is hosted. Everything below is still the correct
target — the rewrites are already in place so that a running revision makes the
app same-origin with no client change.

Also: the three deploy scripts call `npx --yes firebase-tools@latest`. They used
to call a bare `firebase` binary that does not exist here, so `npm run deploy`
rebuilt the bundle and then failed with `sh: firebase: not found` — and still
exited 0 through a `| tail`, which is how hosting silently fell releases behind.

### Production is same-origin — read this before touching API URLs

`firebase.json` rewrites `/v1/**` and `/health` to the **Cloud Run** service
`school-bus-api` (us-central1), and `.env.production` sets `VITE_API_URL=` to
**empty**, meaning "same origin". So the browser never makes a cross-origin call
and there is no CORS preflight in production at all.

- The rewrites **must stay above** the `**` SPA catch-all; Hosting matches in
  order and the first hit wins. Move them below and every API call silently
  returns `index.html`.
- `.env.production` is committed on purpose (it holds no secrets — the Firebase
  web config is public and stays in the gitignored `.env.local`). It exists to
  **override** `.env.local`, which Vite also loads during production builds. Drop
  it and a deploy bakes `http://localhost:8080` into the bundle, breaking sign-in
  for every real user.
- `VITE_API_URL` is tri-state in `src/lib/api.ts`: a URL = other origin (dev),
  **empty** = same-origin (prod), **unset** = misconfiguration that fails loudly.
  Don't collapse that to a truthiness check — it's what catches a missing var in
  dev, where a silent same-origin fallback would hit the Vite dev server instead
  of the API.

The API itself is documented in the other repo — see its README for the Cloud Run
deploy command, the ADC/role setup, and the four cost controls that keep it at $0.

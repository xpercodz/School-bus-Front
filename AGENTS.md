# Agent notes — School-bus-Front (frontend)

This repository is the **web client only** (Vite + React 19 + React Router SPA).
The privileged backend is a **separate repository** at `../School-bus-API`
(Hono on Node 22). They are independent git repos with independent deploys.

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

**Precache size — read this before "optimising" it.** It is ~1.99 MiB, and the
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
vietnamese and latin-ext for IBM Plex Sans that an en/ar UI never renders — but
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
    i18n/                   typed en/ar dictionaries, LocaleProvider, Intl formatting
public/icons/               generated PWA/apple-touch icons (see "Offline")
public/fonts/               generated Material Symbols subset (see "Conventions")
scripts/build-icon-font.mjs regenerates the icon subset (run when icons change)
scripts/offline-smoke.mjs   headless-Chrome offline regression test
```

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
`pagination`, `theme-switch`, `icon-morph`, `otp-input`, `user-menu` and the
`bar-chart` / `donut-chart` / `slope-chart` family:

- **Tokens.** They read a generic surface (`--foreground`, `--surface`,
  `--accent`, `--radius-control`, `--duration-*`) that this app does not have.
  `src/components/arc/arc-tokens.css` maps every name onto our `--color-*` tokens
  **by reference**, so a palette change or a `.dark` flip needs no edit there.
  Never restyle the vendored `.module.css` files to fix a colour — change the
  mapping, or pass a `color` prop where the API offers one.
- **Patches.** Edits to the vendored source are listed in
  `src/components/arc/PATCHES.md` with the reason. `shadcn add --overwrite`
  reverts them silently, so re-read that file after any re-install.
- **Strings.** The components ship English defaults. Anything user-facing must
  come from `t()` in both dictionaries; where a string is not reachable as a
  prop it is patched (see PATCHES.md), never left in English.
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
  `src/lib/i18n/dictionaries/en.ts` (which defines the `Messages` type) and
  `ar.ts`, then resolve via `t()`. Both languages must stay complete.
- `src/data/` holds types and presentation config (statuses, KPI ids, nav items).
  No data lives there.
- Material Symbols Rounded/Outlined is **self-hosted as a subset** in
  `public/fonts/` — there is no CDN and no runtime external asset load left. Those
  `.woff2` files are build artifacts: `scripts/build-icon-font.mjs` scans the source
  for `<Icon name="…">` and for **any property ending in `Icon`** (`icon:`,
  `footerIcon:`, …), then asks the Google Fonts API for only those glyphs (~111 KiB
  for both families, versus **5.2 MiB per family** for the full font). **Re-run it
  whenever an icon is added or removed** — a glyph missing from the subset renders
  as its literal ligature name, which is exactly the bug this replaced.
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
  matters too — this app is bilingual, and RTL would reverse the ligature. So the
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
the field and folds back when emptied: the roster (`SearchBar`), the Reports
roster toolbar, Assignments, the Drivers access-codes list and the bus overview
modal. They use its *filter* form (controlled `value`/`onValueChange`, no
`items`), because the page already renders the list the search narrows; passing
`items` would turn filtering into a jump-to panel. Leave `anchor="start"` so the
field grows from the leading edge in both directions, and keep the container's
width (the field never grows past it). **Inside a `Dialog`, stop Escape from
propagating out of the field** (see `BusOverviewModal`): the field collapses on
Escape and the dialog's document listener would close the whole overlay on the
same press. Filter local state, not the page's pagination or Firestore.

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

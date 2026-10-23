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

**Precache size — read this before "optimising" it.** It is ~1.70 MiB, and the
composition is not what the filenames suggest: the Firebase SDK chunk (~666 KiB,
named after whichever module Vite happened to bundle with it — currently
`motion-*` (because `src/lib/motion.ts` shares the chunk), which is misleading) and the app entry (~284 KiB) are needed
by every user, and the genuinely director-only route chunks are only ~70 KiB. The
rest is fonts — including the ~115 KiB icon subset.

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
  `footerIcon:`, …), then asks the Google Fonts API for only those glyphs (~115 KiB
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

# Agent notes — School-bus-Mobile (frontend)

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
    i18n/                   typed en/ar dictionaries, LocaleProvider, Intl formatting
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
- Material Symbols Rounded/Outlined is still loaded from the Google Fonts CDN in
  `index.html`. Self-hosting it is a tracked hardening item in
  `SECURITY_ROADMAP.md` — do not treat this as already solved.

## Deploying

Firebase Hosting serves `dist/`. `firebase.json` also carries the security
headers that used to live in `next.config.ts` and the SPA rewrite
(`**` → `/index.html`) that React Router needs.

```bash
npm run deploy          # build + deploy hosting
npm run deploy:rules    # firestore rules
npm run deploy:indexes  # firestore indexes
```

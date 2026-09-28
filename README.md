# School Bus Transit — web client

A **Vite + React 19 + React Router** single-page app with two sections:

- **`/` (mobile)** — the **Bus #04 • Morning Run** attendance roster: live status
  (Boarded / Waiting / Dropped Off / Absent), search, and status filter tabs.
- **`/dashboard` (desktop)** — the director's **School Transit Live Monitor**:
  KPI cards, active fleet grid, and a live student attendance table.

Both sections are **live-only**: they read from **Firebase** (Auth + Firestore)
and show a sign-in prompt when there's no session — there is no mock data.

This is one of **two repositories**. The privileged backend is
[`School-bus-API`](../School-bus-API) (Hono on Node 22) — see
[`APP_OVERVIEW.md`](./APP_OVERVIEW.md) for the whole architecture and
[`SECURITY.md`](./SECURITY.md) for the security model.

## Why the browser still talks to Firestore directly

The client SDK is the realtime and offline layer, and that is deliberate:

- `onSnapshot` listeners keep the roster and dashboard live without polling.
- The **persistent IndexedDB cache** (`persistentLocalCache` +
  `persistentMultipleTabManager` in `src/lib/firebase.ts`) queues attendance
  writes durably. A driver who taps "Boarded" in a dead zone does not lose the
  record — even if the app is closed before the network returns.

Everything privileged (signing in, verifying a driver code, creating a driver,
rotating a code) goes to the API instead, because those need the Firebase Admin
SDK. The split is: **Firestore for realtime data, the API for privilege.**

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the VITE_FIREBASE_* values
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app is mobile-first: it
renders as a centered phone-width column on desktop, or open it in a mobile
viewport in DevTools.

Sign-in calls the API, so **start `School-bus-API` too** (default
`http://localhost:8080`) and make sure its `APP_ORIGINS` includes
`http://localhost:5173`.

## Environment

Copy `.env.example` to `.env.local`. All `VITE_*` values are **public** — the
security model lives in Firestore rules and the API, not in hiding these.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web config (public), from the Firebase console |
| `VITE_FIREBASE_AUTH_DOMAIN` | " |
| `VITE_FIREBASE_PROJECT_ID` | " |
| `VITE_FIREBASE_STORAGE_BUCKET` | " |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | " |
| `VITE_FIREBASE_APP_ID` | " |
| `VITE_API_URL` | Base URL of `School-bus-API` (e.g. `http://localhost:8080`) |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run deploy` | Build, then `firebase deploy --only hosting` |
| `npm run deploy:rules` | Deploy Firestore security rules |
| `npm run deploy:indexes` | Deploy Firestore indexes |

## Fonts

- **Inter**, **JetBrains Mono**, **IBM Plex Sans Arabic** — self-hosted via
  `@fontsource`, imported in `src/main.tsx`. The family names are wired into the
  theme's CSS variables in `src/globals.css`.
- **Material Symbols Rounded + Outlined** — still loaded from the Google Fonts
  CDN in `index.html`. Self-hosting it is a tracked hardening item in
  [`SECURITY_ROADMAP.md`](./SECURITY_ROADMAP.md) (Tier 1).

## Deployment

Firebase Hosting serves `dist/`. `firebase.json` holds the SPA rewrite that React
Router needs and the security headers that previously lived in `next.config.ts`.

```bash
npm run deploy
```

Because the API is a different origin, the deployed API's `APP_ORIGINS` must list
every Hosting origin this app is served from (custom domain plus the
`*.web.app` / `*.firebaseapp.com` pair).

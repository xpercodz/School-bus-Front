# APP_OVERVIEW — School Bus Transit

School bus attendance and transit monitoring. Two independent repositories, one
product: a **Vite + React SPA** (this repo) with two sections — a **mobile-first**
attendance roster (bus monitors) and a **desktop dashboard** (the school
director) — and a **Hono HTTP API** (`../School-bus-API`) that owns every
privileged, Admin-SDK operation. This is the canonical architecture document for
this repo — keep it accurate as the project evolves.

## Two repositories

The former single Next.js app was split into two independent git repos with
independent deploys. The boundary is deliberate, not incidental.

**`School-bus-Mobile` (this repo) — the web client.**
Vite 8 + React 19 + React Router 7 SPA (TypeScript, Tailwind v4 via
`@tailwindcss/vite`). Next.js is **gone entirely** — no Next dependency, no
`src/app/` directory, no server, no route handlers. Deployed as static files to
**Firebase Hosting**. It still talks **directly to Firestore with the Firebase
client SDK**, and that is load-bearing:

- the roster and dashboard are **realtime** (`onSnapshot` listeners — a status
  tap on one device appears on the director's screen without a refresh), and
- drivers run routes through **flaky or dead mobile networks**, so attendance
  writes must be **durable offline**: Firestore is initialized with
  `persistentLocalCache` + `persistentMultipleTabManager` (a persistent IndexedDB
  cache), so a "Boarded" tap in a dead zone is queued and replayed on reconnect
  and **survives a reload** rather than living in a memory cache that a refresh
  discards.

Putting a server in front of those reads/writes would mean re-implementing
realtime delivery and an offline write queue by hand. Keeping the client SDK on
the data path keeps both for free — so Firestore reads and attendance/roster
writes stay in the browser.

**`School-bus-API` (separate repo) — the privileged backend.**
Hono 4 on Node 22, bundled by tsup into a single ESM file and run with
`node dist/index.js` (dev: `tsx watch src/index.ts`). It exists because some
operations categorically **cannot** be done from the Firebase client SDK:
Firebase Auth users and `users` profiles are Admin-SDK-only, and the code hashing
pepper must never reach a browser. It owns:

- director email/password sign-in,
- driver access-code verification,
- driver account creation,
- driver code rotation.

It also now owns `scripts/seed.mjs` and `scripts/clear-data.mjs` (they use
service-account credentials and create Auth users, which is exactly the
privileged class of work this repo must not do). `firebase-admin` is no longer a
dependency of this repo.

**The split rule:** Firestore client SDK for realtime and offline; the API for
anything privileged. If a change seems to need a new Firestore read on a
privileged collection, that is the signal the endpoint belongs in the API repo.

## Stack

- **Framework:** Vite 8 + React 19 + React Router 7 (SPA, TypeScript). No SSR:
  every route renders in the browser and Hosting rewrites unknown paths to
  `index.html`.
- **Styling:** Tailwind CSS v4 (CSS-first config in `src/globals.css`, wired
  through the `@tailwindcss/vite` plugin).
- **Fonts:** Inter + JetBrains Mono + IBM Plex Sans Arabic, **self-hosted** via
  `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, and
  `@fontsource/ibm-plex-sans-arabic` (400/500/600/700), imported in
  `src/main.tsx` in place of `next/font/google`. The theme's `--font-inter`,
  `--font-arabic`, and `--font-jetbrains` variables are unchanged; they are now
  declared in a `:root` block in `src/globals.css`. Material Symbols Rounded +
  Outlined is **still loaded from the Google Fonts CDN** via a `<link>` in
  `index.html` — self-hosting it remains a tracked hardening item.
- **Data:** **Firebase** — Auth (email/password + custom tokens) + Cloud
  Firestore, used directly from the browser. Web-app config comes from
  `.env.local` (`VITE_FIREBASE_*`, see `.env.example`), client SDK init in
  `src/lib/firebase.ts`. **Live data only** — there is no mock fallback: until
  `isFirebaseConfigured` is true, and without a session, the mobile screen shows
  a sign-in prompt and the dashboard is role-guarded.
- **Backend:** `VITE_API_URL` points at the separate `School-bus-API` server
  (dev default `http://localhost:8080`); the typed client is `src/lib/api.ts`.
  See "HTTP API surface" below.
- **i18n:** lightweight custom layer in `src/lib/i18n/` — typed `en`/`ar`
  dictionaries, a client `LocaleProvider`, and `Intl`-based formatting. English
  default, Arabic via a UI toggle, persisted in a `locale` cookie. See
  "Internationalization" below.

## HTTP API surface

The browser calls the API cross-origin with `fetch`; nothing goes through a dev
proxy, so local development exercises the same CORS path production does.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. Deliberately does not touch Firebase, so the server reports healthy before credentials are mounted. |
| `POST` | `/v1/auth/director-sign-in` | Director email/password → Firebase custom token. |
| `POST` | `/v1/auth/verify-code` | Driver 6-digit code → Firebase custom token. |
| `POST` | `/v1/drivers` | Create a driver account (director Bearer token). |
| `POST` | `/v1/drivers/regenerate` | Rotate a driver's access code (director Bearer token). |

**Server structure** (`School-bus-API/src/`): `index.ts` (bootstrap: builds the
app and serves it), `app.ts` (the Hono app — request logger, `secureHeaders`,
CORS allowlist, `/health`, `notFound`, and a generic 500 error handler that never
surfaces an internal message), `routes/` (the four handlers plus `index.ts`
wiring), `middleware/security.ts`, `lib/driver-admin.ts` (`requireDirector`,
`createDriver`, `rotateCode`, `logAudit`, HMAC-SHA256 code hashing with
`CODE_PEPPER`), `firebase-admin.ts` (lazy Admin SDK init), `env.ts` (the only
place `process.env` is read), and `contract.ts`.

**Security middleware order** — the guards that used to be inline in the Next.js
route handlers were preserved exactly and are now route middleware, applied to
the two auth routes in this order (registration order is load-bearing):

1. `uniformDelay` — a constant ~400 ms delay on success **and** failure, so
   response time cannot distinguish "no such code" from "wrong role". It runs
   first, so even a rejected or rate-limited request pays it.
2. `originGuard` — rejects a mismatched `Origin` (CSRF), while allowing a missing
   `Origin` for same-origin form/curl callers.
3. `rateLimit` — per-IP sliding-window throttle.

Body parsing happens **inside** the handler, after the delay, so even a malformed
body costs the same wall-clock time. The two driver routes carry no delay or
throttle: they authenticate with a director Bearer ID token, not a guessable
6-digit code.

**Error codes.** Responses are `{ "error": "<code>" }` with **machine codes**
rather than prose messages, so clients branch on a stable identifier:
`invalid_request`, `invalid_credentials`, `invalid_code`, `not_director`,
`too_many_attempts`, `rate_limited`, `invalid_name`, `invalid_uid`,
`missing_token`, `invalid_token`, `forbidden`, `not_found`, `server_error`.

**The contract is mirrored on purpose.** `School-bus-API/src/contract.ts` is the
**source of truth** (paths, Zod request schemas, response shapes, error codes);
`src/lib/api-contract.ts` in this repo is a **hand-kept mirror**. The repos are
independent, so nothing enforces agreement at build time — a path, shape, or error
code change must be made in both files in the same sitting. If the contract
outgrows a handful of endpoints it should be published as a private package
rather than mirrored.

**Client:** `src/lib/api.ts` is the only place the browser talks to the API. It
exports `verifyDriverCode`, `directorSignIn`, `createDriver`,
`regenerateDriverCode`, and an `ApiError` class carrying `status` + `code` (a
transport failure becomes `status: 0` with a client-side `network_error`,
`not_signed_in`, or `not_configured`). Authenticated calls attach the signed-in
user's Firebase ID token as a Bearer credential.

**API environment:** `PORT`, `HOST`, `NODE_ENV`, `APP_ORIGINS` (comma-separated
browser-origin allowlist; dev default `http://localhost:5173`),
`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`,
`CODE_PEPPER`. The old `NEXT_PUBLIC_FIREBASE_PROJECT_ID` became
`FIREBASE_PROJECT_ID` in both scripts. Admin SDK init is now **lazy**, so the
server boots and answers `/health` before credentials are mounted.

## Routing

```
/                      PhoneShell       — phone-column roster (per-driver morning run)
/login                 LoginPage        — driver access code, or director email/password
/dashboard             DashboardPage    — director "School Transit Live Monitor"
/dashboard/reports     ReportsPage      — printable attendance summary (CSV + print),
                                          with an Analytics modal (per-bus rates +
                                          multi-day trend)
/dashboard/assignments AssignmentsPage  — director-only driver↔bus and student↔bus links
/dashboard/drivers     DriversPage      — director-only driver accounts + access codes
```

Routes live in `src/routes/`, one file per screen: `MobilePage.tsx` (`/`),
`LoginPage.tsx`, `DashboardPage.tsx`, `ReportsPage.tsx`, `AssignmentsPage.tsx`,
`DriversPage.tsx`, plus `PhoneShell.tsx` — the phone-column layout that used to be
`(mobile)/layout.tsx`. The route table itself is `src/App.tsx`
(`BrowserRouter`); `src/main.tsx` is the entry point (fonts + `globals.css` +
`<App/>`).

`/dashboard/analytics` was a standalone statistics page; Analytics now lives as a
modal inside Reports, and the old URL is a React Router
`<Navigate to="/dashboard/reports" replace />` (formerly a `next.config.ts`
redirect). Unknown paths land on `/`.

**Code splitting.** The four dashboard pages are `React.lazy` imports wrapped in
`Suspense`, with `RouteFallback` + the matching `DashboardSkeletons` component as
the fallback — this replaces the removed `loading.tsx` files, pairing each lazy
route with the same skeleton the page shows while its query is in flight.

**App shell.** `src/providers.tsx` wraps the tree in `LocaleProvider` →
`AuthProvider` (`src/lib/auth.tsx`) → `ToastProvider`, plus the boot loader.
There is no root server layout, so per-route `document.title` and the
`<meta name="description">` are set client-side by a `DocumentMeta` component in
`src/App.tsx` (replacing `generateMetadata`): the dashboard area gets the
dashboard title, `/login` the root meta, everything else the mobile title.

**Role-based access:** after login, `staff` (bus monitor/driver) lands on `/`,
`director` on `/dashboard`. The dashboard is wrapped in `RequireRole
role="director"` (`src/components/RequireRole.tsx`) — signed-out visitors go to
`/login`, non-directors bounce back to `/`. The dashboard sidebar shows the
signed-in school's name (`src/lib/school.ts`), so each tenant sees their own.

**Two sign-in modes on `/login`:** a segmented toggle switches between **Driver
code** (default — a 6-digit access code, see "Driver access codes" below) and
**Director** (email/password, see "Director sign-in" below). Both modes are
exchanged for a custom token by the **API** before any session exists.

- `src/routes/PhoneShell.tsx` — the phone-column shell (`max-w-[480px]`,
  `sm:border-x`); `MobilePage.tsx` is the attendance screen. URL stays `/`.
- `src/routes/DashboardPage.tsx` is the Live Monitor screen, rendered inside
  `DirectorShell` (responsive `Sidebar` + sticky `TopBar` + the role guard).
- Dashboard is **responsive**: the `w-64` sidebar is a fixed rail at `≥lg`
  (1024px) and collapses into a hamburger + off-canvas drawer below it (the
  drawer reuses the shared `Dialog` `placement="end"` pattern, so focus trap /
  Escape / scroll-lock come for free). The top bar hides its brand text and
  live-clock chip on narrow screens; wide tables keep horizontal scroll.
- Sidebar nav: **Live Map** (`/dashboard`), **Reports** (`/dashboard/reports`),
  **Assignments** (`/dashboard/assignments`), and **Drivers**
  (`/dashboard/drivers`) are real routes; the active pill follows the path.
  **Fleet Status** is intentionally inert (the fleet grid already lives on the
  Live Map) and **Routes** isn't built yet.
- **Analytics** is not a route — it's a modal (`AnalyticsModal`, launched by the
  **Analytics** button in the Reports toolbar). It shows the two analysis views
  the printable report doesn't: per-bus boarded/absent **rate bars** and the
  multi-day attendance trend (`useAttendanceTrend`: paginated date-range query
  on `attendance.date`, CSS stacked-bar chart, default last 7 days, capped at
  31). It reuses the report's already-loaded bus summaries and follows its run
  segment; only the trend queries Firestore, and only while the modal is open.
- **Reports** — overview KPIs, by-bus and by-grade summary tables, the full
  roster (paginated/searchable/filterable like the Live Map table), **Export
  CSV** (reuses `src/lib/csv.ts`; exports the currently filtered rows), and
  **Print** (the sidebar + top bar are hidden on print via `print:` variants).
- **Assignments** — director-only driver↔bus and student↔bus assignment. The
  Drivers table links a staff user to each bus (one driver per bus; the write
  keeps the denormalized `driver` name in sync and clears the driver's previous
  bus atomically). The Students table is cursor-paginated (via
  `src/lib/school-admin.ts`) with a client-side name search and a per-row bus
  `<select>`.

## Mobile screen (per-driver morning run)

Faithful to the Stitch design: attendance roster with status summary chips,
student search, segmented filter tabs (All / Waiting / Boarded / Done), roster
cards per status, and a bottom bar. The roster is **per-driver** — the app bar
title and roster come from the signed-in user's bus (`buses where driverUid ==
uid`, resolved by `useDriverBus`), so every staff account sees only its own
bus. A staff user linked to no bus gets a friendly empty state instead of a
roster. The roster is **live-only** — it reads the school's current run from
Firestore and tapping a student's status pill writes the new status back;
signed out, the screen shows a sign-in prompt. The bottom bar's **Complete
Run** marks the run `COMPLETED` and any `WAITING` students `ABSENT` in one
atomic batch. Each card's "⋯" menu offers **View history** and **Mark absent**;
the top-bar "⋯" menu shows run details (bus / type / date / status) and **Sign
out**. See the git history for the original one-screen build.

Because the Firestore client uses the persistent local cache, this screen keeps
working through a dead zone: the last-known roster renders from disk and a status
tap is queued durably rather than dropped.

## Director dashboard (School Transit Live Monitor)

Faithful to the Stitch `code.html` — a **light Material 3** admin UI (the
folder's `DESIGN.md` is a stale dark "Command Center" concept and is **not**
the rendered design). One screen: the Live Monitor.

- **KPI cards** — Total Assigned / Currently Onboard (live pulse) / Safely
  Dropped Off / Marked Absent-Pending (error accent).
- **Active Fleet grid** — bus cards (route progress, In/Out/Wait counts).
- **Live Student Attendance table** — student name, grade, bus #, morning
  boarded, drop-off time, status badge, actions. The **History** action opens a
  per-student attendance sheet; **Call** is disabled (no contact numbers on file).
  The table is **paginated (10 rows/page)** with a per-list toolbar: student
  name search, a grade dropdown, and status chips (All / Boarded / Waiting /
  Dropped Off / Absent) — shared by the Live Map and Reports rosters via
  `useStudentList` + `StudentList` (`src/lib/use-student-list.ts`,
  `src/components/dashboard/StudentList.tsx`).
- **Filter bar** — date picker (re-queries the dashboard for a chosen day),
  Morning Pickup / Afternoon Drop-off segment control (filters the table, KPIs,
  and fleet), and **Export CSV** (downloads the current filtered rows — the
  shared search/grade/status filters apply).
- **Dispatch Vehicle** (sidebar) — creates a run for a chosen bus/type/date and
  pre-registers that bus's students as `WAITING`; refuses to clobber an existing
  run.
- **Top bar** — Help dialog, Settings drawer (account, language, sign out).
  Notifications stays inert.

## Driver access codes (staff sign-in)

Bus drivers are typically in their 40s–50s with no valid email, so they sign in
with a **6-digit numeric code** instead of email/password. Directors keep
email/password and manage driver accounts from the **Drivers** page
(`/dashboard/drivers`): create a driver by name → an auto-generated code is
shown **once** (copyable), with per-row reveal / copy / regenerate, and
"Generate code" for any staff account that has none.

- **Mechanism:** the code is exchanged by the API for a **Firebase custom
  token** (`POST /v1/auth/verify-code` → Admin SDK collectionGroup lookup on
  `driverCodes.codeHash` → `createCustomToken`), then the client calls
  `signInWithCustomToken`. The session stays a normal Firebase Auth session, so
  `onAuthStateChanged`, `useUserProfile`, `RequireRole`, and the rules'
  `request.auth.uid` gating all work unchanged.
- **Codes are stored hashed, not plaintext.** The doc holds
  `codeHash = HMAC-SHA256(CODE_PEPPER, code)` (hex) — `CODE_PEPPER` is a
  server-only env var (API env / hosting secret, never committed, never shipped
  to the browser). The plaintext code exists only in the API response at
  create/regenerate time (shown once, copyable). Legacy docs that still carry a
  plaintext `code` field keep displaying until they are regenerated (or the demo
  DB is re-seeded); verification only matches `codeHash`, so any legacy code
  stops working once its doc is rotated — the **Regenerate** action is the
  recovery path for lost codes.
- **Creating drivers is server-side** (`POST /v1/drivers`, director-only via a
  verified Bearer ID token): `auth.createUser` with a placeholder
  `{uuid}@drivers.invalid` email and no password, plus the staff profile and
  code doc. Regeneration (`POST /v1/drivers/regenerate`) is also server-side so
  codes stay globally unique.
- **Codes are director-only data** in `schools/{schoolId}/driverCodes/{driverUid}`
  (rules deny staff), generated with a global-uniqueness re-query. The verify
  route runs a uniform ~400ms delay on success/failure, a bounded per-IP rate
  limit, an Origin check (CSRF), and a transactional per-code
  `attempts`/`lockedUntil` counter that locks a code for 15 minutes after 10
  failed role-gate attempts; the login page adds a 5-attempt → 15-minute client
  lockout (localStorage, UX only). The login page also shows a lockout/rate-limit
  message from the API's `rate_limited` code.
- **Server modules (API repo):** `src/firebase-admin.ts` (lazy Admin SDK init,
  sharing the credential resolution the seed script uses) and
  `src/lib/driver-admin.ts` (`requireDirector`, HMAC code hashing,
  `generateUniqueCode`, `createDriver`, `rotateCode`, `logAudit`);
  `src/middleware/security.ts` holds the delay, Origin guard, rate limiter, and
  the one-line structured failure logger.

## Director sign-in (email/password)

Directors sign in with email/password on the **Director** tab of `/login`.
Like driver codes, credentials are exchanged **server-side** before a session
can exist:

- **Mechanism:** `POST /v1/auth/director-sign-in` verifies the email/password
  against Firebase Auth (identitytoolkit REST, public web API key — the API
  holds `FIREBASE_API_KEY`), then requires the account's `users/{uid}` profile to
  be `role: "director"` (fresh Admin SDK read) before minting a custom token the
  client exchanges via `signInWithCustomToken`.
- **Why:** the Director tab must never hand a session to a staff/driver
  account that happens to have email/password credentials. Previously the
  client signed in directly (`signInWithEmailAndPassword`) and role guards
  silently bounced staff to the driver app; now the server rejects the wrong
  role with `403 not_director` and the login page shows a localized message
  pointing drivers to the code tab. Session shape is unchanged — a normal
  Firebase Auth session, so `onAuthStateChanged`, `useUserProfile`,
  `RequireRole`, and rules gating all work as before.
- The route applies the same uniform ~400ms delay, bounded per-IP rate limit,
  and Origin check (CSRF) as `/v1/auth/verify-code`; Firebase Auth additionally
  throttles repeated password failures per account. Both sign-in routes log
  structured one-line failures (event + reason + ip — never credentials).

## Security hardening (recent)

- **Firestore rules** (`firebase/firestore.rules`, still in this repo because
  the client SDK is what they govern): profiles are Admin-SDK-provisioned
  only (no client `create` — a self-created profile could forge
  role/schoolId); staff writes to `runs`/`attendance` are scoped to the caller's
  own bus (`buses/{id}.driverUid`) with validated fields (`status` enums,
  `runType`, `date`); director creates of `students`/`buses` must carry core
  fields; `schools/{sid}/audit` is director-read-only, written by the Admin SDK.
- **Audit trail:** `createDriver`/`rotateCode` best-effort write
  `schools/{sid}/audit/{uuid}` events (`driver.created`,
  `driver.code_regenerated`) with the acting director's uid — codes/passwords
  never enter the log (API repo: `src/lib/driver-admin.ts` → `logAudit`).
- **HTTP headers:** the security headers that used to be sent by
  `next.config.ts` now live in `firebase.json` under `hosting.headers` and are
  served by Firebase Hosting — `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, and `Permissions-Policy`. Hosting also sets
  `Cache-Control: no-cache` on `/index.html` (so a deploy never strands clients
  on an old bundle) and immutable caching on the fingerprinted `/assets/**`.
  There is no `X-Powered-By` to disable any more — no server renders this app.
- **Other:** the `locale` cookie is `SameSite=Lax` + `Secure`; the CSV exporter
  neutralizes spreadsheet-formula injection (`=`, `+`, `-`, `@`, including
  whitespace/tab-prefixed cells); the local service-account key is chmod 600.

## Data model

### Firestore schema (multi-school, tenant-isolated)

```
users/{uid}                          { role: "director"|"staff", schoolId, email }
schools/{schoolId}                   { name }
schools/{schoolId}/students/{id}     { name, grade, busId }
schools/{schoolId}/buses/{id}        { name, driver, driverUid? }
schools/{schoolId}/driverCodes/{uid} { codeHash }  // HMAC-SHA256(CODE_PEPPER, code);
                                   // director-only; driver sign-in. Legacy docs
                                   // may still carry a plaintext { code } field.
schools/{schoolId}/runs/{id}         { busId, runType, date, status }
schools/{schoolId}/attendance/{id}   { runId, date, busId, busName, studentName,
                                       grade, status, boardedAt, droppedOffAt }
schools/{schoolId}/audit/{id}        { event, actorUid, at, detail? }
                                   // director-read-only; Admin-SDK-written
```

- **Tenant isolation:** everything lives under `schools/{schoolId}`; the rules
  only ever expose the caller's own school (`users/{uid}.schoolId`).
- **Attendance is denormalized** (a flat per-school collection, one doc per
  run+student) so both views are single-query realtime reads:
  mobile reads `where runId == X`, dashboard reads `where date == today`.
- Run ids are deterministic: `${busId}-${yyyy-mm-dd}-${runType}`.
- **Driver↔bus link lives on the bus** (`buses/{id}.driverUid` — the staff
  `users/{uid}` who drives it); `driver` is a denormalized display copy kept in
  sync on assignment. Buses are already director-writable in the rules, so
  assigning needs no rules changes. One driver per bus (enforced client-side in
  Assignments).
- **Driver access codes** live in `schools/{schoolId}/driverCodes/{driverUid}`,
  readable/writable only by that school's director (rules). Code verification
  (`/v1/auth/verify-code`) queries them via Admin SDK `collectionGroup`, which
  needs a **single-field collection-group index on `codeHash`**. Single-field
  collection-group indexes can't be deployed via `firebase/firestore.indexes.json`
  (firebase CLI rejects them) — enable it once in the Firebase console:
  Firestore → Indexes → Single Field → Collection Group, add
  `driverCodes.codeHash` ASCENDING (the missing-index error from the verify
  query links straight to the creation page). Legacy plaintext `code` docs are
  replaced on the next code rotation or demo re-seed.
- The per-student history query (`attendance` where `studentName` + order by
  `date`, `runId`) needs the composite index declared in
  `firebase/firestore.indexes.json` (deploy with `npm run deploy:indexes`).
- The Firebase config (`firebase.json`, `firebase/firestore.rules`,
  `firebase/firestore.indexes.json`) stays in **this** repo on purpose: the
  client SDK is what the rules govern, and the indexes exist to serve the
  queries this client issues.

### App data access

- `src/data/students.ts` + `src/data/dashboard.ts` — types + presentation
  config only (statuses, tabs, KPI ids, nav, run segments). No data lives here.
- `src/lib/school-data.ts` — `useRunRoster()` (mobile roster + status writes +
  `completeRun` / `markAbsent`; resolves the signed-in user's bus via an internal
  `useDriverBus`), `useDashboardData(date, segment)` (KPIs / fleet / attendance,
  filtered by run segment and re-queried by date), `useStudentHistory()`
  (paginated per-student history), and `useAttendanceTrend(start, end, segment)`
  (paginated date-range daily totals) with `summarizeByBus` / `summarizeByGrade`
  helpers. All `onSnapshot` / paginated Firestore — nothing renders without a
  live session.
- `src/lib/school-admin.ts` — director-only Assignments data: `useBuses()`
  (realtime, exposes `driverUid`), `useStaffUsers()` (the school's staff),
  `useStudentsPaginated()` (cursor-paginated + client-side search),
  `useBusStudentCounts()` (server-side per-bus counts), and the
  `assignDriverToBus` / `assignStudentToBus` write helpers.
- `src/lib/use-student-list.ts` — `useStudentList(rows)` — client-side search
  (name) + grade + status filters and table-view pagination (10/page) over an
  already-loaded row set. Powers the shared `StudentList` component used by the
  Live Map and Reports rosters.
- `src/lib/csv.ts` — attendance CSV export (`buildAttendanceCsv` / `downloadCsv`).
- `src/lib/api.ts` — the only backend call site (typed client + `ApiError`).
- **Data scripts no longer live here.** `scripts/seed.mjs` and
  `scripts/clear-data.mjs` moved to `School-bus-API/scripts/` — they need
  service-account credentials and create Auth users, so they belong with the
  other privileged operations. Run them from the API repo: `npm run seed` /
  `npm run clear-data`. The seed is a one-time bootstrap (Admin SDK): it creates
  a **director** and two **staff** (bus monitor/driver) users + profiles (linked
  to bus04 and bus01 via `buses.driverUid`), a demo school, 4 buses, 32 students,
  and today's morning runs with attendance. Idempotent — safe to re-run.
  Env-overridable (`DIRECTOR_*`, `STAFF_*`, `MONITOR2_*`, `SCHOOL_ID`).
  Passwords fail closed (no well-known defaults unless `--demo` /
  `ALLOW_DEMO_DEFAULTS=1`), codes are stored hashed, and `CODE_PEPPER` is read
  from the env or `.env.local` (plain node doesn't auto-load it). `clear-data.mjs`
  wipes the seeded demo data (schools subtree; pass `--users` to also remove the
  demo accounts).

## Internationalization

English is the default UI language; a manual toggle switches to Arabic (for
drivers who don't read English). Lightweight custom layer — **no routing
changes, no third-party i18n library**, and no server pass at all in a SPA.

- **Locale core** (`src/lib/i18n/`): typed `en`/`ar` dictionaries
  (`dictionaries/*.ts`, key set derived from `en.ts` as `Messages`), a client
  `LocaleProvider` + `useLocale()` (`context.tsx`) exposing
  `{ locale, setLocale, dir, t }`, and `Intl`-based formatting (`format.ts`:
  `formatTime`, `toLocaleDigits`, `localizeTimeString`, `translateDataLabel`).
  `config.ts` also owns the supported-locale list, `LOCALE_DIR`, and the cookie
  name.
- **Persistence:** the choice lives in a `locale` cookie (`path=/`). Since there
  is no server render, `readLocaleCookie()` in `src/lib/i18n/config.ts` reads
  `document.cookie` synchronously and `App.tsx` passes the result into
  `LocaleProvider` **before first render** — that is what keeps an Arabic user
  from seeing a flash of LTR English (the old root server layout did it in SSR).
  The provider writes the cookie on toggle. No localStorage.
- **Document metadata:** per-route `document.title` / description are set by the
  `DocumentMeta` component in `App.tsx`, replacing `generateMetadata`.
- **Arabic numerals:** Arabic mode uses Eastern Arabic digits (٠١٢٣) — `Intl`
  via `ar-EG` for times (with Arabic `ص`/`م`), `toLocaleDigits` for counts, bus
  numbers, and grade suffixes.
- **RTL:** `dir="rtl"` flips the layout. Components use Tailwind logical
  utilities (`start-*`/`end-*`/`ms-*`/`ps-*`/`text-start`/`border-e`), so the
  dashboard's fixed sidebar moves to the right and text right-aligns. Arrow-key
  navigation in the segmented controls (tabs, run-type) is direction-aware.
- **Fonts:** Inter (Latin) + IBM Plex Sans Arabic share one `--font-sans` stack
  in `globals.css`; unicode-range serves Arabic glyphs from the Arabic font. Both
  now come from self-hosted `@fontsource` packages rather than `next/font`.
- **Toggle:** `src/components/LanguageToggle.tsx` — shown on login (so drivers
  can switch before signing in), the mobile top bar, and the dashboard top bar.
- **Not translated:** proper nouns — student/driver names, bus number suffixes,
  grade codes, and the product brands (`Fleet Ops`, `TransitFlow Monitor`).

## UI system

Material 3 light for both sections. Tokens live in the `@theme` block of
`src/globals.css`:

- **Mobile palette** — `surface`/`on-surface`/`primary`/`success`/`waiting`/
  `error` (Material Utility tokens, per the mobile `DESIGN.md`).
- **Dashboard palette** — fully namespaced `--color-dash-*` (values per the
  dashboard `code.html`). Deliberately **not** shared with the mobile palette:
  several values look alike but differ (`surface-container`, `on-surface`,
  `primary-container`, `success`, `error`), and scoping means a mobile token
  change can never bleed into `/dashboard`.
- Type scale: mobile `headline-md`/`body-lg`/`body-md`/`label-lg`; dashboard
  `dash-metric-xl` (JetBrains Mono, for numbers) + `dash-headline-lg`/
  `dash-label-md`/`dash-body-sm`.
- **Icons:** `src/components/Icon.tsx` takes a `variant` prop —
  `"rounded"` (filled, mobile) or `"outlined"` (line, dashboard). Both font
  families are loaded from the CDN — the one remaining CDN font.
- **Skeletons:** shared loading placeholders — base `Skeleton` /
  `SkeletonText` / `SkeletonCircle` in `src/components/Skeleton.tsx`, composed
  into screen shapes in `src/components/dashboard/DashboardSkeletons.tsx`
  (KPI grid, fleet grid, tables, trend) and `src/components/RosterSkeleton.tsx`
  (roster + history list). Each skeleton mirrors the exact layout of the content
  it replaces; screens swap it in while live data loads (`role="status"`), and
  the lazy dashboard routes use them as their `Suspense` fallback via
  `RouteFallback`.

## Layout

- **Mobile:** centered phone column (`max-w-[480px]`, `sm:border-x`) with
  sticky top app bar and bottom bar, from `src/routes/PhoneShell.tsx`.
- **Dashboard:** `w-64` sidebar + `lg:ms-64` main with a sticky top bar and
  sticky filter bar (`sticky top-0` / `top-16`); below `lg` the sidebar becomes
  a drawer and the main margin collapses (`ms-0`). Document scrolls normally —
  do not convert the shell to an `h-screen overflow-hidden` flex (it breaks the
  sticky offsets).

## Deployment

**Nothing is deployed yet.** The two repos build and deploy independently.

### Frontend (this repo) — Firebase Hosting

- `npm run dev` — Vite dev server on port **5173** (the API's default allowed
  origin). The API is a separate origin and is called directly via
  `VITE_API_URL`; there is no dev proxy, so local development exercises the same
  CORS path production does.
- `npm run build` — `tsc --noEmit && vite build`, emitting static files to
  `dist/`.
- `npm run preview` — serve the built bundle locally.
- `npm run typecheck` (`tsc --noEmit`) and `npm run lint` (ESLint).
- `npm run deploy` — build, then `firebase deploy --only hosting`.
- `npm run deploy:rules` / `npm run deploy:indexes` — push
  `firebase/firestore.rules` / `firebase/firestore.indexes.json`.
- `firebase.json` sets `hosting.public` to `dist`, rewrites `**` →
  `/index.html` (React Router owns every path, so any URL that is not a real
  file must serve the app shell), and carries the security headers that used to
  live in `next.config.ts`.

Configuration: copy `.env.example` to `.env.local` and fill in `VITE_FIREBASE_*`
(public client keys by design — the security model lives in Firestore rules and
the API) plus `VITE_API_URL`.

Firebase lifecycle (one-time + per-change):

- Seed the director user + demo data by running `npm run seed` **in
  `School-bus-API`** (needs a service-account key at `service-account.json` or
  `FIREBASE_SERVICE_ACCOUNT`; needs `CODE_PEPPER` set or in `.env.local`; real
  passwords via env unless `--demo`). After the hashed-code change, re-seed (or
  regenerate each demo driver's code once) so every `driverCodes` doc stores
  `codeHash`.
- `npm run deploy:rules` — push the rules (after any rules edit). The rules deny
  client profile creation and scope staff writes to their own bus — smoke-test
  staff/director flows on staging first.
- `npm run deploy:indexes` — push the indexes (required for the per-student
  history query; the `driverCodes.codeHash` collection-group index is
  console-only).

### Backend (`School-bus-API`) — standalone Node server

- `npm run dev` — `tsx watch src/index.ts`; `npm run build` — `tsup` bundles
  `src/index.ts` to a single ESM file in `dist/`; `npm start` — `node
  dist/index.js`. There is no hosting decision recorded yet.
- Set `APP_ORIGINS` to every browser origin that serves the web app (in
  production the Firebase Hosting custom domain plus the `*.web.app` /
  `*.firebaseapp.com` pair), and keep `CODE_PEPPER` identical to the value the
  seed script hashed with or no existing code will verify.

### Known limitations (keep these honest)

- **The API rate limiter is in-memory and per-instance.** It must move to
  Redis (or another shared store) before running more than one API instance or
  going serverless; today it resets on restart and each instance counts alone.
- **`X-Forwarded-For` is only trustworthy** if the reverse proxy in front of the
  API is the sole hop appending it — a client that can inject its own header can
  spoof a fresh IP per request and slip past the throttle.
- **Contract drift is not enforced by any build step.** The two contract files
  are kept in sync by hand (see "HTTP API surface").
- **The Material Symbols icon font is still CDN-loaded** from Google Fonts,
  unlike the text fonts; self-hosting it is a tracked hardening item.
- **Per-tenant onboarding** (creating a school + its **director** from a
  meeting) is done via the seed script rather than a UI. Driver accounts now have
  a full UI (create + codes on `/dashboard/drivers`); only brand-new
  schools/directors still need the seed script.

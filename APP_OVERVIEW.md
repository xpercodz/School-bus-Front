# APP_OVERVIEW — School Bus Transit

A school's bus operation, in two halves: a **phone roster the driver taps at the
bus door**, and a **desktop dashboard where the school's office answers "is
everyone accounted for?"** — plus the two independent repositories that serve
them. This is the canonical document for this repo: what the product is, how it
is structured, and how to run it. Keep it accurate as the project evolves.

**Contents**

1. [What this is](#1-what-this-is)
2. [Who uses it](#2-who-uses-it)
3. [The screens](#3-the-screens)
4. [The data](#4-the-data)
5. [How a day works](#5-how-a-day-works)
6. [The system](#6-the-system)
7. [Running and deploying](#7-running-and-deploying)
8. [Known limitations](#8-known-limitations)
- [Appendix — the Next.js split (history)](#appendix--the-nextjs-split-history)

## Which repository is which

| Repository | Role | Stack | Deployed to |
| --- | --- | --- | --- |
| **`School-bus-Front`** — *this repo* | **Frontend.** The entire user interface. | Vite 8 + React 19 + React Router 7 + Tailwind v4 | Firebase Hosting (static files) + `/v1/**` rewrites to Cloud Run |
| **`School-bus-API`** — *separate repo* | **Backend.** The privileged HTTP API only. | Hono 4 on Node 22 | Cloud Run (`school-bus-api`, us-central1) |

Everything a user sees or taps lives in **this** repository. Everything that needs
the Firebase **Admin SDK** — creating Auth users, reading and writing `users`
profiles, hashing driver access codes — lives in **`School-bus-API`**, because
none of it may ever run in a browser.

The asymmetry is deliberate: **this repo has no server.** It is static files on a
CDN plus a browser bundle that talks to Firestore directly for realtime and
offline data, and calls the API for privileged work.

## 1. What this is

A school runs buses on fixed routes. Every morning a driver has to know **who is
on the bus**, and every morning the office has to know **who is not accounted
for** — a child who was never marked boarded is a phone call, and the answer must
not depend on the driver having signal.

So the product is one loop, served twice:

- the **driver** works a manifest on a phone, tapping a child's state as they get
  on and off, with or without a network;
- the **office** watches the same day as counts and routes, and the school's roll,
  classes and assignments live behind it as records;
- and **everything that must be trusted** — accounts, codes, sign-in — happens
  server-side, never in the browser.

The daily loop, end to end:

1. The office brings the school's roster in once, from the school's own spreadsheet
   (**student name · class · bus**), and it becomes the roll.
2. It assigns each child to a bus and each bus to a driver.
3. Someone dispatches a run: that creates the day's run and pre-registers its
   children as unrecorded.
4. The driver opens the app — on the bus, often with no signal — and taps each
   child Boarded, then Dropped off. Each tap is durable on the device.
5. Done, the driver completes the run; anyone still unrecorded is marked absent in
   the same atomic write.
6. The office watches the day: totals, the unaccounted count, one row per run until
   everyone is accounted for.
7. The day is then counted by bus and by class, exported as CSV, or printed.

Everything after this point is structure in service of that loop.

## 2. Who uses it

Three roles live on `users/{uid}`: **director**, **operator**, **staff** (the
driver, code-only sign-in).

| Role | Signs in with | May open |
| --- | --- | --- |
| **director** | email + password | every screen, including Operators and Activity |
| **operator** | email + password (same tab) | only the screens on their profile: `live`, `students`, `reports`, `assignments`, `drivers` |
| **staff** | 8-digit access code | the phone roster only; writes its own bus's runs and attendance |

**A grant is the authority.** A secretary granted Students does the roster's work.
The rule, deliberately:

- an operator granted **Students** may **create** a child and correct a `name` or
  `grade` (class);
- an operator granted **Assignments** may change a student's `busId` and link a
  driver to a bus, and nothing else on those documents;
- a caller holding **both** may send `grade` + `busId` in **one** write — which is
  what one row of a sheet import is;
- **director-only**, because it is not office work: deleting a student, renaming
  the school, the Operators page, and reading the Activity log.

**The main director** (`owner: true`, or simply the only director of a school) is
the one account that sees Operators. It is resolved in one place,
`src/lib/main-director.tsx`, whose two steps are: an explicit `owner` flag, else a
school with exactly one director. The API applies the same two steps, so client
and server never disagree.

**Three places have to agree, or a permission becomes a hidden link:**

1. `src/lib/permissions.ts` — `canOpenScreen` decides what is *drawn*: nav rows,
   route guards (`RequireAccess` admits the management shell; `RequireScreen` gates
   each route and redirects to the first screen the reader *can* open).
2. `firebase/firestore.rules` — reads the same `screens` names off the caller's
   profile and grants a collection to the union of screens that need it. Writes are
   narrower and field-split per grant (above), so one grant cannot quietly become
   the other.
3. `School-bus-API` — `requireManager(screen)` for the privileged driver
   endpoints, `requireOwner` for `/v1/operators*`.

`canOpenScreen` is also what the tour and the guidebook read, so "not yours to
open" is computed, never written per role.

## 3. The screens

Routes live in `src/routes/`, one file per screen. The route table is
`src/App.tsx` (`BrowserRouter`); `src/main.tsx` is the entry point (fonts +
`globals.css` + `<App/>`).

```
/                      PhoneShell       — phone-column roster (per-driver morning run)
/login                 LoginPage        — driver access code, or email/password
/dashboard             DashboardPage    — Live monitor: the day's totals + one row per run
/dashboard/students    StudentsPage     — the school roll over the 90-day window (no date)
/dashboard/reports     ReportsPage      — the day counted: KPIs, by-bus, class cards,
                                          CSV + print, and the Analytics modal
/dashboard/assignments AssignmentsPage  — driver↔bus and student↔bus links + sheet import
/dashboard/drivers     DriversPage      — driver accounts + one-time access codes
/dashboard/activity    ActivityPage     — the audit log
/dashboard/operators   OperatorsPage    — operator accounts + their granted screens
                                          (main director only)
/dashboard/guide       GuidePage        — the guidebook, one page per screen
```

`/dashboard/analytics` was a standalone page; Analytics now lives as a modal
inside Reports, and the old URL is a `<Navigate to="/dashboard/reports" replace />`.
Unknown paths land on `/`.

**Code splitting.** The dashboard pages are `React.lazy` imports wrapped in
`Suspense`, with `RouteFallback` + the matching `DashboardSkeletons` component as
the fallback, pairing each lazy route with the same skeleton the page shows while
its query is in flight.

**App shell.** `src/providers.tsx` wraps the tree in `LocaleProvider` →
`AuthProvider` (`src/lib/auth.tsx`) → `ToastProvider`, plus the boot loader. There
is no server layout, so per-route `document.title` and `<meta name="description">`
are set client-side by `DocumentMeta` in `src/App.tsx`.

**Role-based access:** after login, `staff` lands on `/`; `director` and `operator`
on `/dashboard`. `RequireAccess` admits the two management roles (a driver bounces
back to `/`), and every dashboard route is gated again by `RequireScreen`. The
sidebar shows the signed-in school's name (`src/lib/school.ts`), so each tenant
sees their own.

**Two sign-in modes on `/login`:** a segmented toggle between **Driver code**
(default) and **Director** (email/password — an operator signs in through the same
tab and lands on the screens their profile grants). Both are exchanged for a
Firebase custom token by the API before any session exists.

### Mobile roster — the driver's screen

`src/routes/MobilePage.tsx` inside `PhoneShell.tsx` (`max-w-[480px]`,
`sm:border-x`). A four-cell run summary with a proportion bar, an expanding search
(an icon that unfolds into the field and folds back when emptied), segmented filter
tabs (All / Boarded / Done), one bordered row per student with a pale status
control, and a bottom bar with an honest online/offline label.

- The status control is the roster's only tap that changes state, and it is
  **not** an Arc button: its tint *is* the status language, and the Button module
  owns colour. The cycle is **Board → Boarded → Dropped off**, with a 350 ms guard
  against an accidental double tap (which would record a child as off the bus).
- A child nobody has recorded is not a warning state: the pill reads **"Board"**
  — the action — with a control edge, never the amber waiting hue.
- The roster is **per-driver**: the app bar title and the rows come from the
  signed-in user's bus (`buses where driverUid == uid`, resolved by
  `useDriverBus`). A staff account linked to no bus gets a friendly empty state.
- A run that has not been dispatched gets a "No run today" state, not an empty
  roster.
- **Complete Run** marks the run `COMPLETED` and any still-unrecorded children
  `ABSENT` in one atomic batch. Each card's "⋯" menu offers **View history** and
  **Mark absent**; the top-bar "⋯" shows run details (bus / type / date / status)
  and **Sign out**.
- **Not paginated**, unlike every director list: the whole run is one scrollable
  list, because a driver at the bus door has to see every child without an extra
  tap. (See [§5](#5-how-a-day-works) for what this screen does with no signal.)

### Live monitor — "is everyone accounted for?"

`DashboardPage.tsx`. The composition answers the question before it shows
anything else:

- **Manifest summary** — the accounted-for ratio (`25 / 32`), a four-part
  proportion bar (on board / dropped / unaccounted / absent) and three counts. The
  lead sentence under the title is the one finding in today's data (e.g. "Bus 04
  was signed off with 2 still waiting"); every number comes from the same rows the
  routes show.
- **Routes** — one row per run, not four identical cards: bus, driver, a route line
  with the bus's position, and on-board / dropped / unaccounted counts. A completed
  run whose students are still unrecorded gets an amber status and the finding
  names it. The row is a control: pressing it (or its trailing chevron) opens the
  **bus overview**.
- **Bus overview** — the pressed row expanded, as a dialog on desktop and a bottom
  sheet on a phone: bus and driver, run status and the same route line, a foldable
  student search, the one finding ("Still to account for: 1 of 8 students"), then
  the children grouped by what happened to them — On board, Dropped off, Still
  waiting, Absent — with each one's class and boarded/dropped-at time. Counts come
  from the same rows as the row and the table, so no two surfaces can disagree;
  empty groups are omitted and a bus with no roster gets an empty state
  (`components/dashboard/BusOverviewModal.tsx`).
- **No student list, by design.** The day's per-child table lives nowhere: the two
  ways people ask it are **per bus** (here) and **per class** (Reports).
- **Scope row** — date picker (re-queries the day) and the Morning pickup /
  Afternoon drop-off segment. Export CSV and Dispatch vehicle are real actions in
  the page header, not the filter bar.
- **Dispatch vehicle** — creates a run for a chosen bus/type/date and
  pre-registers that bus's students as unrecorded; refuses to clobber an existing
  run.

### Students — the roll

`StudentsPage.tsx`. One row per child with class, bus, present days, absent days,
attendance % and the last recorded day, summarised over the 90-day retention
window (`ROLL_SUMMARY_DAYS`). Search, sort by name or class, a class filter, the
shared pager (10/page), a per-child **History** sheet, an **Edit** dialog, and a
roll **Export CSV**.

- **It is not day-scoped, and there is no date picker here.** One used to exist and
  switched the screen into a per-day run view; that made it a second Reports
  wearing the roll's title, so it was removed (see `AGENTS.md`). A single day is
  answered per bus on the Live monitor and per class on Reports.
- The table is `components/dashboard/AttendanceTable.tsx` (`table-zebra`; two-line
  phone rows below `md`) and renders the roll only.
- **A class is picked, never typed.** The Edit dialog offers the classes the school
  already has, so `4A`, `4a` and `Class 4A` cannot become three cards on Reports. A
  genuinely new class arrives with the sheet import.
- Editing a **name** also corrects today's attendance copies (see [§4](#4-the-data)).
- **Add student** sends the reader to Assignments, where children actually arrive —
  by import, not a form.

### Reports — the day counted

`ReportsPage.tsx`. Its own date picker + run segment (remembered per screen), four
KPI cells (**Assigned / On board / Dropped off / Unaccounted**), a by-bus table
with completion, and **class cards** that open one class's students in place, with
"Open in Students" jumping to the roll. **Analytics** and **Print** sit in the
header; **Export CSV** writes the day's filtered rows; the sidebar and header are
`print:`-hidden.

The roster is deliberately *not* here. This screen answers "which class or bus
needs attention" and never lists every child.

**Analytics** is not a route — it is a modal (`AnalyticsModal`) drawing **one chart
with two designs** over the *same* measure (completed trips per bus for the day and
segment), as `@uiarc/bar-chart` or `@uiarc/donut-chart`, switched by a segmented
control. Every number comes from the page that opened it, so the modal issues no
query and opens instantly.

### Assignments — who rides which bus

`AssignmentsPage.tsx`. Grantable. The Drivers table links a staff user to each bus
(one driver per bus; the write keeps the denormalized `driver` name in sync and
clears the driver's previous bus atomically). The Students table is
cursor-paginated in Firestore (`useStudentsPaginated`, 50 rows a fetch), shown ten
at a time with the shared pager, and fetches the next page when the reader reaches
the last loaded one (`useAutoLoadMore`) — there is no "Load more" button. Search is
the expanding Arc search, filtered by bus and class; each row's bus is an Arc
dropdown whose trigger carries the current value and whose selected row is checked.

**A saved move shows its own answer, not a re-read.** `students` is a one-shot
cursor page, so after `assignStudentToBus` the page keeps an override that both the
trigger label and the `checked` flags read — an immediate `getDocs` can return the
pre-write document, which is what once made a saved move snap back to the old bus.

### Sheet import — how a roster arrives

Drop a CSV/XLSX with **student name · class · bus**, confirm the column match, and
read the preview before anything is written. It **creates the children the file
lists**, sets each one's **class**, and moves them onto their bus:

- a name that matches no child **becomes one** (a new child needs a class, so a row
  without one is reported, never half-created);
- a name that matches is **corrected** — class and/or bus — and the last row for a
  child wins;
- **class spellings are folded** (case, spacing, punctuation and the leading
  `Class` / `Grade` / `Classe` / `Niveau` / `الصف` word), so `class 4a` lands in the
  class the roster still spells `Grade 4A`;
- a bus the school does not have is **reported, never guessed**;
- the preview **names** the children to be created and the rows it will not apply,
  and lists every class in the file with a `new` marker — the guard against a typo
  becoming a second child;
- an operator without the **Students** grant still imports bus moves; the dialog
  says which half it cannot write and omits exactly that half.

Implementation: `src/lib/sheet-import.ts` (dependency-free CSV/XLSX reader + plan;
XLSX is a zip read with `DecompressionStream("deflate-raw")` and `DOMParser`, so
the import adds no bundle weight and works offline) and
`components/import/SheetImportDialog.tsx`. The drop target is a disclosure, closed
by default and capped at `max-w-xl`, because importing is a once-a-term job and a
page-wide drop zone pushed the roster below the fold.

### Drivers — accounts and access codes

`DriversPage.tsx`. Bus drivers are typically in their 40s–50s with no usable email,
so they sign in with an **8-digit numeric code** instead of email/password. Create a
driver by name → an auto-generated code is shown **once** (copyable), with per-row
reveal / copy / regenerate in pages of ten, and "Generate code" for any staff
account that has none.

**The issued code stays on screen.** Codes are hashed at rest, so
`POST /v1/drivers/regenerate` returns the plaintext exactly once: the page keeps it
in component state (`issuedCodes`) and renders it in that row with the "copy it now"
hint, so "Generate code" visibly produces a code instead of only a toast. The first
view runs a one-shot `code-issued` / `code-scan` animation (a rise plus a light
band crossing the digits), replayed on rotation because the node is keyed by the
code. Leaving the page loses the code by design — the API cannot return it again.

### Operators and Activity

`OperatorsPage.tsx` is the main director's alone: create an operator, choose the
screens they may open, reset a password, remove them. Access can never be handed
out from an operator's own account.

`ActivityPage.tsx` reads `schools/{schoolId}/audit` — see [§4](#4-the-data). It is
director-only: the audited do not administer the audit.

### Guidebook, tour and hover hints

Three ways to answer "what is this?", sharing one rule: **content is derived from
permissions, never written per role.**

- **The tour** (`src/lib/tour.ts`, `components/dashboard/Tour.tsx`) walks a director
  across the dashboard, one step lighting one real control — a 2px accent stroke on
  the control's own edge plus a card beside it. Non-modal on purpose (`aria-modal`
  false, no focus trap, no dimming): the page stays usable. A step declares its
  `path` and a `[data-tour="…"]` selector; the tour navigates, polls for the control
  (route chunk + first snapshot), then places the ring. The loaded profile is passed
  in from the host — re-reading it inside the tour started at an empty profile and
  silently dropped every screen-gated step (that shipped once).
- **Asked once, replayable for ever.** `src/lib/tour-seen.ts` keeps one
  `localStorage` key per UID. Skip, Escape, Done and leaving the page all end it.
  Replay has three doors: the rail footer row above Guidebook, the Help dialog, and
  the guidebook itself.
- **The guidebook** (`/dashboard/guide`, `src/lib/guide.ts`,
  `components/guide/GuideMap.tsx`) splits pages into *mine* and *locked* with the
  same `canOpenScreen` the guards use, so a reader who cannot open a screen still
  sees its page listed. **Every miniature is drawn, never captured** — markup in the
  dashboard's own tokens, so it follows `.dark` and `dir="rtl"` and cannot go stale.
  Pins render *inside* the control they name, and the article's numbered steps carry
  the same numbers.
- **Hover hints** (`src/lib/hints.ts`, `components/HoverHint.tsx`) are the
  three-second rest: `data-hint="<id>"` on a control, one title and one sentence from
  the dictionaries, one document-level listener, innermost annotated element wins.
  Mouse and keyboard focus both arm it; touch never. Any scroll, click or Escape
  dismisses it.

## 4. The data

### Firestore schema (multi-school, tenant-isolated)

```
users/{uid}                          { role: "director"|"operator"|"staff",
                                       schoolId, email,
                                       screens?: [...]  // an operator's granted pages
                                       owner?: true }   // the main director
schools/{schoolId}                   { name, assignmentMode? }
schools/{schoolId}/students/{id}     { name, grade, busId, updatedBy, updatedAt }
                                   // `grade` is the CLASS label — "Grade 4A" on
                                   // older rows, "Class 4A" on new ones. A string,
                                   // not a reference: the classes are the distinct
                                   // values of it, and there is no `classes`
                                   // collection.
schools/{schoolId}/buses/{id}        { name, driver, driverUid?, updatedBy, updatedAt }
schools/{schoolId}/driverCodes/{uid} { codeHash }  // HMAC-SHA256(CODE_PEPPER, code);
                                   // director-only. Legacy docs may still carry a
                                   // plaintext { code } field.
schools/{schoolId}/runs/{id}         { busId, runType, date, status }
schools/{schoolId}/attendance/{id}   { runId, date, busId, busName, studentName,
                                       grade, status, boardedAt, droppedOffAt }
schools/{schoolId}/audit/{id}        { event, actorUid, at, detail?, expiresAt }
```

**Tenant isolation:** everything lives under `schools/{schoolId}`; the rules only
ever expose the caller's own school (`users/{uid}.schoolId`).

**Attendance is denormalized** — a flat per-school collection, one doc per
run+student — so both halves are single-query realtime reads: the phone reads
`where runId == X`, the dashboard reads `where date == today`. The cost is that a
child's **name and class are snapshotted at dispatch**, so two records exist:

- `students` is the record the roll reads;
- `attendance` carries the copies the driver's sheet and the day view read.

`updateStudent` corrects **today's** attendance copies in the same batch as the
student write — except for a run already `COMPLETED`, whose record of the day
stands — and never touches past days. Any new screen that edits a student must do
the same or the two halves disagree until the next dispatch.

**Run ids are deterministic**: `${busId}-${yyyy-mm-dd}-${runType}`. **The
driver↔bus link lives on the bus** (`buses/{id}.driverUid`); `driver` is a
denormalized display copy kept in sync on assignment, and one driver drives one bus
(enforced in Assignments).

**`assignmentMode`** on `schools/{schoolId}` (`"bus"` | `"driver"`, absent =
`"bus"`) decides whether Assignments labels a child's assignment by the bus or by
the driver. It is the school's value, not the device's, so two colleagues read the
same column; a director or an operator granted Assignments may write that one
field.

**The roll's 90 days.** Presence is counted in **days, not runs**: a morning +
afternoon pair is one schoolday, so "42 present · 2 absent" reads as schooldays.
`useRollSummary` is one newest-first paginated range read (500/page, 20,000 docs),
not a query per student; the newest-first order means a truncated window keeps the
most recent records.

**The activity log** is the record of what changed and by whom. Two writers with
different guarantees: the **Admin SDK** writes account and sign-in events
(verified token, server clock); the **browser** appends roll, assignment and
settings entries *in the same atomic batch as the change*, with the rules pinning
`actorUid` to the caller, `at` to `request.time`, the vocabulary to a role-scoped
allowlist, and refusing update/delete. Its `changes` values are a claim, not
evidence, and the screen says which half is which. Every write to `attendance`,
`runs`, `students`, `buses` or `schools/{id}` must carry `updatedBy ==
request.auth.uid` and `updatedAt == request.time` (`stamped()` in the rules) — that
half cannot be skipped. Retention is `AUDIT_RETENTION_DAYS` plus a TTL policy on
`expiresAt`; entries are immutable by design.

**Indexes.** The per-student history query (`attendance` where `studentName` +
order by `date`, `runId`) needs the composite index in
`firebase/firestore.indexes.json` (`npm run deploy:indexes`). Driver codes need a
**single-field collection-group index on `codeHash`**, which the Firebase CLI
cannot deploy — enable it once in the console (Firestore → Indexes → Single Field →
Collection Group; the missing-index error from the verify query links to the
creation page).

The Firebase config (`firebase.json`, `firestore.rules`, `firestore.indexes.json`)
stays in **this** repo on purpose: the client SDK is what the rules govern, and the
indexes serve the queries this client issues.

### App data access

- `src/data/students.ts` + `src/data/dashboard.ts` — types + presentation config
  only (statuses, tabs, KPI ids, nav, run segments). No data lives here.
- `src/lib/school-data.ts` — `useRunRoster()` (phone roster + status writes +
  `completeRun` / `markAbsent`; resolves the signed-in user's bus via an internal
  `useDriverBus`); `useDashboardData(date, segment)` (KPIs / routes / attendance for
  one day and segment); `useSchoolRoll()` + `useRollSummary()` (the whole roll and
  its 90-day tally); `useStudentHistory()`; and `useAttendanceTrend(start, end,
  segment)` — paginated date-range daily totals, **currently unused** (the Analytics
  trend that consumed it was removed; the hook remains for a range view that may
  return) — with `summarizeByBus` / `summarizeByGrade` helpers. All `onSnapshot` /
  paginated Firestore: nothing renders without a live session.
- `src/lib/school-admin.ts` — Assignments data: `useBuses()`, `useStaffUsers()`,
  `useStudentsPaginated()` (cursor-paginated), `useBusStudentCounts()`, and the
  `assignDriverToBus` / `assignStudentToBus` / `updateStudent` writers.
- `src/lib/use-student-list.ts` — `useStudentList(rows)`: client-side search (name),
  class filter, sort (name / class, and run order for a day) and pagination
  (10/page) over an already-loaded row set. Powers the Students roll and Reports'
  paged figures. There is **no status filter**: a status is a fact about one day,
  and the only list that used one (the removed day view) is gone.
- `src/lib/use-page-slice.ts` — the pagination primitive every other director list
  uses: `Pagination` (the shape `PaginationBar` takes), `usePageSlice(items, 10,
  resetKey)` (clamps when rows change under it, resets to page 1 when the reset key
  changes) and `useAutoLoadMore`. Page size is 10 everywhere except Reports' class
  cards, which page **8** at a time because the grid is four across.
- `src/lib/date-value.ts` — the bridge between the app's `YYYY-MM-DD` keys and the
  `Date` objects the Arc pickers use (built from parts, never `new Date(string)`, so
  a day never shifts across a timezone).
- `src/lib/csv.ts` — `buildAttendanceCsv` (a day's run rows), `buildRollCsv` (the
  presence roll) and `downloadCsv`. Every cell is neutralised against spreadsheet
  formula injection.
- `src/lib/api.ts` — the only backend call site (typed client + `ApiError`).

## 5. How a day works

**Dispatch.** Creating a run writes the run document and pre-registers that bus's
children as attendance docs in `WAITING`. That snapshot copies `studentName` and
`grade` onto each attendance doc — the class the child was in when the run went
out is part of the record.

**The driver's taps.** `WAITING → BOARDED → DROPPED_OFF`, one write each, stamped
with the caller. A second press inside 350 ms is ignored, because the cycle means an
accidental double tap records a child as off the bus.

**Completion.** `completeRun` marks the run `COMPLETED` and any still-`WAITING`
children `ABSENT` in one atomic batch. A completed run with children still
unrecorded is what the Live monitor's finding names.

**Unaccounted.** The director never sees the word "waiting" — only **unaccounted**
(unrecorded + absent), and a neutral chip where an individual row must say
something. A child nobody recorded must not read as a warning next to a child who
is actually absent.

**Offline — two layers, and they are not interchangeable.**

1. **Data.** Firestore is initialized with `persistentLocalCache` +
   `persistentMultipleTabManager` (`src/lib/firebase.ts`): reads are served from
   IndexedDB and writes are queued durably, so a "Boarded" tap in a dead zone
   survives a reload and a phone restart.
2. **App shell.** `vite-plugin-pwa` precaches `index.html`, the JS/CSS, the
   @fontsource webfonts and the icons (~2.4 MiB), with `navigateFallback:
   /index.html` for SPA routes. Without it a driver who reloads offline gets the
   browser's error page even though their queued writes are safe on disk.
   `src/lib/service-worker.ts` reloads on `controllerchange`, so an open page cannot
   keep running old JS after a deploy.

**Never add runtime caching for Firebase, Auth or the API — and no `NetworkOnly`
"guard" routes either.** An earlier version did exactly that and broke production:
Firestore's WebChannel falls back to a long-polling GET that stays open, any
matching route makes Workbox intercept it, Firestore never connects, and the
dashboard shows skeletons for ever. `runtimeCaching` is deliberately `[]`: a request
matching no route is never touched, so the browser handles it natively.

**Proof:** `npm run build && npm run test:offline` boots the built app in headless
Chrome, stops the server outright, reloads, and asserts the document was served
`fromServiceWorker` (20 checks; it skips cleanly when no Chrome is installed).

## 6. The system

### Two repositories and the split rule

The former single Next.js app is now two independent git repos with independent
deploys. The boundary: **this repo has no server.**

**`School-bus-Front` (this repo) — the web client.** Vite 8 + React 19 + React
Router 7 SPA (TypeScript, Tailwind v4 via `@tailwindcss/vite`). Deployed as static
files to Firebase Hosting. It talks **directly to Firestore with the Firebase client
SDK**, and that is load-bearing: the roster and dashboard are realtime
(`onSnapshot` — a tap on one device appears on the director's screen without a
refresh), and drivers run routes through flaky or dead networks, so attendance
writes must be durable offline (layer 1 above). Putting a server in front of those
reads and writes would mean re-implementing realtime delivery and an offline write
queue by hand.

**`School-bus-API` — the privileged backend.** Hono 4 on Node 22, bundled by tsup
into a single ESM file and run with `node dist/index.js` (dev: `tsx watch
src/index.ts`). It exists because some operations categorically cannot be done from
the client SDK: Firebase Auth users and `users` profiles are Admin-SDK-only, and
the code hashing pepper must never reach a browser. It owns director
email/password sign-in, driver code verification, driver account creation, code
rotation, and the operator endpoints. It also owns `scripts/seed.mjs` and
`scripts/clear-data.mjs` (service-account credentials; they create Auth users).

**The split rule:** Firestore client SDK for realtime and offline; the API for
anything privileged. If a change seems to need a new Firestore read on a privileged
collection, that is the signal the endpoint belongs in the API repo.

### HTTP API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness. Deliberately does not touch Firebase, so the server reports healthy before credentials are mounted. |
| `POST` | `/v1/auth/director-sign-in` | Director/operator email + password → Firebase custom token. |
| `POST` | `/v1/auth/verify-code` | Driver 8-digit code → Firebase custom token. |
| `POST` | `/v1/drivers` | Create a driver account (Bearer token; needs the Drivers grant). |
| `POST` | `/v1/drivers/regenerate` | Rotate a driver's access code (Bearer token). |
| `POST` | `/v1/operators` | Create an operator (main director only). |
| `POST` | `/v1/operators/screens` | Re-scope an operator's screens. |
| `POST` | `/v1/operators/password` | Reset an operator's password. |
| `POST` | `/v1/operators/remove` | Remove an operator. |

All four operator routes are `requireOwner`; the two driver-management routes are
`requireManager('drivers')`.

**In production these paths are same-origin**: `firebase.json` rewrites `/v1/**`
and `/health` to the Cloud Run service, so there is no CORS preflight at all.
In dev the app calls `VITE_API_URL` cross-origin and exercises the CORS path.

**Server structure** (`School-bus-API/src/`): `index.ts` (bootstrap), `app.ts` (the
Hono app — request logger, `secureHeaders`, CORS allowlist, `/health`, `notFound`,
and a generic 500 handler that never surfaces an internal message), `routes/` (the
handlers plus `index.ts` wiring), `middleware/security.ts`, `lib/driver-admin.ts`
(`requireDirector`, `createDriver`, `rotateCode`, `logAudit`, HMAC-SHA256 code
hashing with `CODE_PEPPER`), `firebase-admin.ts` (lazy Admin SDK init), `env.ts`
(the only place `process.env` is read), and `contract.ts`.

**Security middleware order** — applied to the two auth routes in this order, and
registration order is load-bearing:

1. `uniformDelay` — a constant ~400 ms on success **and** failure, so response time
   cannot distinguish "no such code" from "wrong role". It runs first, so even a
   rejected or rate-limited request pays it.
2. `originGuard` — rejects a mismatched `Origin` (CSRF), allowing a missing
   `Origin` for same-origin form/curl callers.
3. `rateLimit` — per-IP sliding-window throttle.

Body parsing happens **inside** the handler, after the delay, so even a malformed
body costs the same wall-clock time. The driver management routes carry no delay or
throttle: they authenticate with a director Bearer ID token, not a guessable 8-digit
code.

**Error codes** are machine identifiers, so clients branch on a stable value:
`invalid_request`, `invalid_credentials`, `invalid_code`, `not_director`,
`too_many_attempts`, `rate_limited`, `invalid_name`, `invalid_uid`,
`missing_token`, `invalid_token`, `forbidden`, `not_found`, `server_error`.

**The contract is mirrored on purpose.** `School-bus-API/src/contract.ts` is the
source of truth (paths, Zod schemas, response shapes, error codes);
`src/lib/api-contract.ts` here is a hand-kept mirror. Nothing enforces agreement at
build time — change both in the same sitting. If the contract outgrows a handful of
endpoints it should be published as a private package instead of mirrored.

**Client:** `src/lib/api.ts` is the only place the browser talks to the API. It
exports `verifyDriverCode`, `directorSignIn`, `createDriver`,
`regenerateDriverCode`, the operator calls and an `ApiError` carrying `status` +
`code` (a transport failure becomes `status: 0` with a client-side `network_error`,
`not_signed_in` or `not_configured`). Authenticated calls attach the signed-in user's
Firebase ID token as a Bearer credential. `VITE_API_URL` is **tri-state**: a URL =
another origin (dev), **empty** = same-origin (production), **unset** =
misconfiguration that fails loudly.

**API environment:** `PORT`, `HOST`, `NODE_ENV`, `TRUSTED_PROXY_HOPS` (default 2 —
Hosting → Cloud Run), `APP_ORIGINS` (comma-separated browser-origin allowlist; dev
default `http://localhost:5173`), `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`,
`FIREBASE_SERVICE_ACCOUNT`, `CODE_PEPPER`.

### Sign-in

**Driver code.** An 8-digit code is exchanged by the API for a Firebase custom token
(`POST /v1/auth/verify-code` → Admin SDK `collectionGroup` lookup on
`driverCodes.codeHash` → `createCustomToken`), then the client calls
`signInWithCustomToken`. The session is a normal Firebase Auth session, so
`onAuthStateChanged`, `useUserProfile`, `RequireAccess` and the rules'
`request.auth.uid` gating all work unchanged.

- **Codes are stored hashed, not plaintext**: `codeHash = HMAC-SHA256(CODE_PEPPER,
  code)`. The plaintext is shown once, at creation or rotation, and is never
  recoverable.
- Odd-length or malformed codes are rejected on the same timing path, so the
  response cannot be used to probe for which part was wrong.

**Director / operator password.** The client never calls
`signInWithEmailAndPassword` against the client SDK for the dashboard: the API
verifies the password with the Admin SDK, refuses an account that is not management
(`403 not_director`), and returns a custom token. That is what keeps the Director
tab from handing a session to a driver account that happens to have a password, and
the login page shows a localized message pointing drivers to the code tab. The
route applies the same ~400 ms uniform delay, per-IP throttle and Origin check.

### Internationalization

**Three languages, all complete**: `en` (default), `fr`, `ar`. A typed dictionary
per language — the `Messages` type is derived from `en.ts`, so a missing key fails
`tsc --noEmit`, which `npm run build` runs first. There is no fallback chain: a key
that exists only in English is a build error, not a French reader seeing English.

- **Locale core** (`src/lib/i18n/`): `dictionaries/{en,fr,ar}.ts`, a client
  `LocaleProvider` + `useLocale()` exposing `{ locale, setLocale, dir, t, tp }`, and
  `Intl`-based formatting (`format.ts`: `formatTime`, `formatPercent`,
  `toLocaleDigits`, `localizeTimeString`, `translateDataLabel`). `config.ts` owns
  `LOCALES` (`en`, `fr`, `ar`, in menu order), `LOCALE_DIR` and the cookie name.
- **Counts** go through `tp(key, count, vars)`, never `t`: the dictionary keeps the
  plural on the base key and adds `<key>.one`, and `tp` picks the CLDR category with
  `Intl.PluralRules`. Without it a school with one unrecorded child reads
  "1 students".
- **Data labels** are translated, not stored translated: a bus or class value is the
  school's own string, and `translateDataLabel` re-renders only the prefix from the
  dictionary — so the same data reads `Bus 04` / `Bus 04` / `حافلة 04`, and
  `Grade 4A` / `Classe 4A` / `الصف 4A`.
- **Arabic numerals**: Arabic mode uses Eastern Arabic digits (٠١٢٣) via `ar-EG`.
- **RTL**: `dir="rtl"` flips the layout. Components use logical utilities
  (`start-*` / `end-*` / `ms-*` / `ps-*` / `text-start` / `border-e`), so the
  dashboard's fixed sidebar moves to the right.
- **Persistence:** the choice lives in a `locale` cookie (`path=/`). There is no
  server render, so `readLocaleCookie()` reads `document.cookie` synchronously and
  `App.tsx` passes it into `LocaleProvider` **before first render** — that is what
  keeps an Arabic reader from seeing a flash of LTR English. No localStorage.
- **Fonts:** IBM Plex Sans (Latin) + IBM Plex Sans Arabic share one `--font-sans`
  stack; unicode-range serves Arabic glyphs from the Arabic face.
- **Not translated:** proper nouns — student and driver names, bus number suffixes,
  class codes, and the product name.
- `docs/i18n-glossary.md` is the shared vocabulary (élève, conducteur, trajet,
  présence); follow it rather than inventing a second word for the same object.

### UI system

"Cool paper, ink and cyan-blue" for both halves. Tokens live in the `@theme` block
of `src/globals.css`:

- **Ground and surfaces** — a cool, blue-tinted paper ground (`#f4f8fa`), white
  cards, and one pair of 1px edges. Surfaces are separated by a tone step or a
  border, never a shadow.
- **Ink and the one data hue** — primary text `#0e1a20`, secondary `#4a5a64`; cyan
  blue `#0e7490` belongs to the data (the route line, the proportion bar) and to
  focus/selection, never to chrome. Green, amber and red are reserved for attendance
  state.
- **Dark** — the same palette at night: a cool ink ground (`#0d1519`) with the
  accent lifted to `#47cbe2`, so the data hue still clears 9.5:1 as text.
- **Type** — IBM Plex Sans at 24 / 15 / 13.5 / 11.5 across both halves, tabular
  numerals on every figure. The dashboard's `dash-*` scale is app type: the h1 is
  24px and no figure passes 34px.
- **The product mark** — `src/components/ProductMark.tsx` draws a route that turns a
  corner, with a school-bus amber stop at its origin.
- **Icons** — `src/components/Icon.tsx` takes `variant="rounded"` (filled, phone) or
  `"outlined"` (line, dashboard). Both families are a **self-hosted subset** in
  `public/fonts/`, generated by `scripts/build-icon-font.mjs` (`npm run build:icons`);
  `npm run build` runs `scripts/check-icons.mjs`, which fails the build when the
  source names a glyph the subset does not contain. Names chosen by a runtime
  expression must be listed in the generator's `EXTRA_ICONS` — the scanner only sees
  literals.
- **Skeletons** — `Skeleton` / `SkeletonText`, composed into screen shapes in
  `DashboardSkeletons.tsx` and `RosterSkeleton.tsx`; each mirrors the layout it
  replaces, and the lazy routes use them as their `Suspense` fallback.

**Arc registry components — the control set.** `src/components/arc/` holds
components copied from the Arc registry (https://uiarc.dev). They are our own code
now, and they are the control vocabulary:

| role | component |
| --- | --- |
| every action / icon control | `arc/button` (`primary` / `secondary` / `ghost` / `danger`; `sm` 36, `md` 44, `lg` 48; `icon` squares; `align="start"` rows) |
| every value selector | `arc/dropdown-menu` (trigger carries the current value, `checked` rows, optional sticky search from four or more options) |
| every date field | `arc/date-picker` (+ `arc/calendar` beneath it) |
| every search field | `arc/expanding-search` in its *filter* form (controlled value, no results panel) |
| every paged list | `arc/pagination` inside `dashboard/PaginationBar` |
| the theme flip | `arc/theme-switch`, wired through `ThemeSwitchButton` |
| state-changing glyphs | `arc/icon-morph` (access-code copy → check) |
| the analytics chart | `arc/bar-chart` / `arc/donut-chart` |

Deliberately *not* an Arc button: nav links, segmented controls (their sliding
thumb is the control), filter chips, the roster's status pill (its tint is the
status language) and calendar cells.

`src/components/arc/arc-tokens.css` maps the registry's generic token names onto
this app's `--color-*` tokens **by reference**, so a palette change or a `.dark`
flip needs no second mapping. Local edits to vendored files — added props,
translated strings, RTL anchors — are listed with their reasons in
`src/components/arc/PATCHES.md`; `shadcn add --overwrite` reverts them silently.

**Motion.** One spring/easing vocabulary (`src/lib/motion.ts`,
`arc/lib/motion-tokens.ts`), and `prefers-reduced-motion` removes travel everywhere
while keeping final states. Two set pieces:

- **The theme flip** is a view-transition circle opening out of the pressed switch
  (`beginThemeFlip()` in `src/lib/theme.ts` puts the switch's centre and reach on
  `<html>`; the keyframes clip the new theme in). Falls back to a plain swap.
- **Each live route line carries a travelling highlight** (`.route-flow` in
  `globals.css`): one band of light runs the travelled part every 3.8 s, staggered
  per row so the four lines read as a wave. Paint-only, the only looping decoration
  in the app, and switched off under reduced motion.

**Layout.**

- **Phone:** centered column (`max-w-[480px]`, `sm:border-x`) with sticky top and
  bottom bars (`src/routes/PhoneShell.tsx`).
- **Dashboard:** a 236px labelled sidebar (`lg:ms-[236px]` main) on the page ground.
  There is **no desktop top bar**: each page owns a `PageHeader` (h1, scope, finding,
  real actions), and the scope row below it is sticky. Below `lg` the sidebar becomes
  a drawer and a 56px phone header appears. Document scrolls normally — do not
  convert the shell to an `h-screen overflow-hidden` flex (it breaks the sticky
  offsets).

## 7. Running and deploying

### Local

- `npm run dev` — Vite dev server on **5173** (the API's default allowed origin).
  In dev the API is a separate origin called directly via `VITE_API_URL`, with no
  dev proxy — so dev is the only place the CORS path is exercised at all.
- `npm run build` — `tsc --noEmit && node scripts/check-icons.mjs && vite build` to
  `dist/`.
- `npm run typecheck` (`tsc --noEmit`), `npm run lint` (ESLint),
  `npm run test:offline` (the headless-Chrome offline regression suite, 20 checks).
- Configuration: copy `.env.example` to `.env.local` and fill `VITE_FIREBASE_*`
  (public client keys by design — the security model lives in the rules and the API)
  plus `VITE_API_URL`.

### Hosting is live; the API is not yet

The web app is deployed to Firebase Hosting. The **backend is not**: the project
is on the Spark plan, so Cloud Run (and the Artifact Registry build a source
deploy needs) refuses with `BILLING_DISABLED`. Until billing is enabled the API
runs locally (`npm run dev` in `School-bus-API`, reached through `VITE_API_URL`),
and the hosted app answers its `/v1/**` calls with 503 — sign-in cannot work
against a backend that is not running. The rewrites below are already in place so
that the day a revision is running, the hosted app is same-origin with no client
change and no CORS to configure.

### Production — same-origin, and that matters

- `firebase.json` rewrites `/v1/**` and `/health` to the **Cloud Run** service
  `school-bus-api` (us-central1). **Those rewrites must stay above the `**` SPA
  catch-all** — Hosting matches in order and the first hit wins; move them below and
  every API call silently returns `index.html`.
- `.env.production` sets `VITE_API_URL=` to **empty** = same-origin, and is
  committed on purpose. It holds no secret; it exists to **override** `.env.local`,
  which Vite also loads during production builds. Drop it and a deploy bakes
  `http://localhost:8080` into the bundle, breaking sign-in for every real user.
- Because the app is same-origin with the API in production, there is no CORS
  preflight and no `APP_ORIGINS` entry to get wrong.
- `firebase.json` also sets `Cache-Control: no-cache` on `index.html`, `/sw.js`,
  `/registerSW.js`, `/manifest.webmanifest` and `/fonts/**` (so a deploy and a
  regenerated icon subset reach clients that already have a worker), immutable
  caching on the fingerprinted `/assets/**`, and the security headers that used to
  live in `next.config.ts`.
- The project is pinned by the committed `.firebaserc` (`school-bus-a4f23`). The
  Firebase CLI is not a dependency: use `npx firebase-tools@latest …`.

```bash
npm run deploy          # build + npx firebase-tools deploy --only hosting
npm run deploy:rules    # firestore rules  — required after ANY rules edit
npm run deploy:indexes  # firestore indexes
```

The three scripts call `npx --yes firebase-tools@latest`, because the CLI is not
a dependency of this repo. They used to call a bare `firebase` binary, which does
not exist here — `npm run deploy` built the bundle and then failed with
`sh: firebase: not found` while still exiting 0, which is how hosting fell
several releases behind the repo without anyone noticing.

### Firebase lifecycle

- **Seed** the director user + demo data by running `npm run seed` **in
  `School-bus-API`** (needs a service-account key at `service-account.json` or
  `FIREBASE_SERVICE_ACCOUNT`, and `CODE_PEPPER` set or in `.env.local`; real
  passwords via env unless `--demo`). It creates a director, two staff, a demo
  school, 4 buses, 32 students and today's morning runs with attendance. Idempotent
  — safe to re-run. Env-overridable (`DIRECTOR_*`, `STAFF_*`, `MONITOR2_*`,
  `SCHOOL_ID`). Passwords fail closed (no well-known defaults unless `--demo` /
  `ALLOW_DEMO_DEFAULTS=1`); codes are stored hashed.
- `clear-data.mjs` wipes the seeded demo data (pass `--users` to remove the demo
  accounts too).
- After any rules edit, `npm run deploy:rules`. The rules deny client profile
  creation, scope staff writes to their own bus, and split student writes per
  grant — smoke-test staff and management flows before relying on a deploy.
- The `driverCodes.codeHash` **collection-group** index is console-only:
  `firebase-tools` rejects single-field collection-group indexes, so it must be
  enabled once by hand (Firestore → Indexes → Single Field → Collection Group).

### Backend (`School-bus-API`)

- `npm run dev` — `tsx watch src/index.ts`. `npm run build` — `tsup` bundles
  `src/index.ts` into a single ESM file in `dist/`. `npm start` — `node
  dist/index.js`.
- Set `CODE_PEPPER` to the same value the seed hashed with, or no existing code
  verifies. Set `APP_ORIGINS` to every browser origin that serves the web app unless
  the API is reached through Hosting rewrites (production).

## 8. Known limitations

Accepted trade-offs, each with the condition that should make someone revisit it.

**Security**

- **The API throttle is in-memory and per-instance; the durable guard is
  `codeAttempts`.** The design point is tens of schools and a few thousand
  accounts, which one instance serves easily. Behind the throttle, a **plainly
  wrong** code is counted in Firestore (`codeAttempts`, keyed by a hash of the
  client IP: 20 wrong guesses in 15 minutes lock that bucket for 15 minutes,
  TTL-expired once the policy is enabled, fail-open if Firestore is unreachable),
  and a **matched** code keeps
  its own `attempts`/`lockedUntil` pair for the owner-role gate. Both survive a
  restart and are shared by every instance. The deploy caps `--max-instances=1`,
  so there is one limiter counter in steady state — though a limit is per
  **revision**, so a rolling deploy runs two. Revisit (a distributed store) only
  if the API runs many instances — regional fan-out, off Cloud Run, or a burst
  that needs more than a couple.
- **An 8-digit code is 10^8 possibilities and several hundred are live.** Both
  guards bound one **address**, not the service: a distributed attacker is limited
  by neither, which is why the API logs `code_verify_failed` and why a longer code
  or an account-bound sign-in is the structural fix. The same bucketing means a
  school behind one NAT shares its failures.
- **The throttle's client IP depends on `TRUSTED_PROXY_HOPS` matching the real
  chain.** `clientIp()` reads that many entries from the **end** of
  `x-forwarded-for` (proxies append; the start is caller-supplied) and folds an
  over-long chain, a too-short chain, and a non-IP entry into one `untrusted`
  bucket. That stops a caller minting a fresh IP per request by padding the header
  — **for the path the hop count describes.** The `hops + 1` tolerance still lets
  a caller prepend one entry, so on a path that produces a *shorter* chain (the
  public `run.app` URL, one proxy hop instead of Hosting's two) padding to exactly
  `hops` entries lands the bucket on a value the caller chose. No single hop count
  is correct for both paths while both exist, which is why the value is measured
  from the API's `xff_observed` line after a deploy (start at 2; ordinary traffic
  resolving to `untrusted` means a mismatch). **Both** the throttle and
  `codeAttempts` key on that resolved address, so a padded header dodges both;
  the structural fix is one ingress path, not a better key. The API repo's README
  documents the procedure; `docs/ops/cloud-run-deploy.md` records the options.
- **Contract drift is not enforced by any build step.** The two contract files are
  kept in sync by hand. Revisit when the surface outgrows a handful of endpoints.

**Data**

- **A child's name is the only key in a sheet import.** A typo'd name creates a
  second child rather than failing; the class column separates twins, and the
  preview names every new child before anything is written — that preview is the
  guard, not a validation.
- **The import never renames a child** (class and bus only), and it only *adds*.
  A child removed from the school is not removed by a sheet.
- **`grade` is a string, not a reference.** Renaming a class means editing every
  child in it; there is no class record, no room, no homeroom teacher, and no
  enrolment history — a class change rewrites the past on Reports.
- **A class change is not written back to today's already-dispatched attendance**
  when the run is `COMPLETED`, and never to past days. Two records of one day can
  therefore name different classes by design.
- **There is no student-delete UI** and no delete path in the client at all; the
  rules allow it for a director, but only the console or a script uses it.

**Front-end**

- **The vendored Arc components carry local patches** (`PATCHES.md`): added props,
  translated defaults, RTL anchors, a z-index that keeps a menu above a dialog, and
  an optional-no-results mode for search. Re-running `shadcn add` without
  re-applying them silently reverts behaviour the app relies on.
- **The bar chart draws left-to-right in Arabic.** Its accessible strings are now
  composed by this app (see `PATCHES.md`: `ariaSummary`, `scrubberLabel`, and the
  donut's legend/row labels), so a screen reader hears the reader's language. The
  axis orientation is a **decision, not an oversight**: mirroring it means
  inverting the bar geometry, the axis-label fitting, the scrubber's hit-test and
  the average line together, and that needs a visual check in Arabic no test here
  can perform. A time axis reading left-to-right is a convention many Arabic
  dashboards keep, while every label, unit and number around it is localized.
- **`motion` costs ~59 KiB gzip in the entry chunk.** It is reachable from the
  roster because the phone controls render Arc buttons; that is the accepted cost of
  one button component everywhere. If the offline-critical first paint ever wins
  again, keep those controls on raw `<button>`s rather than un-lazyfying a route.
- **The Material Symbols subset is a build artifact.** `npm run build` fails when a
  glyph is missing, but adding an icon still means `npm run build:icons` and a
  deploy of `public/fonts/**` (which is why that path is `no-cache`).

**Operations**

- **Per-tenant onboarding is a script, not a UI.** A brand-new school and its first
  director still need `npm run seed` (or the console); drivers and operators have
  full UIs. Revisit if onboarding more than a handful of schools becomes a business
  goal.

## Appendix — the Next.js split (history)

This is how the current shape came about, kept because a reader will meet the
remnants (comments mentioning `next.config.ts`, `loading.tsx`, "director sign-in
moved server-side").

- A single **Next.js** app was split into these two repositories with independent
  deploys. Next.js is gone entirely: no dependency, no `src/app/`, no route
  handlers, no SSR. Unknown paths are rewritten to `index.html` by Hosting.
- Security headers and the SPA rewrite moved from `next.config.ts` into
  `firebase.json`; `node scripts/seed.mjs` and `clear-data.mjs` moved to the API
  repo (service-account work); `firebase-admin` is no longer a dependency here.
- Sign-in moved server-side to satisfy one rule: the Director tab must never hand a
  session to a staff account that happens to have email/password credentials.
  Previously the client called `signInWithEmailAndPassword` directly and role guards
  bounced drivers out; now the server rejects the wrong role and the login page
  points drivers to the code tab. Session shape is unchanged.
- `/dashboard/analytics` was a page and became a modal in Reports; the old URL is a
  redirect.
- The dashboard's guard was `RequireRole role="director"`; it is now
  `RequireAccess` + per-route `RequireScreen`, so operators can be granted individual
  screens.
- A multi-day attendance trend lived in the Analytics modal for a day and was
  removed on request (two stacked sections, each with its own date range, read as
  confusing). `useAttendanceTrend` remains, unused, for a range view that may return.
- The Students screen used to carry a date picker that switched it into a per-day run
  view. That was removed: it made the roll a second Reports, and a single day is
  already answered per bus (Live monitor) and per class (Reports).

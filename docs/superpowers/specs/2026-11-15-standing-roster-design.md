# The standing roster — design

Date: 2026-11-15
Branch: `feat/standing-roster`
Status: awaiting approval

## Intent

A school's roster is a fact about the **school year**, not about the day. Classes
and bus assignments are set when the year's sheet arrives, and they change only
when somebody changes them — in Assignments, or by uploading a corrected sheet.
Everything else is a record of what happened on a particular day.

Today the app treats the day as the unit of the roster, and the consequence is
that the roster is a copy that has to be rebuilt every morning by a human:

- A director presses **Dispatch vehicle** (`DispatchModal.tsx:101`), which writes
  one `runs/{busId}-{date}-{segment}` document plus one
  `attendance/{runId}__{studentId}` document **per student on that bus**, copying
  `studentName`/`grade` and setting `WAITING`.
- The driver's phone reads only those copies
  (`useRunRoster`, `school-data.ts:265-299`). It never reads `students`.
- No dispatch that day → the driver sees "No run dispatched"
  (`MobilePage.tsx:126`) and cannot record anything at all.
- A bus move made today reaches **no** sheet that was already dispatched:
  `assignStudentToBus` documents "applies to future runs"
  (`school-admin.ts:522`), and a re-dispatch is refused because the run exists
  (`DispatchModal.tsx:103-107`).

So the roster is not merely duplicated; it drifts. The source of truth
(`students.busId`) is already edited where a human would edit it, and the daily
press only copies that answer. This design removes the copy:

**The driver's list becomes the standing roster — `students where busId == my
bus` — and today's records layer on top of it.**

Three things follow, and they are three independent slices:

1. **The dashboard renders immediately**, zeros and empty routes, and fills in
   from the live snapshots it already has.
2. **A re-uploaded sheet is the year's truth**: children missing from it are
   archived, never deleted.
3. **The driver's roster stands**, so there is nothing to dispatch each morning.

## Goals

- A driver opening the app on any school day sees every child on their bus,
  without a director having pressed anything.
- A change made in Assignments or by a sheet import is visible to the driver and
  the director immediately — not tomorrow.
- A school with no data yet sees an honest empty dashboard, and it fills itself
  in when data arrives.
- "The sheet is the truth" is expressible, and its most dangerous outcome
  (retiring a real child by typo) is named before it happens and is reversible.

## Non-goals

- **No afternoon driver screen.** The phone is morning-only by design
  (`ROSTER_RUN_TYPE`, `school-data.ts:41`). The afternoon segment keeps its
  manual dispatch.
- **No new realtime transport.** `onSnapshot` already is the persistent
  server-push channel; SSE/WebSocket would duplicate it and lose the IndexedDB
  cache and the durable write queue.
- **No rename from a sheet.** A sheet carries no id; a changed spelling is a
  different name, and today it silently creates a second child
  (`sheet-import.ts:811`). Renaming stays a Students-screen edit.
- **No delete path from the import.** `allow delete` on `students` stays
  director-only and unused by the import.
- **Reports, the roll summary and history stay record-based.** A past day is
  answered by records, not by today's roster; making them roster-based would
  change what a percentage means.

## Anti-goals

- A daily press replaced by an unattended job that writes N rows per bus per day
  — the copy would survive, only hidden.
- A dashboard that shows zeros by lying about "no data" while a query is still
  in flight; the empty state must be the *answer*, not a placeholder.
- An archive that cannot be undone from the app.

## What exists today (the constraints this design is built on)

- **Rules — staff hold no read grant at all.** `students` is gated on
  `canSeeStudents()`, `buses` on `canSeeBuses()`, `runs` and `attendance` on
  `canSeeRuns()` (`firestore.rules:95-118`, `257`, `278`, `307`, `335`), and none
  of those helpers admits `isStaff()`: the only staff branches in the whole file
  are the two write branches (`311`, `339`). Against this ruleset the driver's
  **current** screen cannot resolve its own bus (`useDriverBus`), read its run
  document, or read today's sheet — so either the deployed ruleset predates
  `57cc61a` (which added `canSeeRuns`), or the driver screen is dead in
  production right now. Only the deployment can answer that; Slice 0 settles the
  code either way.
- A driver-created `attendance` document may carry only
  `busId, status, boardedAt, droppedOffAt` + stamps (`firestore.rules:345-347`) —
  not `runId`, `date`, `studentName`, `grade`. A driver **may** create a `runs`
  document with `busId, runType, date, status` + stamps (`firestore.rules:319-321`),
  bounded by `staffsOwnBus`.
- **Provenance is mandatory.** Every write to `students`, `attendance`, `runs`
  must set `updatedBy == request.auth.uid` and `updatedAt == request.time`
  (`firestore.rules:145-148`).
- **Counts are row-derived.** Dashboard `total` is the row count
  (`school-data.ts:1032`) and so is Reports' `assigned` (`school-data.ts:1553`).
  A child with no record is absent from the denominator, not counted as
  unaccounted.
- **The dashboard's skeleton is a gate, not a missing transport.** `loading` is
  `loadedKey !== key`, and `loadedKey` is only set by an authoritative snapshot or
  the 10 s ceiling (`school-data.ts:872`, `958-961`;
  `firestore-loading.ts:26-41`). Once set, the listeners stay open
  (`school-data.ts:903,919,935`), so new data already arrives without a reload.
  Both real blocks already have honest empty states (`FleetList.tsx:79`,
  `Summary.tsx:141`).
- **A sheet row carries name, class and bus, and nothing else**
  (`sheet-import.ts:35`). The import compares class and bus only; it never
  rewrites a name (`sheet-import.ts:789-800`) and never removes a child.
- **Deleting a student is director-only** (`firestore.rules:262`). A student's
  `grade`/`busId` may be written by the Students and Assignments grants.

## Approaches considered

**1 · Read the roster live (chosen).** The driver's list is `students where
busId == my bus`; the first tap creates the run and that child's record. The
dashboard counts the roster alongside records, so an unrecorded child reads as
*unaccounted* instead of vanishing. Reports, the roll summary and history stay
record-based.

*Why this one:* it makes staleness impossible rather than repaired, keeps "who
should be here" in exactly one place (`students.busId`), and deletes the daily
press instead of automating it. Its cost is one rules change plus a rewrite of
one hook, both bounded.

**2 · Auto-materialise on open.** Keep the row model untouched; on the driver's
first open of the day, write the run and one row per child, reconciling adds and
moves.

*Why not:* it still needs the same rules change (the driver must read `students`
to know whom to write), it writes N documents per bus per day for children nobody
recorded, and a day whose driver never opens the app still shows zero children on
the dashboard. It automates the press instead of deleting it.

**3 · Let the API materialise it.** A privileged endpoint writes the day's rows
and the driver never reads `students`.

*Why not:* the driver's morning list would depend on a round-trip to a service
that answers 503 in production today, so a bus in a dead zone would have no
roster at all. It trades offline-first for a permission we can grant in the
rules, and it contradicts the repo's one architectural rule.

## Decision A — the driver's roster stands

`useRunRoster` reads two live sources instead of one:

- `students where busId == {my bus}`, filtered client-side to `archived != true`
  (absent means active — a `where("archived","==",false)` would drop every
  existing document);
- today's `attendance where runId == {busId}-{today}-morning`, merged by
  `studentId` (the doc id's suffix after `__`, as today at
  `school-data.ts:281-284`).

A child with no record renders as "no record yet" — the state the UI already
shows as the **Board** pill. The list is sorted by name, as today.

**Writing.** `cycleStatus`, `markAbsent` and `completeRun` write the run document
if it is missing, in the **same batch** as the attendance write:

```
runId  = `${busId}-${date}-morning`
run    = { busId, runType: "morning", date, status: "IN_PROGRESS", ...stamp }
att    = { runId, date, busId, busName, studentName, grade,
           status, boardedAt, droppedOffAt, ...stamp }
```

`completeRun` needs one change it did not need before. It already writes the full
run document before completing and already marks every still-unrecorded child
ABSENT (`school-data.ts:395-416`), but that ABSENT write carries only
`{ status, updatedBy, updatedAt }` with `merge: true`. On a child with no row
that is a **create**, which the new allowlist would refuse — and under a standing
roster that is now the common case, not the edge. Each ABSENT write must carry
the full row shape the create branch expects (`runId`, `date`, `busId`,
`busName`, `studentName`, `grade`).

Creating the run document on first tap is deliberate: it preserves the existing
invariant that **a run document means "this bus is running today"**, which the
live monitor's fleet filter depends on (`school-data.ts:1042-1045`). Without it,
a bus whose driver started recording would be missing from the monitor.

**The "No run dispatched" state is deleted.** `MobilePage` no longer branches on
`runExists` (`MobilePage.tsx:126`, `165-170`), and `TopAppBar` loses the prop. A
bus with no children on it gets its own empty state (new keys, below), because
"no children assigned" and "not dispatched yet" are no longer the same thing.

**"Roster, but no run yet" is the normal morning**, and the design has to say what
it looks like rather than leave it to the builder:

- the app bar shows the bus and its children. There is no run status and no
  manifest rail tick until the first write creates the run document, because
  "In progress" over a run nobody started is a claim about a day that has not
  begun;
- the **Complete run** bar stays available whenever the roster has somebody on
  it, not gated on `runExists`. It is the only way to sign off a day on which
  nobody was recorded, and `completeRun` creates the run document itself;
- a run that exists and is `COMPLETED` keeps today's behaviour: the roster is
  read-only.

**Dispatch survives for the afternoon only.** The modal's run-type control is
pinned to `afternoon` (the morning is now the standing roster), and
`hint.dispatch.body`, which promises that dispatching "pre-registers that bus's
students", is rewritten — it would otherwise describe a step the product no
longer has. A morning dispatch left available would let a director recreate the
per-child copy this design exists to delete.

**A child moved away mid-day** disappears from the driver's list immediately
(the query is bus-scoped) but his record, if he was recorded, stays in that run's
attendance. That is correct: the record says he rode that bus this morning, and
history must not be rewritten because the office moved him at noon.

## Decision B — the dashboard renders empty, immediately

`useDashboardData` settles on its **first** attendance snapshot: the
`settlesLoading(...)` guard at `school-data.ts:958-961` is dropped, so an empty
day is an answer rather than a reason to keep the skeleton up. The error
callback and the 10 s ceiling stay as they are.

Nothing else on the dashboard changes: `!loading` already yields zeros in the
summary, `dashboard.noRoutes` in the fleet list, and the empty finding. A
sub-second flash of zeros before a warm cache lands is possible and accepted; the
guard existed to prevent it, and it was preventing the honest empty state too.

**The summary also counts the roster**, behind an explicit opt-in. The hook serves
Live *and* Reports (`DashboardPage.tsx:28`, `ReportsPage.tsx:53`), so an
unconditional union would silently turn Reports into a roster view. Live passes
the flag; Reports does not. With the flag on, each active child who is on a bus
with a run of the selected segment and has no record is added to `total` and
`waiting`:

- **only the live day** — the flag is passed only when the selected date is
  today (`date === null || date === todayDateStr()`). A past date stays
  record-based: reviewing last Monday must not show today's roster as
  unaccounted for that day;
- **only children with a `busId`** — a child on no bus rides no run, so counting
  him would make `total` exceed the sum of the per-bus totals;
- a child with no record counts as **unaccounted**, which is the app's existing
  meaning for "waiting is the absence of a status";
- `waiting` is never displayed as a word — it feeds `unaccounted` and the KPI
  footer (`school-data.ts:1037`, `1122-1126`), so the existing copy holds;
- per-bus `progress`, `waiting` and `total` get the same treatment, so a bus is
  never 100% because nobody has opened the app yet.

This is the smallest honest union: it answers "who should be here and who is
not accounted for" without redefining what a completed day's percentage means.

## Decision C — the sheet is the truth, and removal is archived

`students` gains a boolean `archived`. Absent means active. It is set only by a
sheet import; nothing else writes it.

**Import behaviour.** After the existing plan is built
(`sheet-import.ts:720-801`), the import computes the **archive set**: every active
child whose `nameKey` appears in no sheet row. The preview names them (name and
class) above the existing tallies, and Apply writes, in batches of ≤400:

- `archived: true` for each child in the archive set, stamped, and one
  `student.archived` audit entry each — retiring a child is a decision about
  that child, not a count;
- `archived: false` for any archived child the sheet names again (a returning
  child comes back), with `student.restored`;
- the existing corrections and creations, unchanged, plus the existing single
  `students.imported` summary entry.

**What a blank cell means.** Blank keeps meaning *no opinion*, everywhere
(`sheet-import.ts:758`, `799`). A sheet never unassigns a bus: an earlier draft
promised an explicit token (`none`) for that, and it was dropped during
implementation — a token in a column otherwise full of bus names reads as a bus
name, and unassigning a child who still rides to school is a per-child decision,
not a column-wide one. Unassigning stays an Assignments-screen action, where the
row already offers "no bus". Writing `none` in a bus cell therefore reports the
row as an unknown bus, which is the honest outcome. A blank class on an
existing child is no opinion; on a new child it is still reported, not created.

**Archiving also clears the bus.** The archive write is
`{ archived: true, busId: null, ...stamp }`. That is not tidiness: it makes the
two paths that *cannot* express "absent means active" correct by construction —
the driver's roster query (`where busId == my bus`) never matches him, and the
per-bus counts, which are `getCountFromServer` queries and cannot filter a
missing field (`school-admin.ts:435-474`), stop counting him without pretending
`archived == false` exists on every document.

**Hooks stay complete; screens filter.** `useSchoolRoll` also supplies the names
the Activity log resolves student ids against (`ActivityPage.tsx:60`,
`103-106`), and `fetchAllStudents` is the list the import matches a returning
child against (`AssignmentsPage.tsx:166-177`). Filtering inside either would
render an `student.archived` entry as "Removed student" and would create a
returning child a second time. Both hooks return every child, and the **screens**
apply `archived != true`: the roll, the Assignments list, the dashboard union and
the driver's roster.

**One toggle, one Restore.** The roll toolbar gains **Show archived (N)**;
archived rows render with an `Archived` chip and a **Restore** action, which
writes `archived: false` and leaves `busId` alone — the next sheet, or the
Assignments screen, puts him back on a bus. Without that toggle, archiving is a
one-way door only another sheet import could open.

**Who can run rollover.** The import lives on the Assignments screen, so reaching
it needs that grant; the archive half needs Students. An operator holding one
grant gets exactly that half — the dialog already states which writes it cannot
make and omits that half (`SheetImportDialog.tsx`) — so rollover is a two-grant
job by design, not by accident.

**History is untouched.** Archive writes no attendance document and deletes
nothing, so every past day still resolves by id. Names are still the only key in
a sheet, so a corrected spelling remains a manual Students-screen edit.

## Rules changes (all in `firebase/firestore.rules`)

Slice 0 comes first: **the driver's own reads**, which the file does not grant at
all today. Then the two write shapes this design needs.

**Slice 0 — the driver may read his own bus, its runs and its rows.**

1. `buses`:

   ```
   allow read: if isMySchool(schoolId) && (
     canSeeBuses()
     || (isStaff() && resource.data.driverUid == request.auth.uid))
   ```

   `useDriverBus` already queries `buses where driverUid == uid`, so the rule's
   field is the queried field and no `get()` is involved.

2. `runs`:

   ```
   allow read: if isMySchool(schoolId) && (
     canSeeRuns()
     || (isStaff() && staffsOwnBus(resource.data.busId)))
   ```

   The driver reads exactly one run document by id (`school-data.ts:302`), so this
   is a single-document evaluation.

3. `attendance` — and this one may change the driver's **query**, because rules
   are not filters: a rule that constrains `busId` cannot authorise a query that
   only compares `runId`. Two shapes work; the emulator decides which ships:

   - **by bus:** rule
     `isStaff() && resource.data.busId != null && staffsOwnBus(resource.data.busId)`
     with the query `where("busId","==",busId).where("runId","==",runId)`. Two
     equality filters need a **composite index**, so this adds an entry to
     `firebase/firestore.indexes.json` and a `deploy:indexes` step.
   - **by run, checking the run:** rule
     `isStaff() && staffsOwnBus(get(/databases/$(database)/documents/schools/$(schoolId())/runs/$(resource.data.runId)).data.busId)`
     with today's query unchanged. One cached `get()` per evaluation, no index
     change.

   Prefer the second if the emulator proves it: the query and the indexes stay as
   they are. Whichever ships, add an emulator test (`firebase emulators:exec`)
   that signs in as a driver and runs that exact query. This is the one change
   here that fails in a way a typecheck and a build never see, and the last rules
   bug of this shape took the dashboard down in production.

4. `students`:

   ```
   allow read: if isMySchool(schoolId) && (
     canSeeStudents()
     || (isStaff() && staffsOwnBus(resource.data.busId)))
   ```

   `staffsOwnBus` resolves the same `buses/{busId}` path for every document in one
   query and rules cache a `get()` for the evaluation, so this costs one read per
   snapshot, not one per child. An archived child has no `busId`, so the rule
   keeps him off the driver's list without a filter.

**Then the write shapes this design needs.**

5. `attendance` create by staff: widen the allowlist to the fields a lazily
   created row carries, and pin the copy to the child's run.

   ```
   : request.resource.data.keys().hasOnly([
       'runId','date','busId','busName','studentName','grade',
       'status','boardedAt','droppedOffAt','updatedBy','updatedAt'])
     && request.resource.data.runId
        == request.resource.data.busId + '-' + request.resource.data.date + '-morning'
     && request.resource.data.studentName is string
     && request.resource.data.grade is string
     && request.resource.data.busName is string
     && request.resource.data.date is string
   ```

   The update branch is unchanged: once the row exists, a driver may still only
   move the status and its two timestamps.

6. `students` update: add `archived` (and the `busId: null` that archiving
   carries) to the operator-with-Students allowlist and to the union allowlist
   held by Students+Assignments, so a secretary can run rollover without the
   directorship. `delete` stays director-only.

7. `auditEventAllowed()`: add `student.archived` and `student.restored` for a
   caller holding Students.

**Accepted residue.** Rules cannot split a document id, so they cannot prove
that `{runId}__{studentId}` names a child who is on that bus: a driver could
create a row on their own run naming another bus's child. The blast radius is
their own bus's day, the write is stamped, and it is deletable only by a
director. Pinning `busId` to the caller's own bus (already enforced) is the
bound that matters. Likewise a driver may create a run document for a date other
than today; it carries no records and is inert.

## Copy and audit additions

New dictionary keys, in `en`, `ar` **and** `fr` (all three, typed as `Messages`):

- `mobile.noStudentsTitle`, `mobile.noStudentsBody` — the bus has nobody on it.
- `import.archiveTitle`, `import.archiveBody`, `import.archiveNone`,
  `import.unassignToken` — the preview section and its empty state.
- `studentList.showArchived`, `studentList.archivedChip`,
  `studentList.restore`, `studentList.restored` — the roll's toggle and row.
- `activity.event.studentArchived`, `activity.event.studentRestored` — the log.
- `toast.archived`, `toast.restored` — the confirmations.

Audit vocabulary: `student.archived` and `student.restored` in `AuditEvent`,
`EVENT_FAMILY` (`"roll"`) and `EVENT_LABEL_KEY` (`src/lib/audit.ts`).

## Slices, each independently shippable

0. **The driver's read grants.** Rules 1–4 above, plus an emulator test that signs
   in as a driver and runs the roster, run-document and bus queries. Verify:
   `firebase emulators:exec` matrix passes; a driver on the deployed ruleset can
   read own bus, run and rows. **Ship this even if nothing else ships** — if the
   committed ruleset is what production runs, the driver screen is broken today
   and this is the fix.

1. **The dashboard renders empty immediately.**
   Drop the guard at `school-data.ts:958-961`; keep the error path and the
   ceiling. Verify: `npm run typecheck && npm run lint`, then a date with no data
   renders zeros + `noRoutes` at once, and a warm offline reload still shows
   content.

2. **Archiving and the truth-shaped import.**
   `archived` in the type, rules 6 and 7, the archive set and preview in
   `sheet-import.ts` + `SheetImportDialog`, the audit entries, the screen filters,
   the roll's toggle and Restore. Verify: `npm run typecheck`, `npm run lint`,
   `npm run build`, and a re-upload with one child removed archives exactly that
   child, names him in the preview, and leaves the Activity log's names intact.

3. **The standing roster.**
   Rules 5; `useRunRoster` rewritten onto `students` + today's records with the
   lazy run create; `completeRun` writing the full row shape; `MobilePage` losing
   the dispatch empty state, the app bar and Complete-bar rules above;
   `TopAppBar` losing `runExists`; the dashboard union from Decision B; the
   dispatch modal pinned to the afternoon and its hint rewritten. Verify:
   typecheck, lint, build, `npm run test:offline`, plus a manual pass — a driver
   with a warm cache and no signal sees the roster and can record; a child moved
   in Assignments appears on the driver's bus immediately; `completeRun` on a day
   nobody touched marks every child absent and creates the run.

Slices 1 and 2 do not touch the driver's path; slice 3 needs 0 to work at all and
2 only for the `archived` filter, which it filters for from the start.

## Call made on your behalf, and checkable

- **The import defaults to "the sheet is the whole roster"** when the sheet has
  all three columns and the roster is non-empty. The preview is the guard: it
  names every child to be archived, by name and class, before Apply. If you would
  rather the toggle start off, that is one line — say so.
- **Archiving also clears the bus.** Leaving `busId` on an archived child would
  make the per-bus counts and the driver's roster wrong in a way no filter can
  fix cheaply. Restoring leaves the bus empty; the next sheet assigns it.
- **Archived children are hidden from every screen list, including the driver's**,
  but not from the hooks — the Activity log still resolves their names and the
  import still recognises a returning child.
- **`runExists` disappears**, and with it "No run dispatched". The Complete bar
  is available as soon as the roster has somebody on it, because signing off a
  day nobody was recorded on is the one thing it can still do.
- **Dispatch is pinned to the afternoon.** Its hint currently promises that
  dispatching pre-registers the bus's students; it is rewritten.

## Left to the builder

- Where the "no children on this bus" empty state sits relative to the offline
  banner, and whether it offers anything to do.
- The exact placement of the Show-archived toggle in the roll toolbar (the
  toolbar already carries search, class and a clear action).
- Whether the bus sheet's numbered "Off" column needs an unrecorded child row at
  all — today it lists only existing records.
- The copy for every new key, in three languages, and the English currently in
  `hint.dispatch.body` in all three.

## Open question for the product owner

**Is the deployed ruleset the one in this repo?** The committed file grants staff
no read at all (see "What exists today"), so a driver signing in against it can
resolve neither their bus nor their sheet. Either the deployment predates
`57cc61a`, or the driver screen is broken in production now. The code path is the
same either way — Slice 0 grants what the screen needs — but knowing which it is
tells us whether to treat Slice 0 as a fix that ships this week.

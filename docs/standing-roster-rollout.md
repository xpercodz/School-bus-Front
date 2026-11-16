# Standing roster — what shipped and how to roll it out

The branch merged into `dev` on 2026-11-15 as `42b7fad` (plus `b373abe`, the
fleet fix). The design is `docs/superpowers/specs/2026-11-15-standing-roster-design.md`
and the task-by-task plan is `docs/superpowers/plans/2026-11-15-standing-roster.md`.
This page is the short version: what changed for a user, the decisions a future
reader would otherwise re-derive, what was deliberately left, and the order to
deploy in.

## What a user sees

- **The driver's list stands.** It is `students where busId == my bus`, merged
  with today's `attendance` rows; a child with no row is the neutral **Board**
  action and the first tap creates the run document and that child's row in one
  batch. There is no per-day dispatch for the morning and no "No run dispatched"
  screen. A bus move in Assignments, or a sheet import, reaches the driver
  immediately.
- **The dashboard renders at once**, empty included, and fills in from the
  snapshots it already holds. On the live day only, it counts children nobody
  recorded as **unaccounted** — per bus and in total — and the bus sheet lists
  those children, so "12 unaccounted" opens to twelve names.
- **A re-uploaded sheet is the year's truth.** A child the sheet no longer names
  is **archived** (off every list, attendance history intact, bus cleared), a
  returning child is restored, and the preview names both directions before
  Apply. Nothing is deleted.
- **The import's column list shows only what maps**, with the rest behind one
  line, and the matcher now reads French and Arabic headers.
- **Dispatch is the afternoon's** — the phone is morning-only — and its hint says
  so.

## The four decisions a reader must not re-derive

1. **`runExists === false` gates the run write, never `runStatus === null`.**
   `null` means "no snapshot has said", not "no run". A listener the rules denied
   is not evidence of an absent run, and writing the run on that assumption
   reopens a signed-off day.
2. **The identity fields ride a create only** (`runId`, `date`, `busId`,
   `busName`, `studentName`, `grade`). On an existing row the rules admit only
   `status`, its two times and the stamps — so a bus rename or a mid-day class
   correction must not put those fields back in the update.
3. **Archiving is `archived: true` + `busId: null`, and the rules admit exactly
   that pair** (plus a restore branch that carries no bus). The bus is cleared
   because the per-bus counts and the driver's roster then exclude the child
   without a filter the rules cannot express.
4. **The union counts a child once, under the bus he rode.** The recorded set
   spans every bus of the segment on purpose: a child recorded on A and moved to
   B is accounted for, not unaccounted on B. Narrowing it per bus would count him
   twice and make the day's total larger than the number of children in it.

## Deploy order

1. `npm run deploy:indexes` — the roster's attendance read filters `busId` **and**
   `runId`, and needs the composite index.
2. `npm run deploy:rules` — before this branch, `staff` had **no read grant at
   all**; the driver's screen is dead until the rules land.
3. `npm run deploy` — hosting.

Deploying the rules before the index leaves the roster failing on a missing
index, which is the one order that produces a driver screen that loads nothing.

## The manual pass no test covers

There is no harness for a Firestore hook and no emulator run in CI, so these are
the checks that only a browser can make:

- **Rules simulator**: a staff `get` on a run document that does not exist must
  be **allowed** and report `exists:false`; a staff `list` of runs must be
  denied.
- **Driver, fresh day**: no status line until the first tap; the first tap shows
  "In progress"; Complete locks the roster and the bar; a tap after Complete
  changes nothing and shows no banner; a reload reads "Completed".
- **Driver, offline**: warm cache, kill the network, reload → the roster; a tap
  survives the reload; Complete marks every unrecorded child absent.
- **Monitor**: a bus with children and an unopened run reads 0% with them
  unaccounted; a past date shows records only; the bus sheet lists the same
  children its count describes.
- **Import**: omit a child (named in the preview, archived by Apply, named in the
  Activity log); a returning child (restored, no bus); a French `Élève/Classe/Bus`
  sheet with no manual mapping; a failed roll read keeps the dialog shut.

## Deliberately left

- **The driver's history sheet** reads attendance by `studentName`, which the
  staff read rule cannot authorise (it proves on `busId`) — it shows "no
  records". Needs a query change and one composite index.
- **Per-child archive/restore audit entries** are written after the batches
  rather than inside them, and the fan-out is unbounded. Both want a
  chunk-scoped rewrite.
- **`assignStudentToBus` / `assignDriverToBus`** still resolve silently when the
  school id cannot be read, so the Assignments toast can claim success for a
  write that did not happen. Same family as the two calls this branch fixed;
  pre-existing.
- Two cosmetics: a corrected-and-restored child appears twice in the import
  strip; one comment in `firestore-loading.ts` is imprecise.

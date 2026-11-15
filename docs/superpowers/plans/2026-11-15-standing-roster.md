# The Standing Roster — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the driver's list the standing per-bus roster, let the dashboard render an honest empty state immediately, and let a re-uploaded sheet archive the children it no longer names.

**Architecture:** The driver's roster stops being a per-day copy written by a director and becomes a live read of `students where busId == my bus`, with today's `attendance` rows merged in by student id; the first tap creates the run document and that child's row. A sheet import stays the way a roster arrives, but gains an archive set (children it no longer names) behind a preview. Removal is a flag plus a cleared bus, never a delete.

**Tech Stack:** React 19 + React Router SPA, TypeScript, Firestore client SDK (persistent/offline cache), Firebase security rules, `node --test` for pure logic.

**Spec:** `docs/superpowers/specs/2026-11-15-standing-roster-design.md`

## Global Constraints

- Work in `.worktrees/standing-roster` on branch `feat/standing-roster`.
- Every user-facing string is a key in `src/lib/i18n/dictionaries/en.ts`, `ar.ts` **and** `fr.ts`. Missing keys fail `tsc --noEmit`. Follow `docs/i18n-glossary.md` (élève, conducteur, trajet, présence).
- A count-bearing string uses `tp(key, count, vars)`; pass the raw number and `toLocaleDigits` for display.
- Every write to `students`, `attendance`, `runs` must set `updatedBy` and `updatedAt: serverTimestamp()` (`stamped()` in the rules refuses otherwise).
- Never hardcode a colour or a control: actions are `@/components/arc/button/button`, value selectors are `@/components/arc/dropdown-menu/dropdown-menu`, search fields are `@uiarc/expanding-search`.
- Reads and roster writes go straight to Firestore. Nothing new goes through the API.
- `archived` absent means **active**. Never write `archived: false` on a child who never had it.
- Blank cell means **no opinion**. Unassigning requires the explicit token `none` / `no bus` / `aucun` / `بدون`.
- No delete path for a student from any new code.
- Verify every task with `npm run typecheck && npm run lint`; UI tasks also `npm run build`. Final gate: `npm run build && npm run test:offline`.
- Commit at the end of every task, conventional message.

## Review Focus

These are the inputs and conditions most likely to bite a real user. Each has a test or an explicit observation step in the task that owns the code.

1. **A sheet with no name column, or no data rows** — must archive nobody. A reader that cannot see the roster is not a statement that the roster is empty.
2. **A row that matched a child but was reported** (unknown bus, missing class) — that child must not be archived; his row was rejected, not his enrolment.
3. **A blank bus cell on a re-upload** — the child keeps his bus. Only the explicit token unassigns.
4. **A driver opening the app offline on a phone that never cached the roster** — an empty state that says so, never a silent empty list.
5. **A tap on a run already signed off** — refused, roster read-only, no error banner; and a child moved to another bus after being recorded stays in that day's record while dropping off the driver's list.
6. **An import run by a Students-only operator** (no Assignments) or an Assignments-only one — each gets exactly the half their grant allows, and the dialog says which half it is omitting.
7. **A past date selected on Reports** — record-based numbers, no roster union.

*Deliberate limitation:* `buildAssignmentPlan` stays in `sheet-import.ts`, which imports Firebase, so `node --test` cannot load it. Only the extracted archive-set decision is unit-tested; the plan builder's behaviour is covered by manual observation steps. Do not move Firebase imports out of `sheet-import.ts` to enable this — that is a refactor nobody asked for.

---

### Task 1: Rules — the driver may read their own bus, and rows may be created lazily

**Files:**
- Modify: `firebase/firestore.rules` (`canSeeBuses`, `canSeeRuns`, the `/students`, `/buses`, `/runs`, `/attendance` matches, `auditEventAllowed`)

**Interfaces:**
- Consumes: `staffsOwnBus(busId)` (already exists, `firestore.rules:132-136`), `stamped()` (`:145-148`).
- Produces: staff read access used by Task 8; the widened attendance create shape written by Task 8; the `archived` update grant written by Task 5/Task 7; two audit event names written by Task 5.

- [ ] **Step 1: Add staff read grants**

`/buses`: `allow read: if isMySchool(schoolId) && (canSeeBuses() || (isStaff() && resource.data.driverUid == request.auth.uid));`

`/runs`: `allow read: if isMySchool(schoolId) && (canSeeRuns() || (isStaff() && staffsOwnBus(resource.data.busId)));`

`/attendance`: `allow read: if isMySchool(schoolId) && (canSeeRuns() || (isStaff() && resource.data.busId != null && staffsOwnBus(resource.data.busId)));`

`/students`: `allow read: if isMySchool(schoolId) && (canSeeStudents() || (isStaff() && staffsOwnBus(resource.data.busId)));`

- [ ] **Step 2: Widen the staff attendance-create allowlist**

In the attendance create branch only (the update branch and its `diff().affectedKeys()` stay exactly as they are), replace the `hasOnly` list with:

```
['runId','date','busId','busName','studentName','grade',
 'status','boardedAt','droppedOffAt','updatedBy','updatedAt']
```

and add, beside the existing `status in [...]` check:

```
&& request.resource.data.runId
   == request.resource.data.busId + '-' + request.resource.data.date + '-morning'
&& request.resource.data.date is string
&& request.resource.data.studentName is string
&& request.resource.data.grade is string
&& request.resource.data.busName is string
```

- [ ] **Step 3: Allow `archived` where Students is granted**

In the `/students` update rule, add `'archived'` to the Students allowlist (`['name','grade','archived','updatedBy','updatedAt']`) and to the Students+Assignments union allowlist. The Assignments-only allowlist (`busId` only) stays without it. `delete` stays `isDirector()`.

Then add one **separate branch** beside the existing ones, because an archive write sets `archived` and clears the bus in the same update and the Students allowlist cannot carry `busId`:

```
|| (can('students')
  && request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['archived', 'busId', 'updatedBy', 'updatedAt'])
  && request.resource.data.diff(resource.data).affectedKeys()
    .hasAll(['archived'])
  && request.resource.data.archived == true
  && request.resource.data.busId == null)
```

All four conditions are load-bearing:

- `hasOnly` bounds the fields;
- `hasAll(['archived'])` forces the write to *touch* `archived`, so a bus move alone — or a bus move on a child who is already archived — cannot ride this branch;
- `archived == true` keeps the branch to archiving, so restoring a child cannot also assign him a bus;
- `busId == null` means the branch admits exactly one shape: archived **and off the bus**. `{archived: true, busId: 'busY'}` is an archive plus an assignment, and an assignment is the Assignments grant.

A restore is not an archive: `setStudentArchived(…, false)` writes only `archived` + stamps and is admitted by the Students allowlist, which cannot carry `busId`.

- [ ] **Step 4: Allow the two new audit events**

In `auditEventAllowed()`, add `student.archived` and `student.restored` to the branch that admits a caller with `can('students')`.

- [ ] **Step 5: Verify in the rules simulator**

Deploy nothing. Open the Firebase console → Firestore → Rules, paste the file, then use the Simulator with an authenticated `staff` user whose profile has `role: 'staff'` and a `schoolId`, and run these five simulations. Expected:

1. `get` `schools/{id}/buses/{busOfThatDriver}` → **allowed**.
2. `list` `schools/{id}/attendance` where `busId == 'busX'` **and** `runId == 'busX-2026-11-15-morning'` → **allowed**, and every returned row is that driver's bus.
3. `get` `schools/{id}/runs/{runOfThatBus}` → **allowed**.
4. `list` `schools/{id}/students` where `busId == 'busX'` → **allowed**.
5. same list without the `busId` filter → **denied**.

**Ruled after Task 1 (R5):** the rule stays as written — `resource.data.busId` with `staffsOwnBus` — and the **query** gains the matching `busId` filter in Task 8, with a composite index. Do not switch to a `get()`-on-runs rule: whether Firestore proves a `get()` inside a list query is the one thing here nobody can verify without an emulator, and a missing index fails loudly at the query while a denied list fails silently in the driver's hands.

- [ ] **Step 6: Commit**

```bash
git add firebase/firestore.rules
git commit -m "feat(rules): let a driver read their own bus, and create a day's row lazily"
```

---

### Task 2: The dashboard settles on its first snapshot

**Files:**
- Modify: `src/lib/school-data.ts:958-961`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useDashboardData(...).loading` false as soon as the attendance snapshot lands, for every caller. No signature change.

- [ ] **Step 1: Drop the guard**

Replace the `if (settlesLoading(...)) { setLoadedKey(...) }` block with an unconditional `setLoadedKey(\`${uid}|${effectiveDate}\`)`, keeping its comment replaced by one that says the first snapshot *is* the answer and the ceiling below still guards a query that never lands. Keep the error callback and `LOADING_SETTLE_TIMEOUT_MS` exactly as they are. Do not touch `settlesLoading` itself — three other hooks use it.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 3: Observe**

In `npm run dev`, sign in as a director whose school has no attendance for the selected day, with the date set to a day with no data.
Expected: zeros in the summary and `dashboard.noRoutes` in the fleet list within about a second — no skeleton left standing. Then reload offline with a warm cache.
Expected: the same content, not a skeleton and not a blank page.

- [ ] **Step 4: Commit**

```bash
git add src/lib/school-data.ts
git commit -m "fix(dashboard): the first snapshot is the answer, empty included"
```

---

### Task 3: `archived` on the student, and the archive decision as a pure function

**Files:**
- Create: `src/lib/sheet-archive.ts`
- Create: `tests/sheet-archive.test.ts`
- Modify: `package.json` (add `test:unit`)
- Modify: `src/lib/school-admin.ts` (`AdminStudent` type, line 338)

**Interfaces:**
- Produces:
  - `interface ArchiveCandidate { id: string; name: string; grade: string }`
  - `function buildArchiveSet(active: readonly ArchiveCandidate[], matchedIds: ReadonlySet<string> | null): ArchiveCandidate[]`
  - `AdminStudent` gains `archived?: boolean`.
- Consumed by Task 4 (`buildAssignmentPlan` calls `buildArchiveSet`) and Task 7 (the roll filters on `archived`).

- [ ] **Step 1: Write the failing test**

`tests/sheet-archive.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArchiveSet } from "../src/lib/sheet-archive.ts";

const ada = { id: "s1", name: "Ada", grade: "4A" };
const bo = { id: "s2", name: "Bo", grade: "4A" };
const cy = { id: "s3", name: "Cy", grade: "4B" };

test("archives a child the sheet no longer names", () => {
  const out = buildArchiveSet([ada, bo, cy], new Set(["s1", "s2"]));
  assert.deepEqual(out.map((c) => c.id), ["s3"]);
});

test("keeps a child the sheet matched, even if his row was reported", () => {
  // A row rejected for an unknown bus still names him: his place on the
  // roster was not questioned.
  const out = buildArchiveSet([ada, bo], new Set(["s1", "s2"]));
  assert.deepEqual(out, []);
});

test("archives nobody when the sheet could not be read as a roster", () => {
  assert.deepEqual(buildArchiveSet([ada, bo], null), []);
});

test("returns the full child, so the preview can name him", () => {
  const out = buildArchiveSet([ada], new Set());
  assert.deepEqual(out, [{ id: "s1", name: "Ada", grade: "4A" }]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/sheet-archive.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/sheet-archive.ts'`.

- [ ] **Step 3: Implement `src/lib/sheet-archive.ts`**

One exported type — `ArchiveCandidate`, as the Interfaces block names it — plus the function. `null` returns `[]`. Otherwise return every candidate whose `id` is not in `matchedIds`, preserving the input order. No imports — this module must stay loadable by `node --test`.

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/sheet-archive.test.ts`
Expected: 4 passing, 0 failing.

- [ ] **Step 5: Add the script and the field**

`package.json` scripts: `"test:unit": "node --test tests/*.test.ts"`. **Not `node --test tests/`**: on Node 22 a positional argument is an entry point, not a discovery root, so the directory form exits 1 with MODULE_NOT_FOUND. The shell glob matches one level, which is all this plan needs, and it fails loudly when it matches nothing — so there is no configuration in which the script is green having run no tests.

`AdminStudent` in `src/lib/school-admin.ts`: add `/** Removed from the year's roster; still holds attendance history. */ archived?: boolean;` **and carry it through the mapper** (`toAdminStudent` or its equivalent): `archived: data.archived === true`. A type-only change is inert — the import reads students through that mapper, so without the line the archive set and the restore branch would compile and never fire. Reading is safe: absent means active.

- [ ] **Step 6: Verify**

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add tests/sheet-archive.test.ts src/lib/sheet-archive.ts package.json src/lib/school-admin.ts
git commit -m "feat(students): archive decision as a tested pure function"
```

---

### Task 4: The plan carries the archive set

**Files:**
- Modify: `src/lib/sheet-import.ts` (`AssignmentPlan`, `buildAssignmentPlan`)

**Interfaces:**
- Consumes: `buildArchiveSet`, `ArchiveCandidate` (Task 3).
- Produces: `AssignmentPlan.archive: ArchiveCandidate[]`; consumed by Task 5 (apply) and Task 6 (preview).

- [ ] **Step 1: Extend the type**

Add to `AssignmentPlan`:
```ts
/**
 * Children the sheet no longer names. Empty when the sheet could not be read as
 * a roster — a sheet without a name column is not a statement that the school
 * is empty.
 */
archive: ArchiveCandidate[];
/** Ids of archived children the sheet names again, to be un-archived. */
restore: string[];
```

- [ ] **Step 2: Track matched ids, and match archived children**

Inside `buildAssignmentPlan`, collect a `matchedIds = new Set<string>()`. Add `student.id` to it in the match branch **before** any branch that can `continue` (the reported-for-unknown-bus and reported-for-missing-class paths both match a child first, and a reported row must never archive him).

The match index (`studentsByName`, built at `sheet-import.ts:~685-703`) currently holds active children only. Include `archived === true` children in it as well, so a returning child is **matched rather than created**. When the matched candidate has `archived === true`, push `student.id` into a `restoreIds: string[]`.

- [ ] **Step 3: Produce the sets**

- When `nameIndex < 0` (the existing early return at `sheet-import.ts:720-722`): `archive: []`, `restore: []`.
- When the sheet has zero non-empty name rows: `archive: []`, `restore: []` (same reason).
- Otherwise: `archive: buildArchiveSet(active, matchedIds)` where `active` is `plan.students` narrowed to `archived !== true`, mapped to `{ id, name, grade }`; `restore: restoreIds`.
- A child being restored is not archived: he is in `matchedIds`, so `buildArchiveSet` already excludes him.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: exit 0. There is no unit test for this builder (see Review Focus).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheet-import.ts
git commit -m "feat(import): the plan knows which children the sheet leaves out"
```

---

### Task 5: Applying the plan archives, restores, and records both

**Files:**
- Modify: `src/lib/sheet-import.ts` (`applyAssignmentPlan`)
- Modify: `src/lib/school-admin.ts` (new `setStudentArchived`)
- Modify: `src/lib/audit.ts` (`AuditEvent`, `EVENT_FAMILY`, `EVENT_LABEL_KEY`)
- Modify: `src/lib/i18n/dictionaries/en.ts`, `ar.ts`, `fr.ts`
- Modify: `firebase/firestore.rules` — already covered by Task 1 Step 4

**Interfaces:**
- Consumes: `AssignmentPlan.archive`, `AssignmentPlan.restore` (Task 4).
- Produces:
  - `applyAssignmentPlan(uid: string, plan: AssignmentPlan): Promise<number>` — unchanged signature; returned count now includes archived documents.
  - `setStudentArchived(uid: string, studentId: string, archived: boolean): Promise<void>` in `school-admin.ts` — consumed by Task 7's Restore action.
- Audit events: `"student.archived"`, `"student.restored"`, family `"roll"`, label keys `"activity.event.studentArchived"`, `"activity.event.studentRestored"`.

- [ ] **Step 1: Write `setStudentArchived`**

In `school-admin.ts`, one batch: `{ archived, busId: null, updatedBy: uid, updatedAt: serverTimestamp() }` when `archived === true`; `{ archived: false, updatedBy: uid, updatedAt: serverTimestamp() }` when restoring (leave `busId` alone). Plus one `queueAudit` in the same batch with `event: archived ? "student.archived" : "student.restored"`, `targetType: "student"`, `targetId: studentId`, no `meta`.

- [ ] **Step 2: Make the apply write archives and restores**

In `applyAssignmentPlan`:
- the empty-plan early return becomes `plan.rows.length === 0 && plan.creates.length === 0 && plan.archive.length === 0 && plan.restore.length === 0`;
- for each `child` in `plan.archive`, push `{ ref: doc(students, child.id), data: { archived: true, busId: null, ...stamp } }` into `writes`, so they ride the same ≤400 chunks;
- for each `id` in `plan.restore`, push `{ ref: doc(students, id), data: { archived: false, ...stamp } }` into the same `writes` array (leave `busId` alone — the row's bus correction, if any, is already in `plan.rows` and merges onto the same document);
- after the chunks, for every archived child and every restored id, `await logAudit(firestore, schoolId, { event: …, targetType: "student", targetId: id, occurredAt: new Date() }).catch(() => {})`, matching the existing best-effort comment.

- [ ] **Step 3: Audit vocabulary**

`audit.ts`: add `"student.archived" | "student.restored"` to `AuditEvent`; both to `EVENT_FAMILY` with `"roll"`; both to `EVENT_LABEL_KEY`.

- [ ] **Step 4: Dictionary keys**

`en.ts` (then `ar.ts` and `fr.ts` as `Messages`, complete):
- `activity.event.studentArchived`: `"{actor} archived {student}"`
- `activity.event.studentRestored`: `"{actor} restored {student}"`

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: exit 0.
Then `npm run test:unit` — still 4 passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sheet-import.ts src/lib/school-admin.ts src/lib/audit.ts src/lib/i18n/dictionaries
git commit -m "feat(import): archiving and restoring write through the plan, with an audit trail"
```

---

### Task 6: The import preview names who will be archived

**Files:**
- Modify: `src/components/import/SheetImportDialog.tsx`
- Modify: `src/lib/i18n/dictionaries/en.ts`, `ar.ts`, `fr.ts`

**Interfaces:**
- Consumes: `plan.archive` (Task 4), `plan.restore` (Task 5).
- Produces: nothing later tasks read.

- [ ] **Step 1: State and the toggle**

Add `const [archiveMissing, setArchiveMissing] = useState(true)`. When it is `false`, the applied plan carries `archive: []` (an override object, exactly like the existing `writable` memo builds one). Do not mutate `plan`.

- [ ] **Step 2: The preview section**

Above the existing tallies, a section that appears only when `archiveMissing && plan.archive.length > 0`: a title, a sentence with the count (`tp`), and the children listed as `name · class`, each on its own line. When the list is empty and the sheet was readable, the section shows nothing (not an empty box).

The toggle renders as an Arc `Button` (`secondary`, `size="sm"`, `arc-field`), with `aria-pressed`, labelled from the dictionary; its "off" state must read as the safe one.

- [ ] **Step 3: Permissions**

`!canWriteStudents` ⇒ `archive: []` and `restore: []` in the applied plan, and the archive section is replaced by the existing "what this reader cannot write" wording. The `blocked` computation gains `|| plan.archive.length > 0`.

- [ ] **Step 4: Dictionary keys**

`import.archiveTitle`, `import.archiveBody` (count-bearing, `tp`), `import.archiveToggle`, `import.archiveOff`, `import.unassignToken`, `toast.archived` (count-bearing) — English first, then `ar` and `fr`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: exit 0.

Observe in `npm run dev` as a director with a sheet that omits one child:
- the preview names that child and the count is 1;
- toggling the control off removes the section and the child is not archived;
- Apply archives him: he disappears from the roll and from Assignments, and the toast reports the count.

Then two more passes, each one a Review Focus item:
- re-upload the same sheet with the omitted child's **bus cell blank** → he keeps his bus, and is not unassigned;
- sign in as an operator granted **Students but not Assignments** and open the dialog from another account that reaches it → the archive half is offered and the bus half is described as not writable. Do this the other way round too, and confirm the dialog never claims it will write something the rules would refuse.

- [ ] **Step 6: Commit**

```bash
git add src/components/import/SheetImportDialog.tsx src/lib/i18n/dictionaries
git commit -m "feat(import): the preview names every child the sheet leaves out"
```

---

### Task 7: Archived children leave the screens, and come back from the roll

**Files:**
- Modify: `src/routes/StudentsPage.tsx`
- Modify: `src/lib/use-student-list.ts` (only if it owns the list it receives)
- Modify: `src/lib/school-admin.ts` (`useStudentsPaginated`, `useBusStudentCounts` untouched)
- Modify: `src/lib/school-data.ts` (`RollStudent`, `RollDoc`, the snapshot mapping in `useSchoolRoll` — carry `archived`; do not filter there)
- Modify: `src/routes/AssignmentsPage.tsx` (list only)
- Modify: `src/lib/i18n/dictionaries/en.ts`, `ar.ts`, `fr.ts`

**Interfaces:**
- Consumes: `setStudentArchived` (Task 5), `AdminStudent.archived` (Task 3).
- Produces: `RollStudent.archived?: boolean` — the roll can filter, while the Activity log still resolves names through the same hook.

- [ ] **Step 1: Carry the flag, filter at the screens**

- `useSchoolRoll` / `RollDoc` / `RollStudent`: add `archived?: boolean` and carry it through the snapshot mapping (`school-data.ts:509-514` and the map inside `useSchoolRoll`). Return it; do **not** filter.
- `useStudentsPaginated` (Assignments-only hook): make sure the mapped `AdminStudent` includes `archived`, then exclude `archived === true` from the rows it returns.
- `StudentsPage`: pass only active students to the list unless the toggle is on. Do **not** filter inside `useSchoolRoll` or `fetchAllStudents` — the Activity log resolves names through the first and the import matches returning children through the second.

- [ ] **Step 2: The toggle and the Restore action**

The roll toolbar gains one Arc `Button` (`secondary`, `size="sm"`, `arc-field`): `studentList.showArchived` with the count, `aria-pressed`. Archived rows render an `Archived` chip (`studentList.archivedChip`) and a `studentList.restore` action calling `setStudentArchived(uid, id, false)`; success shows the `toast.restored` toast.

- [ ] **Step 3: The per-bus counts stay right**

Do not touch `useBusStudentCounts`. Archiving clears `busId`, so its `where("busId","==",id)` count stops including the child by construction. Confirm by reading, not by adding a filter.

- [ ] **Step 4: Dictionary keys**

`studentList.showArchived`, `studentList.archivedChip`, `studentList.restore`, `studentList.restored`, `toast.restored` — English, `ar`, `fr`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: exit 0.

Observe: an archived child is absent from the roll and from Assignments by default; the toggle lists him with the chip; Restore brings him back with no bus; the Activity log still names him by name.

- [ ] **Step 6: Commit**

```bash
git add src/routes src/lib/use-student-list.ts src/lib/i18n/dictionaries
git commit -m "feat(students): archived children leave the lists and return from the roll"
```

---

### Task 8: The driver's roster is the standing one

**Files:**
- Modify: `src/lib/school-data.ts` (`useRunRoster`, ~lines 220-481; also `useDriverBus` — see R4 in the ledger)
- Modify: `firebase/firestore.indexes.json` (composite index for `attendance`: `busId` + `runId`)

**Interfaces:**
- Consumes: the rules from Task 1; `buildRunId`, `todayDateStr`, `ROSTER_RUN_TYPE`.
- Produces: `useRunRoster()` keeps its name and returns the same shape, including a `runExists` that is still derived from the run document; `cycleStatus`, `markAbsent`, `completeRun` unchanged in signature. The roster it returns now includes children with no record. Task 9 amends `completeRun`'s writes; Task 10 removes `runExists` from both the return and its consumers.

- [ ] **Step 1: Read `students`, not the day's copy**

Replace the attendance-only listener with two listeners once `busId` resolves:

- `query(collection(firestore, "schools", schoolId, "students"), where("busId", "==", busId))` — map to `{ id, name, grade, archived }`, drop `archived === true`, sort by name;
- the attendance listener, filtered **both** ways: `where("busId","==",busId).where("runId","==",today's morning run)`, mapping to a `Map<studentId, status>`. Both filters are required: the rules authorise a staff list on `resource.data.busId` (Task 1, R5), and Firestore will not prove that from a `runId` filter alone. Add the matching composite index (`firestore.indexes.json`: `attendance`, `busId` ASC + `runId` ASC, query scope `COLLECTION`).

Merge in the memo: the roster is the students list in name order; each entry's status is the map's value or `"WAITING"`. `loading` settles when **both** listeners have delivered or errored, using the same `settlesLoading` rule and the same ceiling timer. Keep the `includeMetadataChanges: true` option and the `settleTimer`.

`live` stays false without a session, and a staff user with no bus gets an empty roster and `runMeta.busId === ""` exactly as today.

- [ ] **Step 2: Create the run lazily on the first write**

In `cycleStatus` and `markAbsent`, add to the existing batch, before the attendance write:

```ts
batch.set(doc(firestore, "schools", schoolId, "runs", runId), {
  busId, runType: ROSTER_RUN_TYPE, date: todayDateStr(), status: "IN_PROGRESS",
  updatedBy: uid, updatedAt: serverTimestamp(),
}, { merge: true });
```

`merge: true` means an existing run document is never rewritten beyond nothing — the same fields, same values. The attendance write gains the full row shape Task 1 allows:

```ts
{ runId, date: todayDateStr(), busId, busName, studentName, grade,
  status: next, boardedAt, droppedOffAt, updatedBy: uid, updatedAt: serverTimestamp() }
```

where `busName`, `studentName` and `grade` come from the resolved roster entry and the bus document already read by `useDriverBus` (expose the bus name from that hook, or read the bus doc alongside; do not invent a second query). Keep `merge: true`.

- [ ] **Step 3: Keep the completed lock, and keep `runExists` for now**

`runStatus === "COMPLETED"` early-returns in both writers stay. `runMeta` and `runStatus` stay. **`runExists` stays in the returned object too**, still derived from the run snapshot: nothing consumes the new roster until Task 10, so this branch keeps typechecking. Task 10 removes the field together with its last consumers. Do not remove it early.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: exit 0 — the return shape is unchanged, only what feeds it.

Do not commit a broken typecheck at any point in this plan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/school-data.ts
git commit -m "feat(driver): the roster is the standing one, and the first tap starts the run"
```

---

### Task 9: Signing off writes a complete row for every unrecorded child

**Files:**
- Modify: `src/lib/school-data.ts` (`completeRun`)

**Interfaces:**
- Consumes: the roster from Task 8 (now every child, recorded or not).
- Produces: nothing later tasks read.

- [ ] **Step 1: Write the full shape**

In `completeRun`'s loop, each ABSENT write carries `{ runId, date: todayDateStr(), busId, busName, studentName, grade, status: "ABSENT", boardedAt: null, droppedOffAt: null, ...stamp }` instead of `{ status: "ABSENT", ...stamp }`. Rationale: on a child with no row the write is a create, and the rules refuse a create without those fields.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: exit 0. Observation comes with Task 10 (there is no UI for this until the Complete bar is always available).

- [ ] **Step 3: Commit**

```bash
git add src/lib/school-data.ts
git commit -m "fix(driver): signing off creates a complete row for children nobody recorded"
```

---

### Task 10: The phone has no "not dispatched" state

**Files:**
- Modify: `src/routes/MobilePage.tsx`
- Modify: `src/components/TopAppBar.tsx`
- Modify: `src/lib/school-data.ts` (remove `runExists` from the return)
- Modify: `src/lib/i18n/dictionaries/en.ts`, `ar.ts`, `fr.ts`

**Interfaces:**
- Consumes: `useRunRoster()` with `runExists` (Task 8 keeps it so the branch typechecks).
- Produces: `useRunRoster()` **without `runExists`** — this task removes both the field and its consumers.

- [ ] **Step 1: TopAppBar loses `runExists`**

Delete the prop and its doc comment. The status line and dot render only when a run exists — `runStatus === "COMPLETED"` (green, `mobile.runCompleted`) or `"IN_PROGRESS"` (primary, `mobile.runInProgress`); when there is no run, render no status line and no rail tick. `mobile.runNotStarted` becomes unused: remove the key from all three dictionaries. Then delete `runExists` from `useRunRoster`'s returned object in `src/lib/school-data.ts`.

- [ ] **Step 2: MobilePage loses two branches, gains one**

- Delete the `showNoRun` computation and its `event_busy` empty state.
- Keep the "no bus linked" state.
- Add an empty state for a bus with nobody on it: `!loading && roster.length === 0 && runMeta.busId !== "" && online`, `icon="groups"`, `mobile.noStudentsTitle` / `mobile.noStudentsBody`, no action. The `online` condition is load-bearing: offline with a cold cache the `students` query returns nothing and settles at once (`settlesLoading` accepts an empty cache read only when offline), so without it a driver with no signal is told his bus is empty. Offline, render no empty state — the offline banner already explains the blank list.
- The Complete bar renders whenever `runMeta.busId !== "" && live && !loading && roster.length > 0` — not gated on a run document — and passes `completed`.

- [ ] **Step 3: Dictionary keys**

Add `mobile.noStudentsTitle`, `mobile.noStudentsBody` to `en`, `ar`, `fr`; remove `mobile.runNotStarted` from all three. Re-run `node scripts/build-icon-font.mjs`? Only if you introduced an icon name the build does not already carry — `groups` is not in the source today, so **yes**: run it and confirm the glyph renders rather than the literal word.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: exit 0.

Observe in `npm run dev` as a driver whose bus has children and **no** run document for today:
- the roster lists them all with the neutral Board pill;
- the app bar shows the bus and no status;
- the Complete bar is present;
- pressing Complete marks every child absent and the app bar then reads Completed;
- a tap on that completed run changes nothing and shows no error banner;
- going offline and reloading with a warm cache still lists the children.

- [ ] **Step 5: Commit**

```bash
git add src/routes/MobilePage.tsx src/components/TopAppBar.tsx src/lib/i18n/dictionaries public/fonts
git commit -m "feat(driver): a dispatched run is no longer a precondition for the roster"
```

---

### Task 11: The monitor counts children nobody recorded yet

**Files:**
- Modify: `src/lib/school-data.ts` (`useDashboardData`)
- Modify: `src/routes/DashboardPage.tsx`

**Interfaces:**
- Consumes: `students` (a new listener inside `useDashboardData`), `archived`.
- Produces: `useDashboardData(dateStr?, segment?, enabled?, includeRoster?)` — a fourth, defaulted parameter. Existing call sites compile unchanged.

- [ ] **Step 1: Add the roster listener**

A `students` snapshot inside the same effect, into a new `roster` state. It never gates `loading` (the existing gate is the attendance snapshot's, from Task 2) and never clears the page.

- [ ] **Step 2: Union in the memo, behind the flag**

When `includeRoster` is true **and** the effective date is the live day (`dateStr == null || dateStr === todayDateStr()`):

- for the selected segment, a run of that segment exists for a bus, and the bus has active children (`archived !== true`, `busId` set);
- every such child with no attendance row for that run is added to `total` and `waiting`;
- the per-bus `waiting`, `progress` and denominator count them too;
- the `finding` copy is unchanged — it already reads from `total`/`unaccounted`.

When the flag is false, or the date is not today, the memo is exactly what it is now.

- [ ] **Step 3: Pass the flag from the monitor only**

`DashboardPage`: `useDashboardData(date, segment, true, date === null || date === todayDateStr())`. `ReportsPage` and `StudentsPage` keep their current call unchanged.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: exit 0.

Observe: with a bus that has children and an `IN_PROGRESS` run but no rows, the monitor shows those children in Total as unaccounted and the bus at 0%; the same day on Reports shows the record-based numbers; a past date on the monitor shows no roster (its records only).

Then the moved-child case: record a child on bus A, move him to bus B in Assignments, and confirm the monitor still counts his record under bus A for that day, while bus A's driver no longer lists him and bus B's does.

- [ ] **Step 5: Commit**

```bash
git add src/lib/school-data.ts src/routes/DashboardPage.tsx
git commit -m "feat(dashboard): unrecorded children read as unaccounted, not as absent from the day"
```

---

### Task 12: Dispatch is for the afternoon only

**Files:**
- Modify: `src/components/dashboard/DispatchModal.tsx`
- Modify: `src/lib/i18n/dictionaries/en.ts`, `ar.ts`, `fr.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Pin the segment**

Remove the run-type control from the form and set `runType` to `"afternoon"` unconditionally. Delete the now-unused `RUN_SEGMENTS`/`SlideSegments` imports from this file only. Keep the duplicate guard, the batch, and the audit entry as they are.

- [ ] **Step 2: Rewrite the hint**

`hint.dispatch.body` currently promises the run pre-registers the bus's students for the morning. Rewrite it, in all three languages, to say what it now does: dispatches an afternoon run for a bus; the driver's morning roster is already there.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: exit 0.

Observe: the modal has no segment control and shows the afternoon; dispatching creates `…-afternoon` only; the hint in `en`, `fr` and `ar` no longer mentions pre-registering students.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DispatchModal.tsx src/lib/i18n/dictionaries
git commit -m "feat(dashboard): dispatch is the afternoon's, and its hint says so"
```

---

### Task 13: Whole-branch gate

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run test:offline`
Expected: all exit 0; `test:offline` either passes or reports skipped (no Chrome).

- [ ] **Step 2: Deploy note**

`firebase/firestore.rules` and `firebase/firestore.indexes.json` changed. **Both must be deployed, in this order: indexes first, then rules** — the new rules admit a query the index has to serve, so deploying the rules alone leaves the driver's roster failing on a missing index. Deployment is a human decision: `npm run deploy:indexes`, then `npm run deploy:rules`. State in the handover whether each was deployed, and to which project.

- [ ] **Step 3: No commit**

Nothing to commit; this task is the gate.

---

## Notes for the implementer

- Task 1 is the only task that cannot be verified by a command in this repo. Do not claim it works from reading the rules — the simulator result is the evidence.
- Tasks 8-10 are one change seen from three files; a branch that cannot typecheck between them is expected, and Task 8 Step 4 says how to sequence the commits.
- If any step's premise turns out false (a hook signature, a line number, the shape of `AssignmentPlan`), stop and report rather than improvising: the spec is the source of truth for intent, and the code wins for facts.

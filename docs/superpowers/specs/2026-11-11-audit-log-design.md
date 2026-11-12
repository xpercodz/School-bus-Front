# Activity log — design

Status: **proposed**. Nothing built yet.

Research this rests on — three independent passes:
- [`docs/research/2026-02-audit-log-for-directors.md`](../research/2026-02-audit-log-for-directors.md) — what a record must contain, the event catalogue, how mature products read, FERPA/GDPR.
- [`docs/research/2026-02-audit-log-storage.md`](../research/2026-02-audit-log-storage.md) — what rules can and cannot enforce, who owns the clock, TTL limits, why not a hash chain.
- A read-only scout of both repos (2026-11-11) — what logging exists today and every mutation the client performs.

A record of the behaviours a director can be challenged on, and one screen where
they can read it.

---

## 0. Decisions already taken

| # | Decision | Chosen |
| --- | --- | --- |
| 1 | What this is | A **director-facing activity log** (audit trail). Engineering telemetry is a separate concern. |
| 2 | Coverage | **Best-effort, no new infrastructure.** No Cloud Functions, no Blaze, no scheduled jobs. |
| 3 | Who reads | **Any director. Never an operator.** Matches the rule already in `firestore.rules:237-240`. |
| 4 | The recorded constraint | **Amended**, with compensating controls — see §2. |

---

## 1. What exists today

An audit trail half-exists: written only by the API, read by nobody.

| Fact | Where |
| --- | --- |
| `schools/{schoolId}/audit/{uuid}`, director-read, client-write-forbidden | `firebase/firestore.rules:237-240` |
| Written only by the Admin SDK, one doc per event | `School-bus-API/src/lib/driver-admin.ts:142-165` |
| Fields: `event`, `actorUid`, `at`, `detail` (free text) | same |
| Six events, all account lifecycle | `driver.created`, `driver.code_regenerated`, `operator.created`, `operator.screens_changed`, `operator.password_changed`, `operator.removed` |
| Nothing in `src/` reads the collection | `grep -rn audit src/` → no hits |
| Every audit write is fire-and-forget after the commit | `driver-admin.ts:110,136`, `operator-admin.ts:71,101,130,163` |

Two recorded statements this design has to answer:

- `SECURITY.md:142-144` — *"Audit log covers driver lifecycle only (create/regenerate). Attendance status changes happen client-side through Firestore rules and are not yet audit-logged."*
- `School-bus-API/SECURITY-AUDIT-2026.md:47` — the client does *"no hashing, no code generation, no audit writes (correct)"*.

The second is a judgement, not a law, and §2 amends it deliberately.

### The gap

| Behaviour | Written by | Audited today |
| --- | --- | --- |
| Director/operator sign-in, success and failure | API | ✗ (Cloud Logging only, 30-day retention) |
| Driver code sign-in | API | ✗ |
| Driver created / code rotated | API | ✓ |
| Operator created / screens / password / removed | API | ✓ |
| **Student moved between buses** | **browser** `school-admin.ts:506` | ✗ |
| **Driver assigned to a bus** | **browser** `school-admin.ts:477` | ✗ |
| **Attendance changed** (board / drop / absent) | **browser** `school-data.ts:339,384`, `completeRun:355` | ✗ |
| **Run dispatched** | **browser** `DispatchModal.tsx:132` | ✗ |
| **Sheet import** | **browser** `sheet-import.ts:677` | ✗ |
| **`assignmentMode` changed** | **browser** `school.ts:95` | ✗ |
| Export | browser | ✗ |
| `owner` flag changed | API script `set-owner.mjs:87` | ✗ |

The bold rows are the director's real questions, and every one is a browser
write. That is the whole difficulty.

---

## 2. The amendment, and what pays for it

`firestore.rules` currently forbids all client writes to `audit`. Covering
attendance and bus moves without new infrastructure means the browser must
write something. Rather than quietly break a recorded decision, the risk is
split into two mechanisms with different guarantees, and the weaker one cannot
lie about the thing that matters.

**1. A mandatory provenance stamp on the record itself.** `attendance`,
`students`, `buses` and `schools/{id}` must carry `updatedBy` and `updatedAt` on
every write, and the rules require `updatedBy == request.auth.uid` and
`updatedAt == request.time` (`firestore.rules`). This cannot be omitted or
spoofed — a write without it is rejected. So **"who last touched this record,
and when" is always true**, on the record, forever.

**2. A best-effort history entry.** In the same atomic batch, the client appends
one `audit` entry. The rules pin it hard:

- `actorUid == request.auth.uid` — it cannot claim another actor.
- `at == request.time` — it cannot be backdated.
- `actorName == profile().get('displayName','')` — it cannot invent a name.
- `event` must be in a closed allowlist — it cannot invent vocabulary.
- `update, delete: if false` — once written it cannot be edited or removed.
- `keys().hasOnly([...])` — no smuggled fields.

And what it still cannot do, stated plainly because the director's trust depends
on nobody overclaiming it:

- **Coverage is not guaranteed.** A client can omit the entry. The stamp (1) is
  the backstop: the record still names its last editor.
- **`changes.before` is a claim, not a computed fact.** The entry's *attribution*
  is sound; its *values* are what the writer said. Only a server-derived entry
  could compute them from `before`/`after`.

The screen says which is which (`Reported by the server` / `Recorded by the
browser`), and `SECURITY.md` gets the amendment in writing.

### The dissent, recorded

An independent storage pass over the same stack reached a firmer verdict than
this design: *"Do not let the browser write the director-facing audit collection
at all… Option A (browser writes) fails the 'not forgeable by the audited party'
requirement; acceptable only as a clearly-labelled inbox of claims."*

That is a fair reading, and it is why this design does **not** call the client
half an audit trail. The honest naming, which the UI must carry:

- **Server-written entries (accounts, sign-in, identity) are evidence.** A
  verified token, a server clock, an Admin SDK write.
- **Browser-written entries (roll, assignments, settings) are claims.** Immutable,
  correctly attributed, and unverified in content.
- The stamp on the record itself is the part that is neither: it cannot be
  omitted, and it is always true.

If the school ever needs the stronger property — a trail that withstands "the
director did it" — the answer is the trigger in the storage note's option C,
and no amount of client-side care substitutes for it.

### The one lever that would close the coverage hole

`getAfter()` lets a rule require that an entry exists **inside the same atomic
operation**, so a batch that moves 40 attendance docs cannot commit without its
entry. It forces existence and atomicity — never truthful content.

It is **deferred**, deliberately: it needs every roster write to become a
batch/transaction with a fully specified audit path, adds a required field to
each record, and spends the rule's document-access budget. v1 is best-effort by
your decision; this is the recorded path to v1.1 if "a client can skip an entry"
ever becomes unacceptable.

**Why not triggers or API-mediated writes** (the two options that would make it
exact): both were offered and declined as new infrastructure or a lost offline
path. Recorded here so the tradeoff is not rediscovered as a surprise.

### The limit no design removes

A driver signs in with a **shared 6-digit code**, so a row that names a driver
names an *account*, not a person — two monitors on one bus are one actor. No
audit design in this repo can fix that; only per-person credentials would. So
the log proves *who wrote what, when, and that it was not edited afterwards*. It
does not prove the child boarded. The screen must not imply otherwise, and the
guidebook entry should say so in one sentence.

---

## 3. The entry

One document per event under `schools/{schoolId}/audit/{entryId}` — the
collection that already exists, with a widened shape. `entryId` is a
client-generated UUID, so an offline retry that re-sends a batch re-writes the
same document rather than duplicating the event.

```ts
interface AuditEntry {
  schemaVersion: 1;
  event: AuditEvent;                    // closed enum, `object.action`
  outcome: "success" | "failure";
  reason: string | null;                // enum, only on failures

  at: Timestamp;                        // server: commit time, never the device
  occurredAt: Timestamp | null;         // device clock, client entries only

  actorUid: string;
  actorRole: "director" | "operator" | "staff" | "system";
  actorName: string;                    // snapshot; a removed account still reads
  actorEmail: string | null;            // account/auth events only; null otherwise

  targetType: "student"|"bus"|"run"|"attendance"|"account"|"school"|"export";
  targetId: string;                     // opaque id only — never a child's name

  changes: Record<string, {from: string|number|null; to: string|number|null}>;  // ≤ 8 keys
  correlationId: string | null;         // one user action → many docs
  source: "api" | "client" | "system";
  expiresAt: Timestamp;                 // retention, see §5
}
```

Field-by-field the reasoning is in the research note (§1.2); the four that
matter most here:

- **Two timestamps.** `at` is when the write reached the server; `occurredAt` is
  the device clock. They differ by minutes whenever a driver was offline, and
  the difference is not recoverable later — this repo already cannot recover it
  for `boardedAt`, which is documented as sync-time. The screen shows `at`; the
  details panel shows `occurredAt` labelled as device time. **This also means the
  ordering is commit order, not tap order** — honest, and stated in the UI.
- **`actorName` is a snapshot; `targetId` is not a name.** An actor who is
  removed must still read as a person, so their label is copied at write time
  (Google documents this exact rename failure). A **child's** name is never
  copied: the log references the student by id and the screen resolves it
  against `students` — a deleted student reads "Removed student". Duplicating
  children's names into a second store is what makes a log a breach asset
  (research §8: store opaque ids, never names).
- **`event` is an enum, never a sentence.** The sentence is built from the
  dictionary in English *and* Arabic; an English string in Firestore would make
  the log permanently monolingual.
- **`changes` holds only changed keys,** never a document snapshot.

### Absent on purpose

No `ip`/`userAgent` (the API already logs those to Cloud Logging with 30-day
retention; copying them into a 12-month school-readable store is a privacy
liability), no free-text `message` (an unindexed dumping ground), no
`severity` (a log classifier, not a director-facing attribute), no
whole-document snapshot, no `schoolId` (the parent path already says it).

### Legacy entries

Existing documents carry `{event, actorUid, at, detail}` and no
`schemaVersion`. They are **not migrated**: the reader treats a missing
`schemaVersion` as v0, renders `event` + `detail` with source `api`, and hides
the diff table. There are only a handful, and rewriting history to make the
reader simpler is exactly the wrong trade.

### Never in an entry

Access codes, `codeHash`, passwords or hashes, ID tokens, sheet contents, CSV
rows, whole student documents, driver-device identifiers, typed search text, or
**any child's name, address, health note or GPS position**.

### Text that enters the log is filtered at the writer

This app is bilingual, so **bidi is an injection vector, not a detail**: U+202A–
202E and U+2066–2069 in a `reason` can visually reverse a row and make a
signature look like a deletion. So every string field is capped
(`reason` ≤ 200 chars, `targetId` ≤ 128), stripped of CR/LF and the bidi
control set at the writer, and **the rules re-check the shape with `matches()`**
— the one content filter available on a client write path. A rejected write
fails whole (rules cannot strip a field and keep the rest), so the writer
sanitises first and the rules are the backstop.

---

## 4. Event catalogue

Every event below has a real writer. None are speculative.

| Event | Source | Target | `changes` / `meta` |
| --- | --- | --- | --- |
| `auth.sign_in` | api | account | — |
| `auth.sign_in_failed` | api | account | `reason`: `invalid_credentials` \| `not_director` \| `rate_limited` |
| `auth.code_sign_in` | api | account | — |
| `account.driver_created` | api | account | driver's account id + name |
| `account.code_rotated` | api | account | — |
| `account.operator_created` | api | account | — |
| `account.screens_changed` | api | account | `screens: {from, to}` |
| `account.password_reset` | api | account | — |
| `account.removed` | api | account | — |
| `account.owner_changed` | system | account | `owner: {from, to}` |
| `student.bus_changed` | client | student | `busId: {from, to}` |
| `bus.driver_changed` | client | bus | `driverUid: {from, to}` |
| `attendance.changed` | client | student | `status: {from, to}`, `occurredAt` |
| `run.completed` | client | run | `correlationId`, auto-absent count |
| `run.dispatched` | client | run | `correlationId`, student count |
| `students.imported` | client | school | `correlationId`, row count |
| `school.assignment_mode_changed` | client | school | `assignmentMode: {from, to}` |
| `activity.exported` | client | export | row count, filter summary — never search text |

**Cascades are one entry, not N.** `completeRun()` writes a run plus an absence
per unrecorded child; `assignDriverToBus()` writes two bus docs. Each produces
**one** entry with a `correlationId`. Forty orphan "marked absent" rows cannot be
distinguished from forty human decisions — that is the anti-pattern.

**Failed management sign-ins record the reason, not the email.** An
unauthenticated attempt cannot be attributed, and storing attempted addresses
turns the log into a new PII store for no investigative gain — the IP already
lives in Cloud Logging. `not_director` is the interesting one: valid credentials
used on the wrong door.

**Deliberately not logged:** ordinary reads, who *viewed* a student (a
`getCount`-per-view cost with no dispute value), and opening the log itself
(a view of the log writing to the log is noise that grows quadratically).

---

## 5. Retention

**365 days**, in one constant (`AUDIT_RETENTION_DAYS`) and in the school's
retention schedule. NIST AU-11 leaves the number to the organisation; ICO
requires it be justified; GDPR Art. 30(1)(f) expects it written down. The
app's `ROLL_SUMMARY_DAYS = 90` is an *analytics* horizon and must not be
inherited by the log by accident.

Enforced by a **Firestore TTL policy on `expiresAt`**, written by whoever writes
the entry. Nobody can prune selectively, there is no job to operate, and the
window is one number. Rules require `expiresAt` to be a future timestamp.

Four facts about TTL that the plan depends on (research §4, all documented):
deletes **take up to 24 hours** past expiry; they are **billed as deletes**;
they **do not cascade** to subcollections (so the collection must stay flat, as
it is); and they are **not written to Cloud Audit Logs** — a purged entry leaves
no trace of having existed, which is exactly what a retention purge should do.

Two obligations the machine cannot enforce, to be written in the doc rather than
hoped for:

- **A parent access request pauses the purge** (FERPA §99.10(e) bars destroying
  education records while a review request is open). The TTL policy must be
  suspended by hand during one.
- **A student's removal does not erase their history.** Entries keep their opaque
  ids until the retention boundary; the screen shows "Removed student" once the
  student document is gone.

**No hash chain, deliberately.** The storage note's finding is that a chain head
in Firestore is a hot document (`ABORTED: Too much contention`) and that a chain
living only in Firestore is recomputable by whoever can edit it — real
tamper-evidence needs a sealed root in a locked GCS bucket. That is a new
deployable plus a verifier, and it protects against a threat (someone with Admin
SDK access) that no client-side control in this design addresses either. Not
built; named so nobody adds a half-chain later and calls it evidence.

---

## 6. The screen

`/dashboard/activity`, nav row under **manage**, director-only. `ScreenId` gains
`"activity"` but `GRANTABLE_SCREENS` does **not** — the audited do not administer
the audit, and adding an `OperatorScreen` value would be a two-repo contract
change for a screen operators have no business reading.

**The screen's one question:** *what changed, and should I be worried?*

**Composition**

- `PageHeader` — h1 `Activity`, subtitle stating the two things a reader must
  know: *"Every change made in this school. Read-only. Entries are kept for 12
  months."* Its existing `finding` slot carries the last notable event.
- **A count strip that is also the filter.** Four cells — Access · Students ·
  Roll · Settings — each showing an **exact** count for the window
  (`getCountFromServer`). The counts answer "what happened today" before a
  single page is turned, and collapse 400 roll changes to a click. A capped
  scan printed as a total would be a lie, so the numbers are exact or absent.
- **Filters**: a **date range defaulting to the last 7 days** (Arc
  `date-range-picker`), an actor picker, and the family from the strip. Page 1 on
  change; every filter has a visible "all" state. **This screen is range-scoped,
  not day-scoped** — deliberately unlike Live/Students/Reports, because a log is
  opened after an incident rather than browsed by day, and every mature product
  examined defaults to a 7-day window. It therefore does *not* join `DayScope`.
- **No search box.** Structured filters only (the GitHub model: *"you cannot
  search for entries using text"*), because a text box over snapshots silently
  misses the old name of a renamed person and then lies about what it found.
- **List**: newest first (`recordedAt` desc, documented in the UI rather than
  assumed), `PaginationBar` + `usePageSlice`, 10 per page over a cursor-loaded
  window (`useAutoLoadMore`, as Assignments does).
- **The row sentence** is composed from the dictionary, never stored, in the
  grammar `Actor (role) · verb · object · what changed`, with values already
  rendered — bus *names*, not ids; screen names, not `"reports"`:

  > Sara M. (operator) moved Yusuf K. from Bus 3 to Bus 7.
  > Faisal A. (driver) recorded Noura H. as boarded at 06:42 — synced at 07:15.
  > Faisal A. (driver) completed Bus 3's morning run; 4 unrecorded students marked absent.
  > Sheet import (Ahmed K.) moved 34 students; 2 rows unmatched.
  > Sign-in failed for a@b.c (wrong password).

  Arabic renders through the app's own formatters (`ar-EG`, Eastern Arabic
  digits), and any Latin identifier inside an Arabic sentence is bidi-isolated
  so an id or an email cannot reorder the line.
- **Expand** → a two-column `Field · Before · After` table (changed fields only),
  then one "Technical details" disclosure (entry id, `occurredAt`, source,
  raw values). Ids and enums live here and nowhere else.
- **Table**: `table-zebra` — the repo's house rule, a conscious difference from
  the generic no-zebra advice.
- **States**: no activity in this window / a filter matching nothing / the log
  failed to load. Three different sentences, never one empty box. A coverage
  banner when the window predates the log's first entry.
- **Export**: CSV of the current filter, through the existing
  formula-injection guard, capped, and the export is itself an entry.

**Phone**: the usual `divide-y` card list, filters under a disclosure.

**Deferred, with reasons:** run-grouping inside the roll family (needs either a
per-run summary document or a full-window read — more machinery than v1 earns;
the count strip carries the volume instead), realtime `onSnapshot`, and alerts.

---

## 7. Risks, and the order to deploy in

1. **A rules/required-field mismatch silently drops taps.** `cycleStatus` and
   `markAbsent` are `void setDoc(...)` with no rejection handler
   (`school-data.ts:339,384`). Today a rules denial loses an attendance record
   with no signal; adding a required stamp makes that window real. **Fix the
   silent swallow as part of this work** (await, catch, toast) — it is caused by
   this change, not adjacent to it.
2. **Deploy order matters.** Client first, rules second. A client still running
   the old bundle writes no stamp and would be denied; the service worker
   reloads on `controllerchange`, and a driver-queued write that syncs after the
   rules deploy is the one case that still fails. Mitigation: ship the client,
   confirm the new bundle, then `npm run deploy:rules`.
3. **A school with a year of attendance writes a lot of documents** (~600-1,200
   per school day for 300 students, by the research's estimate). That is the
   point of the log, and the count strip plus filters is the usability answer;
   if it proves noisy, the follow-up is a per-run summary document, not a change
   to the trail.
4. **`logAudit` can 500 after the commit** (already recorded as
   `SECURITY-AUDIT-2026.md` finding 6): the `.catch` is outside, so a driver
   account exists and the caller gets a 500 — losing the plaintext code. Make
   `logAudit` swallow internally and drop the caller `.catch`es while touching it.
5. Out of scope but found: `firestore.rules:201` still allows a client director
   to write `driverCodes`, which the API's own audit calls the enabling half of a
   cross-tenant attack. Not this change; flagging so it is not mistaken for one.

---

## 8. Files this touches

**Front** (a complete screen; from the repo's own conventions):
`src/lib/audit.ts` (new — the writer, `buildAuditEntry`, event enum),
`src/routes/ActivityPage.tsx` (new), `src/lib/school-audit.ts` (new — reads/counts),
`src/App.tsx`, `src/data/dashboard.ts` (union + `NAV_ITEMS` + `activeIdFromPathname`),
`src/lib/permissions.ts`, `src/components/dashboard/Sidebar.tsx`,
`src/components/dashboard/MobileNav.tsx`, `src/lib/guide.ts`,
`src/components/guide/GuideMap.tsx`, `src/lib/hints.ts` (optional),
both dictionaries, `src/lib/i18n/types.ts`
(only if a pluralised count), `firebase/firestore.rules`,
`src/lib/school-data.ts` (stamps + the silent-swallow fix),
`src/lib/school-admin.ts`, `src/lib/school.ts`, `src/lib/sheet-import.ts`,
`src/components/dashboard/DispatchModal.tsx`, `SECURITY.md`, `AGENTS.md`.
Icons: `node scripts/build-icon-font.mjs` if a new glyph is used — `npm run build`
fails on a missing one.

**API**: `src/lib/driver-admin.ts` (`logAudit` shape + internal catch),
`src/lib/operator-admin.ts` (call sites), `src/routes/auth-director-sign-in.ts`
and `auth-verify-code.ts` (success events), `scripts/set-owner.mjs`,
`scripts/clear-data.mjs` (delete `audit`), `README.md`.

---

## 9. Verification

- `npm run typecheck && npm run lint && npm run build` — the Arabic dictionary is
  type-checked, so a missing key fails the build.
- `npm run test:offline` — the log must not add a Workbox route (AGENTS.md).
- Emulator check of the rules: a client create with the wrong `actorUid`, a
  backdated `at`, an unknown `event`, an `update`, and a `delete` are all
  denied; a well-formed create is allowed; a director of another school reads
  nothing.
- A real offline run: tap a driver through a dead zone, restore, confirm one
  entry (not two) and that `at` ≠ `occurredAt`.
- Render the screen in both locales at 1440/768/390 with the taste gate
  (`inspect.mjs --app`), and look at the screenshots.

---

## 10. Open

Nothing blocking. Two things to confirm before the retention section is final:

- The **jurisdiction**. FERPA and GDPR/ICO are the regimes with citable primary
  text; if this deploys to the Gulf, the retention and access sections need local
  review (the research note flags this, and could not retrieve either source).
- Whether any **school policy already fixes a retention period** — if so it wins
  over 365 days, and that number belongs in the school's retention schedule too.

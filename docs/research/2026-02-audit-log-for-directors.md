# Activity log for school transport directors — what it holds, how it reads, what student data requires

**Question.** The app has no activity log. The director wants "major behaviours — who changed what, when". This note answers: what an audit record must contain, which events count as major behaviour *for this object model*, how a mature product presents one to a non-engineer, what breaks at the edges, and what a school's student-data context adds.

**Status:** research note, no product code. Written 2026-02. Scope is the frontend repo (`School-bus-Front`) plus its Firestore rules; the privileged API lives in `../School-bus-API`.

**Contents.** §0 three decisions · §1 event schema · §2 major behaviours catalogue · §3 reading experience · §4 edge cases · §5 diff presentation · §6 privacy · §7 anti-patterns · §8 screen checklist. Section refs of the form `§99.x` are FERPA unless stated otherwise.

**Method / limits.** Claims are linked to the page they came from. Four things are flagged rather than asserted:

1. `nvlpubs.nist.gov` returns **HTTP 406** to this environment's fetcher; the SP 800-92 text below was extracted from the official PDF by a separate research pass (page numbers are the document's own). Landing page: [csrc.nist.gov/pubs/sp/800/92/final](https://csrc.nist.gov/pubs/sp/800/92/final).
2. NIST SP 800-53 control prose is client-rendered on csrc.nist.gov, so verbatim control text is taken from NIST's own OSCAL export ([catalog JSON](https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json)) and cross-checked against the [csf.tools mirror of AU-3](https://csf.tools/reference/nist-sp-800-53/r5/au/au-3/).
3. Google/GitHub/Microsoft docs pages were read through a text-extraction proxy where the raw HTML truncated before the article body; the **links are to the official pages**.
4. Firebase's offline docs are JS-rendered and truncated before the body for one fetcher; the offline-queue and pending-timestamp behaviour is cited from the Node `SnapshotOptions` reference and the Firestore "add data"/"offline" pages, and corroborated by this repo's own code comment.

---

## 0. The three decisions this forces (read first)

1. **Where the entry is written.** `firebase/firestore.rules` already declares `match /audit/{entryId} { allow read: if isDirector(); allow write: if false; }` — "entries are written by the Admin SDK only". But the writes a director most wants to see (a student moved between buses, a sheet import, a driver's tap) are **client Firestore writes**, not API calls, so a client cannot write the entry it is being audited for. Three routes: **(a)** a Firestore document-trigger function deriving the entry from `change.before`/`change.after` — complete and tamper-proof, but the trigger knows only *what* changed, never *why*; **(b)** move those writes behind the API — complete, trusted, and carries the request's intent, at the cost of the offline write path that the driver depends on; **(c)** allow create-only audit writes from the client — captures intent, but is spoofable by the very user it audits. Pick before building the screen, because (a) and (b) produce different schemas.
2. **Two timestamps, not one.** The driver's tap happens on a bus with no signal. `serverTimestamp()` resolves when the write reaches the server, not when the child boarded. Today `cycleStatus()` writes only `serverTimestamp()`, so **existing attendance timestamps are sync-time, not tap-time** — the log cannot recover the difference retroactively. The schema in §1 therefore requires `occurredAt` (device) and `recordedAt` (server) separately.
3. **The log is a second store of children's names.** FERPA's definition of personally identifiable information is broad enough to cover a name plus a bus plus a time ([34 CFR §99.3](https://www.govinfo.gov/content/pkg/CFR-2024-title34-vol1/xml/CFR-2024-title34-vol1-sec99-3.xml)), and NIST explicitly warns that audit trails leak PII ([AU-3](https://csf.tools/reference/nist-sp-800-53/r5/au/au-3/)). So the log needs its own retention period, its own access rule, and its own deletion story — it cannot inherit "whatever Firestore keeps".

---

## 1. Recommended event schema

### 1.1 What the guidance actually requires

The authoritative field list is **NIST SP 800-53 AU-3**, not SP 800-92. AU-3 requires records that establish:

> "What type of event occurred; When the event occurred; Where the event occurred; Source of the event; Outcome of the event; and Identity of any individuals, subjects, or objects/entities associated with the event."
> — [AU-3, NIST SP 800-53 Rev 5](https://csf.tools/reference/nist-sp-800-53/r5/au/au-3/)

AU-3's supplemental guidance adds that content "may be necessary … includes event descriptions (item a), time stamps (item b), source and destination addresses (item c), user or process identifiers (items d and f), success or fail indications (item e)". AU-3(1) lets the organisation add fields; AU-12 requires generation of records "that include the audit record content defined in AU-3"; AU-9 requires protecting them from "unauthorized access, modification, and deletion".

**Do not attribute the six-field list to SP 800-92.** SP 800-92 defines a log entry only generically — "each entry contains information related to a specific event that has occurred within a system or network" (Exec. Summary, p.ES-1) — and its nearest field guidance is policy-level: "Which data characteristics must or should be logged for each type of event (e.g., username and source IP address for authentication attempts)" (§4.2, p.4-4). What SP 800-92 *does* contribute is the operational spine: NTP time sync (SP 800-92 §3.2 fn.24, p.3-4), the warning that "timestamps might indicate that event A happened 45 seconds before event B, when event A actually happened two minutes after event B" (§2.3.1, p.2-8), normalising times to one zone (§3.2, p.3-3), retention as a written policy (§4.2, p.4-5), and integrity via message digests for archived logs (§3.2, p.3-4). [Landing page](https://csrc.nist.gov/pubs/sp/800/92/final).

OWASP gives the practical shape in one sentence: **"The application logs must record 'when, where, who and what' for each event"** — and then the fields AU-3 also implies: "Action — original intended purpose of the request", "Object e.g. the affected component or other object", "Result status — whether the ACTION aimed at the OBJECT was successful", "Reason — why the status above occurred", plus an "Interaction identifier" to tie one user interaction's events together ([OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).
OWASP's own vocabulary fixes the machine-readable half: event names of the form `category_object_action[:attributes]` (`authz_change:[userid,from,to]`, `privilege_permissions_changed:[userid,file|object,fromlevel,tolevel]`, `user_updated:[userid,onuserid,attributes[...]]`), and **"All dates should be logged in ISO 8601 format WITH UTC offset"** ([OWASP Logging Vocabulary](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html)).
Time stamps are constrained by **AU-8**: they must "use Coordinated Universal Time, have a fixed local time offset from Coordinated Universal Time, or … include the local time offset as part of the time stamp" ([AU-8](https://csf.tools/reference/nist-sp-800-53/r5/au/au-8/)).

### 1.2 The concrete field set

Shape: one document per event under `schools/{schoolId}/audit/{entryId}`. Nothing here is product code — it is the contract the screen and any writer share.

| # | Field | Type | Why it exists (source) | Req. |
|---|---|---|---|---|
| 1 | `id` | string, sortable (ULID) | Stable identifier; AU-3 "identity … of objects"; doc id is also the pagination cursor | ✔ |
| 2 | `schemaVersion` | int | OWASP: field lengths/types must be "defined to an agreed standard"; lets the reader render old entries after the vocabulary changes | ✔ |
| 3 | `eventType` | closed enum, `object.action` (`student.bus_changed`) | AU-3 "what type of event occurred"; OWASP vocabulary demands one consistent naming scheme | ✔ |
| 4 | `eventLabelKey` | string (i18n key) | The human sentence. Never stored as prose — the app is bilingual and derives all copy through `t()` | ✔ |
| 5 | `occurredAt` | ISO 8601 **with offset** | AU-3 "when"; OWASP: ISO 8601 with UTC offset; "the event timestamp may be different to the time of logging" | ✔ |
| 6 | `recordedAt` | server timestamp (UTC) | AU-8; Purview's `CreationTime` is explicitly "when the audit log record is generated", not when the act happened | ✔ |
| 7 | `timeConfidence` | `exact \| skewed \| unknown` | OWASP Note C: on devices you don't control, "attempt to measure the time offset, or record a confidence level in the event timestamp" | ✔ |
| 8 | `schoolId` | string | AU-3 "where"; tenancy boundary. **Never** trusted from the request body — derive from the actor's profile | ✔ |
| 9 | `actor.uid` | string \| null | AU-3 "source … identity"; joins to `users/{uid}` when it still exists | ✔ |
| 10 | `actor.role` | `director \| operator \| staff \| system` | AU-3 identity; a role change later must not rewrite history | ✔ |
| 11 | `actor.label` | string | **Snapshot** of the display name at event time — the fix for deleted/renamed actors (§4) | ✔ |
| 12 | `actor.email` | string \| null | Snapshot; needed to investigate a sign-in attempt by an account since removed | ◐ |
| 13 | `actor.kind` | `human \| system \| import \| trigger` | Purview records `SHAREPOINT\system` and leaves `UserKey` empty when the actor isn't a user; the log must name non-human actors, not leave a hole | ✔ |
| 14 | `channel` | `web-admin \| web-operator \| mobile-driver \| api \| trigger` | AU-3 "where"/"source"; tells you whether a change came from the dashboard or a bus | ✔ |
| 15 | `outcome` | `success \| failure \| partial` | AU-3 "outcome"; Purview's `ResultStatus`; **failure and success must not look alike** | ✔ |
| 16 | `reason` | enum \| null (`invalid_code`, `too_many_attempts`, `not_owner`, `locked_run`) | OWASP "Reason — why the status above occurred". Never free text from a driver | ◐ |
| 17 | `target.type` | `student \| bus \| run \| attendance \| account \| school \| export` | AU-3 "objects/entities associated with the event" | ✔ |
| 18 | `target.id` | string | The join key back to the live record | ✔ |
| 19 | `target.label` | string | Snapshot the reader can still read after the record is renamed or deleted | ✔ |
| 20 | `changes[]` | `{field, before, after}` | The diff (§5). `before` is what makes "changed Y from A to B" possible; a merge-patch cannot express it | ◐ |
| 21 | `correlationId` | string \| null | OWASP "Interaction identifier". **Load-bearing here**: one driver swap touches two bus docs; one "complete run" touches a run plus N attendance docs | ✔ |
| 22 | `context` | `{ip?, userAgent?, deviceClass?}` | AU-3 "source"; optional because a bus device has no meaningful IP | ◐ |
| 23 | `securityRelevant` | bool | OWASP: "Security relevant event flag (if the logs contain non-security event data too)" — lets sign-ins and permission changes be filtered from routine attendance | ◐ |
| 24 | `appVersion` | string | OWASP "Application identifier e.g. name and version"; diagnoses a writer bug across deploys | ◐ |
| 25 | `dedupeKey` | string \| null | Client-generated UUID so an offline retry cannot double-write the same tap (§4) | ◐ |

Legend: ✔ required · ◐ required where the event type has the concept.

**Deliberately absent:** no `severity` between INFO/WARN/CRIT (that is a *log classifier*, not a director-facing attribute — the director needs outcome + object, not a syslog level); no free-text `message` field (it becomes an unindexed dumping ground and an XSS vector — OWASP requires sanitising log data and restricting log access); no whole-document snapshots (minimisation, §6.1).

### 1.3 Event naming: pick one scheme and freeze it

The two authoritative sources disagree in surface form — OWASP uses snake `authz_change`, GitHub uses dotted `repo.create` ([GitHub audit log](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)). Both are "object/verb". **Recommendation:** `object.action`, because this app's objects (`student`, `bus`, `attendance`, `account`, `school`) read as a closed list and the dotted form sorts nicely in an enum picker. What matters is that `eventType` never changes once shipped: the reader resolves `eventLabelKey` to a sentence, and an unknown enum must still render (fall back to "changed a record", never a raw id).

---

## 2. "Major behaviours" for *this* app

Derived from the objects the code actually writes: `schools/{schoolId}` (`assignmentMode`), `…/students` (`name, grade, busId`), `…/buses` (`name, driver, driverUid`), `…/driverCodes` (`codeHash`), `…/runs`, `…/attendance` (`status, boardedAt, droppedOffAt`), `users/{uid}` (`role, screens, owner`), plus the API's `auth/*`, `drivers`, `operators` routes and the client's CSV export/print and sheet import.

**Volume** = expected entries on a normal school day (L = tens, M = hundreds). No row is unbounded: even attendance is scoped to a run. Volume drives *grouping* in the reader, not whether to record.

### 2.1 Identity and access

| Event | Trigger in this app | Before → After (fields the reader sees) | Must **not** include | Vol. |
|---|---|---|---|---|
| `auth.sign_in` | `POST /v1/auth/director-sign-in`; `POST /v1/auth/verify-code` (`src/lib/api.ts`) | none → `{role, channel, outcome}` | password, 6-digit code, token/JWT | L |
| `auth.sign_in_failed` | same routes, `invalid_credentials` / `invalid_code` / `not_director` | none → `{attemptedEmail?, role?, reason}` | the attempted password/code; whether the account exists (in the *reader UI*: show "failed sign-in for a@b.c", not "no such user") | M |
| `auth.rate_limited` | `too_many_attempts`, `rate_limited` | none → `{reason, window}` | raw request bodies | L |
| `account.created` | `POST /v1/drivers`, `POST /v1/operators` | none → `{role, displayName, email, screens}` | the plaintext code (returned once, never stored) and the initial password | L |
| `account.screens_changed` | `POST /v1/operators/screens` | `screens: ["live","students"]` → `["live","students","reports"]` (render as added/removed, not two arrays) | the operator's password or session data | L |
| `account.code_rotated` | `POST /v1/drivers/regenerate` | `hasCode: true` → `hasCode: true` + `rotatedAt` (or `hasCode:false` → `true`) | the code, the `codeHash`, the code's first digit | L |
| `account.password_changed` | `POST /v1/operators/password` (the main director sets it from the Operators page; **no self-service change exists today**) | `{}` → `{}` — **the event is the whole content** | any password material, any password-length hint | L |
| `account.removed` | `POST /v1/operators/remove` | `{displayName, email, role, screens}` → *removed* | the deleted account's auth tokens; anything it did (that stays in its own entries) | L |
| `account.owner_changed` | API script `scripts/set-owner.mjs` | `owner: false` → `owner: true` (and the cleared sibling) | — | L |
| `audit.viewed` | opening the activity screen | none → `{filters: {from,to,eventTypes,actors}, resultCount}` | keystroke-level search text (it may contain a child's name); the entries themselves (no echo) | L |

Why log the last one: OWASP's protection section says "All access to the logs must be recorded and monitored" — and here the log is children's data ([OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).

### 2.2 Students, buses, assignments

| Event | Trigger | Before → After | Must **not** include | Vol. |
|---|---|---|---|---|
| `student.created` | direct `students` write (rules allow director `create`; **no UI today**) | *none* → `{name, grade, busId, busName}` | full document; any guardian/medical field added later | L |
| `student.removed` | direct `students` delete (rules allow; no UI today) | `{name, grade, busId, busName}` → *removed* | the reason/notes | L |
| `student.bus_changed` | `assignStudentToBus()` (`setDoc … {merge:true}`) or Assignments row | `busId: b3, busName: "Bus 3"` → `busId: b7, busName: "Bus 7"` | the full student doc; the other rows on screen | M |
| `student.unassigned` | same, `busId: null` | `busId: b3` → `null` (render "No bus", never `null`) | — | L |
| `assignment.imported` | `applyAssignmentPlan()` from the sheet dialog | *none* → `{fileName, rowsRead, moved, unchanged, unmatched, correlationId}` | **the sheet contents**; the list of 400 students in one field; the raw file | L |
| `bus.driver_assigned` / `bus.driver_cleared` | `assignDriverToBus()` — **one action writes two bus docs** | `driverUid, driverName` → new pair (+ a second entry for the bus whose driver was cleared, same `correlationId`) | the driver's phone, code, or personal email beyond the label | L |
| `bus.created` / `bus.renamed` / `bus.removed` | direct `buses` writes | `name` / none → `name` | route geometry or any future logistics data | L |

### 2.3 Attendance and runs — the high-volume, offline half

| Event | Trigger | Before → After | Must **not** include | Vol. |
|---|---|---|---|---|
| `attendance.status_changed` | `cycleStatus()` — `WAITING→BOARDED→DROPPED_OFF` | `{status, boardedAt, droppedOffAt}` → new triple, **plus** `occurredAt`/`recordedAt` | student's grade, seat, or anything not on the roster pill; the tap's coordinates | M |
| `attendance.marked_absent` | `markAbsent()` from the action sheet | `{status: WAITING}` → `{status: ABSENT, boardedAt: null, droppedOffAt: null}` | a reason (the app doesn't ask for one — do not invent one) | L |
| `attendance.corrected` | possible by rule (a director, or an operator granted Live/Students, may write attendance) but **no dashboard UI today** — all attendance writes currently come from `MobilePage` | old triple → new triple, **and** `previousActor` so the reader can say "changed from what Faisal recorded" | blame language; the driver's own earlier entry stays | L |
| `run.completed` | `completeRun()` — **one action**: run → `COMPLETED` **and** every `WAITING` student → `ABSENT` in one batch | `IN_PROGRESS` → `COMPLETED`, `autoAbsentCount: N`, `correlationId` | N separate mystery absences in the default view (see §4) | L |

`attendance.*` is where the directory breaks down: a school with 300 students produces ~600–900 transitions a day. The default reader view must **group** these ("Bus 3, morning run — 24 attendance changes") and expand on demand, or the log becomes unreadable at exactly the moment it matters.

### 2.4 School settings and data leaving the system

| Event | Trigger | Before → After | Must **not** include | Vol. |
|---|---|---|---|---|
| `school.assignment_mode_changed` | `schools/{id}.assignmentMode` write (director or operator with Assignments, one field only, enforced by rules) | `"bus"` → `"driver"` (label it: "Assignments now labelled by driver") | other school fields | L |
| `export.attendance_csv` | `buildAttendanceCsv` + `downloadCsv` in Dashboard, Students, Reports, Assignments | *none* → `{scope: day\|roll\|filtered, date\|range, rowCount, filters, columns?}` | **the rows**; the file; student names in a list | L |
| `report.printed` | `window.print()` (Reports) | *none* → `{scope, rowCount}`, outcome `requested` | — | L |
| `audit.exported` | exporting the log itself | *none* → `{format, range, rowCount}` | the exported content | L |

Two honesty notes: `report.printed` cannot be confirmed — the browser gives no reliable print-success signal, so the record says the print was *requested*. And `export.*` records that a file was produced, not where it went; the UI must not imply more.

### 2.5 The never-log list (applies to every row above)

From the OWASP "Data to exclude" list ([Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)), specialised to this app:

- **Passwords** — operator passwords, password hashes, password-reset links.
- **Access codes** — the 6-digit code, its `codeHash`, and the code's plaintext returned once by `regenerate`. `schools/{schoolId}/driverCodes` stores only a hash today; the log must not undo that.
- **Tokens** — the API `token` from `directorSignIn`/`verifyCode`, Firebase ID tokens, refresh tokens.
- **Whole records** — no full student document, no full attendance row on every tap, no sheet contents, no CSV rows. Store the diff, not the object.
- **Categories not in the model but likely next** — guardian phone numbers, medical/special-needs notes, photographs. If these fields ever land, they stay out of `changes[]` by an allowlist, not by reviewer discipline.
- **Free text** — nothing typed by a driver. The app asks for no reason field; the log must not become the place one appears.
- **Device telemetry** — IP address and user-agent for a shared bus phone add no investigative value and are PII; record `channel: mobile-driver` instead. (Judgement call, flagged.)
- **Search strings** in the audit screen's own search box (see `audit.viewed`).

Why the list is not optional: AU-3's own guidance says organisations must "consider how audit records can reveal information about individuals that may give rise to privacy risks … especially if the trail records inputs or is based on patterns or time of usage" ([AU-3](https://csf.tools/reference/nist-sp-800-53/r5/au/au-3/)). A bus log **is** a pattern-of-usage trail about children by construction; its only defence is that each entry carries the minimum.

---

## 3. The reading experience

### 3.1 What mature products do (official docs)

| | **Google Workspace** — Admin log events | **GitHub** — org audit log | **Atlassian** — org audit log | **Microsoft Purview** — Audit |
|---|---|---|---|---|
| **Default window** | **Last 7 days**, date filter removable ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | UI shows the last 3 months by default, 180 days available, older needs an explicit `created` range ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)) | "By default, activities from the past 7 days are visible" ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | **Last seven days** by default; max range 180 days, error beyond ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Default sort** | **Not documented.** The docs describe date filtering and "Manage columns" but state no sort order ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | UI **not documented**; the API exposes `order`, whose "default is desc" — newest first ([REST docs](https://docs.github.com/en/rest/enterprise-admin/audit-log)) | Table **not documented**; the ALQL query language sorts explicitly, and `ORDER BY created` *defaults to ascending, oldest first* ([docs](https://support.atlassian.com/security-and-access-policies/docs/what-is-advanced-search-in-audit-log)) | **Not documented** — "You can sort the search job items by using the column headers" ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Filter vocabulary** | Attribute + operator + value, additive with AND/OR; a long list of named attributes (Actor, Event, Date, IP, Resource type …) ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | **Structured qualifiers only**: `operation:`, `repo:`, `actor:`, `action:`, `created:`, `country:`, with `-` negation ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)) | Per-column text filters + date range + Units + activity category; advanced ALQL query for the rest ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | Date range, keyword, admin units, **activities by friendly name**, activities by exact operation name, record types, users, file/folder/site, workloads ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Search** | Filter-driven; event values are a searchable dropdown grouped by type | **"you cannot search for entries using text"** — deliberately not a text box ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)) | Text per filter, **"You must enter an exact term"** ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | Keyword search, but only "within indexed content (content within the Audit *common schema*)"; operation names must match exactly ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Pagination / limits** | Export cap 100,000 rows (30M with the investigation tool) ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | Export hard limit **100 MB compressed, 10 minutes, or both**; API cursor `before`/`after`, `per_page` max 100 ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)) ([REST](https://docs.github.com/en/rest/enterprise-admin/audit-log)) | Export CSV **10,000 rows / past 180 days**, emailed, link expires in a day ([docs](https://support.atlassian.com/security-and-access-policies/docs/export-audit-logs)) | Result sets can exceed 100k (approximate count shown); export 50,000 (Standard) / 1,000,000 (Premium) ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Human-readable vs raw** | Flat attribute table; friendly "Event" values ("Add Application") over grouped categories; API carries `CHANGE_APP_ACCESS` ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | Dotted action names (`repo.create`) quoted in the UI; the **export** carries the raw payload | Sentence-case activity names; side panel offers "copy and view the JSON data" ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | Friendly activity name in the list, exact operation name for filtering; clicking a row opens a **fly-out** with the full record ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Before/after** | First-class attributes: **"Old value — Old value of the setting in case it's updated"** and **"New value — New value of the setting in case it's updated"** ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | No generic diff column; selected events carry pairs — `before`/`after` (branch-protection override), `data.events_were`, `data.old_user`, `previous_visibility` ([event reference](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/audit-log-events-for-your-organization)) | **Not documented** as a UI diff; the side panel shows per-event JSON ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | `ModifiedProperties (Name, NewValue, OldValue)` and top-level `OldValue`/`NewValue` ([docs](https://learn.microsoft.com/en-us/purview/audit-log-detailed-properties)) |
| **Time / timezone** | "Date and time of the event (**displayed in your browser's default time zone**)", and a super admin can "Change the time zone for your investigations" ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | `created_at` is epoch ms; "Timestamps and date fields in the API response are measured in UTC epoch milliseconds" ([docs](https://docs.github.com/en/rest/enterprise-admin/audit-log)) | Separate date and time columns; timezone **not documented** ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | Explicitly labelled **"(UTC)"** in the range picker and in the result column ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Actor resolution** | Actor = email **or** a named non-human: "License manager", "Service account", "Anonymous" ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | Actor must be a **username, not a real name**: "you can only use a GitHub username, not an individual's real name" ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)) | "The actor may be a user or the Atlassian system" ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | `UserId` explicitly allows system accounts (`SHAREPOINT\system`); `UserKey` is "an empty string" when the actor isn't a user; `UserType` enumerates System/Application ([docs](https://learn.microsoft.com/en-us/purview/audit-log-detailed-properties)) |
| **Export** | Sheets or CSV, via an explicit "Export all"; also BigQuery / Reports API ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) | **JSON or CSV**, filtered by the current query, with documented keys ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)) | CSV by email, respecting the current filters ([docs](https://support.atlassian.com/security-and-access-policies/docs/export-audit-logs)) | CSV (4 columns, the payload as one `AuditData` JSON blob); JSON via the Management Activity API ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Retention** | 6 months for admin log events; "Administrators **cannot delete** log event data or change the length of time that the data is available for" ([docs](https://knowledge.workspace.google.com/admin/reports/data-retention-and-lag-times)) | 180 days in the UI; "The audit log retains Git events for seven days" ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)) | "up to 1 year" on Guard Standard/Premium; older activity "can't be recovered" ([docs](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities)) | 180 days default (non-E5), 1 year for E5-class licences ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |
| **Honesty about gaps** | "There's a small chance that reports and log event data for some events will be delayed… In rare cases, **events might not be reported**." ([docs](https://knowledge.workspace.google.com/admin/reports/data-retention-and-lag-times)) | Retention is stated, but no gap statement found | Retention end-point is stated explicitly ("can't be recovered") | "Microsoft doesn't guarantee a specific time … typically 60 to 90 minutes … doesn't commit to a specific time." ([docs](https://learn.microsoft.com/en-us/purview/audit-search)) |

**A fourth data point worth having: Stripe.** Its activity log exists only as a *preview-versioned API object* — "An activity log records a single action performed on an account" — with `actor.user.email`, `context`, `created`, `details`, and a small `type` enum (`api_key_created`, `user_invite_accepted`, `user_roles_updated`, …). There is **no documented dashboard audit-log UI, sort order, search, export or retention** ([list](https://docs.stripe.com/api/v2/iam/activity-logs), [object](https://docs.stripe.com/api/v2/iam/activity-logs/object)). It is the useful negative example: a *complete machine log* with no reader is not an answer to "the director wants to see who changed what", and a partial event enum (`api_key_*`, `user_roles_*`) silently excludes the data objects a school actually cares about.

**Two corrections to a common assumption.** Neither Google's nor Purview's docs state a default sort order — the "newest first" behaviour everyone describes is real but undocumented, which is exactly why this note marks it "not documented" rather than citing it. If we ship newest-first, we can *document* it, and that is an improvement on every product examined here.


### 3.2 What to copy

1. **Newest first, short default window, obvious widening.** Google, Atlassian and Purview all default to 7 days; GitHub shows 3 months of its 180. (Only GitHub documents its sort; ours should state "newest first" outright.) For a school, "last 7 days" is right: a director opens this after an incident, not to browse history.
2. **Structured filters, not a search box.** GitHub states outright that you cannot text-search its log; Google is attribute+operator+value; Purview offers friendly names *and* exact operation names. Copy that: an actor picker ("Everyone / System / a person"), an event-type picker grouped by object ("Students & buses ▸ Moved between buses"), a date range, and an outcome toggle. Free text only as a *within-the-loaded-set* narrow, labelled as such.
3. **Two vocabularies, one screen.** Show the human label; keep the machine name for filters and export (Purview's "friendly names" vs "operations names", Google's sentence labels vs `CHANGE_APP_ACCESS`). This is how you avoid both jargon *and* unmapped enums.
4. **Old value / New value as first-class columns**, not a JSON blob (Google and Purview do this; GitHub does it per-event).
5. **Explicit timezone.** Purview labels UTC; Google states it uses your browser's zone and lets a super admin choose another. Pick one and print it next to the times ("07:12 · school time, GMT+3").
6. **Non-human actors are named.** Google's "Service account"/"License manager", Purview's `SHAREPOINT\system`, Atlassian's "the Atlassian system". Our equivalents: "System", "Sheet import", "Automatic (run completed)".
7. **Immutable, with a stated retention.** Google's line — administrators cannot delete log data or change how long it is kept — is the model, and it maps directly onto NIST AU-9 ("Protect audit information … from unauthorized access, modification, and deletion"). The director reads the log; the director must not edit it.
8. **Say when the log is partial.** Both Google and Microsoft publish their lag and admit missing events. Do the same in the UI (§4).

Do **not** copy: GitHub's 100 MB export cliff, Purview's exact-operation-name text field (only useful to an engineer), or Google's browser-timezone rendering without a label — a director on a laptop set to another zone would silently read the wrong hour. And do not copy Stripe's shape: a machine-readable activity API with no reader at all.

### 3.3 The action line

Grammar: **`Actor (role) · verb · object · what changed`**, one sentence, values already rendered (bus *names*, not ids; screen names, not `"reports"`).

| Situation | Line |
|---|---|
| Bus move | "Sara M. (operator) moved Yusuf K. from Bus 3 to Bus 7." |
| Driver tap | "Faisal A. (driver) recorded Noura H. as boarded at 06:42." |
| Late sync | "Faisal A. (driver) recorded Noura H. as boarded at 06:42 — synced at 07:15." |
| Screens | "Ahmed K. (main director) added the Reports screen to Omar S." |
| Code | "Ahmed K. (main director) generated a new access code for Faisal A." |
| Import | "Sheet import (Ahmed K.) moved 34 students; 6 buses; 2 rows unmatched." |
| Cascade | "Faisal A. (driver) completed Bus 3's morning run; 4 unrecorded students marked absent." |
| Failure | "Sign-in failed for a@b.c (wrong password)." — never "Invalid credentials" alone |

Google's own generated sentence uses exactly this from→to shape — *The account setting of "New Features" was changed from value1 to value2.* ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)) — which is the strongest evidence that "X changed Y from A to B" is the pattern, not just a nice idea.

Bilingual/RTL constraints (repo rules, `AGENTS.md`): the sentence is an i18n dictionary entry per `eventType`, never a concatenation of English fragments; the values are variants. Arabic must render with the app's own formatters (`ar-EG`, Eastern Arabic digits) and Latin identifiers/emails must be bidi-isolated so an id inside an RTL sentence does not reorder. Times: show 24-hour or the app's 12-hour convention consistently — do not mix, and never mix digit systems within a row.

---

## 4. Edge cases, and the rule for each

| # | Case | What actually happens | The rule |
|---|---|---|---|
| 1 | **Actor deleted** (operator removed via `/v1/operators/remove`, or a driver's account) | The uid no longer joins to a profile; a naive reader renders a uid or `unknown@example.com` | Snapshot `actor.label` + `actor.role` + `actor.email` **at write time** and render those. Tenure is a fact about the event, not about today. Never render a bare uid, and never substitute a placeholder email for a real one. |
| 2 | **Actor renamed** | Resolving the current name rewrites history; searching the old name finds nothing | Same snapshots as (1); annotate "now known as …" **only** as a secondary line. Search must match both the snapshot and the current name. Google documents the failure this prevents: after a rename you "will not see results for events related to" the old address ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)). GitHub keeps the old identity in the payload as `data.old_user` ([export keys](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)). |
| 3 | **Clock skew** (device ahead/behind) | Device time and server time disagree; an ordering by device time is wrong | Store `occurredAt` (device, with offset) **and** `recordedAt` (server, UTC). Order the default list by `recordedAt`; show `occurredAt` when it differs by more than ~2 minutes, with a neutral label ("device time 07:12"). Do not silently "correct" either. NIST SP 800-92 §2.3.1 gives the canonical example of A apparently preceding B when it did not. |
| 4 | **Out-of-order arrival** | A backgrounded phone flushes writes late; entries interleave with later events | Never re-sort by arrival and call it event order. Two primitives: "when it reached the school's system" (`recordedAt`, default sort) and "when it happened" (`occurredAt`, shown when known). AU-12(1) asks for a trail "time-correlated to within [an organization-defined] level of tolerance" — so state the tolerance you can actually hold. |
| 5 | **Offline driver writes land later** | `cycleStatus()` queues in Firestore's local cache; the queued `serverTimestamp()` resolves on the server when the write lands, so the recorded time is the **sync** time, not the tap. Firebase documents both halves: with the network off, "Write operations are queued until network access is re-enabled", and a pending server timestamp reads back as **null** locally — `serverTimestamps` options "estimate \| previous \| none", where "If omitted or set to 'none', null will be returned by default until the server value becomes available" ([SnapshotOptions](https://firebase.google.com/docs/reference/node/firebase.firestore.SnapshotOptions), [offline docs](https://firebase.google.com/docs/firestore/manage-data/enable-offline)). This repo's own comment says the same at `src/lib/school-data.ts` | Capture `occurredAt` on the device **at tap time** and send it with the write; keep `serverTimestamp()` as `recordedAt`. Mark `timeConfidence: skewed/unknown` when the device clock can't be trusted. OWASP Note C covers exactly this: on a device you don't control, "attempt to measure the time offset, or record a confidence level in the event timestamp". **Today this data does not exist** — the app records only `serverTimestamp()`, so pre-launch attendance timestamps are already ack-time. Flag to the team; it is not recoverable retroactively. |
| 5b | **No cross-document ordering guarantee** | Two taps on two different children can arrive in either order; Firestore documents only per-document last-write-wins ("For multiple changes to the same document, it's last write wins"), not a global FIFO ([add-data docs](https://firebase.google.com/docs/firestore/manage-data/add-data)) | Never derive causality from arrival order across documents. Use the device `occurredAt` for "what happened first on the bus" and say so; use `recordedAt` for "what the school learned first" and say that too. A log that conflates them will confidently tell a false story. |
| 6 | **No actor** (system, import, trigger, migration) | A blank actor column reads as "someone hid it" | `actor.kind: system\|import\|trigger` with a real label ("Sheet import", "Automatic at run completion", "Scheduled cleanup"). Purview's model — `UserId` may be a system account and `UserKey` is empty when the actor isn't a user — is the precedent. Never use "System" for something a person did. |
| 7 | **Empty state** | A blank table reads as "nothing happened", which is a different claim from "nothing recorded" | Distinguish: "No activity in the last 7 days" (window) vs "Nothing matches these filters" (filter) vs "Activity recording starts on <date>" (coverage). Offer the one action that helps: widen the range / clear the filter. |
| 8 | **The log is incomplete** | Offline windows, a failed writer, or a feature that shipped later | Treat coverage as data: a `coverage` record (first entry, last writer version, gaps) and a persistent banner when the selected range predates it. Say "attendance from Bus 3 synced at 07:15" rather than pretending the morning had no events. Both Google and Microsoft publish their lag and admit dropped events — a school app should be no less honest. |
| 9 | **One action, many documents** (run completion; driver swap) | `completeRun()` writes the run **and** up to N attendance docs; `assignDriverToBus()` writes two buses | One `correlationId`; a summary entry (`run.completed`, `autoAbsentCount`) plus optionally the children entries. The reader must never show 40 unexplained "marked absent" rows with no cause. |
| 10 | **Duplicate writes** (offline retry, double tap) | The same tap can be replayed after reconnect | Client-generated `dedupeKey`; writer upserts on it. (The app already guards the double tap at 350 ms in the UI — that protects the record, not the log.) |
| 11 | **Completed runs are locked** | No status edits after sign-off (by design) | The log needs no "unlocked" event today, but the reader should not imply edits are possible. If a director override is ever added, it is `attendance.corrected`, not another `status_changed`. |
| 12 | **Very large ranges / exports** | An unbounded list is a performance bug and a data-protection problem | Cursor pagination (`startAfter`), page size 50–100, default 7 days; export capped and the cap **stated** ("Exports are limited to the 5,000 most recent matching events"). Every product examined here caps and states the cap (100k rows / 100 MB / 50k rows / 10k rows). |
| 13 | **Timezone / DST boundary** | "Today" bucketed in UTC puts a 23:30 local event on tomorrow | Bucket days in the school's timezone, store ISO-8601 with offset, print the zone next to the column header. AU-8 permits UTC *or* a fixed offset *or* an offset in the stamp — pick "UTC stored + school zone rendered" and never a bare local time. |

---

## 5. Diff presentation — the smallest honest version

**The rule:** show the *fact* in the sentence, the *fields that changed* in a two-column table, and nothing else. Everything unchanged, every raw value, and every id belongs behind one "technical details" disclosure.

| Do | Don't |
|---|---|
| One row per changed field: `Bus — Bus 3 → Bus 7` | A JSON blob of the whole document |
| Render values the reader recognises (bus name, screen label, "Boarded") | `busId: "b7"`, `screens: ["reports"]`, `status: "DROPPED_OFF"` |
| Empty before on creation, empty after on deletion, labelled ("Created", "Removed") | `null → "Bus 7"` with no explanation |
| Group a multi-field change under one entry | N separate entries that all share a timestamp |
| Show the field list only for fields in the allowlist | Dumping whatever the document contained that day |

Precedents: Google ships **Old value / New value** as first-class attributes ([docs](https://knowledge.workspace.google.com/admin/reports/admin-log-events)); Purview ships `ModifiedProperties (Name, NewValue, OldValue)` ([docs](https://learn.microsoft.com/en-us/purview/audit-log-detailed-properties)); GitHub's export carries current and previous values side by side (`data.events` / `data.events_were`) ([docs](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)). A pair of columns is the whole pattern; the diff *algorithm* is not needed for the reader.

**Machine format, if one is ever needed:** store `changes[]` as before/after pairs (it is lossless and readable). If an export must be a patch, derive a [JSON Patch, RFC 6902](https://www.rfc-editor.org/rfc/rfc6902.html) (`replace`/`add`/`remove` per JSON Pointer) at export time — note that JSON *Merge* Patch ([RFC 7396](https://www.rfc-editor.org/rfc/rfc7396.html)) cannot express the old value, which is precisely the point of this log.

**Text diff is the wrong tool.** A unified diff of serialized JSON is honest and unreadable; it belongs in a support bundle, not the director's screen. The one place line-level red-lining earns its keep is comparing two imported sheets — not here.

---

## 6. Privacy and compliance constraints on the reader side

### 6.1 The log is itself student data

- **Minimisation.** ICO: personal data must be "adequate, relevant and limited to what is necessary in relation to the purposes" (Art. 5(1)(c), quoted in [ICO — data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)). Every field in §1.2 must earn its place against the question "who changed what, when".
- **NIST says the same thing about audit trails specifically:** AU-3 guidance warns of "the potential to reveal personally identifiable information in the audit trail, especially if the trail records inputs or is based on patterns or time of usage", and AU-3(3) requires limiting PII "to the following elements identified in the privacy risk assessment" ([AU-3](https://csf.tools/reference/nist-sp-800-53/r5/au/au-3/)). A boarding log is a time-of-usage pattern about children — the enhancement is written for exactly this.
- **FERPA.** "Education records" are "those records that are: (1) Directly related to a student; and (2) Maintained by an educational agency or institution" ([34 CFR §99.3](https://www.govinfo.gov/content/pkg/CFR-2024-title34-vol1/xml/CFR-2024-title34-vol1-sec99-3.xml)). An activity log of changes to a student's bus and attendance is directly related and maintained, so it is **very likely an education record in its own right** — *flagged as inference: the regulation defines the category, it does not name audit logs.* Treat it accordingly until counsel says otherwise.
- **"Directory information" will not rescue it.** §99.3 lists "dates of attendance" as directory information but immediately excludes "specific daily records of a student's attendance". So a child's boarding/drop-off record is **not** directory information, cannot be treated as publishable/low-sensitivity, and needs FERPA-grade handling. PII also covers information that "alone or in combination, is linked or linkable to a specific student that would allow a reasonable person in the school community … to identify the student with reasonable certainty" (§99.3) — a student name plus a bus plus a time qualifies.

### 6.2 Access: who may read what

- **FERPA does not require an internal-access log.** §99.32's duty is "a record of each **request for access to** and each **disclosure** of personally identifiable information from the education records", with the parties and their legitimate interests — and the Department's own FAQ says schools "do not have to record disclosures of PII from education records that were made to: 1) the parent or eligible student; **2) a school official under § 99.31(a)(1)**" ([34 CFR §99.32](https://www.govinfo.gov/content/pkg/CFR-2024-title34-vol1/xml/CFR-2024-title34-vol1-sec99-32.xml), [ED FAQ](https://studentprivacy.ed.gov/frequently-asked-questions)). What FERPA *does* require is access **control**: schools "must use reasonable methods to ensure that school officials obtain access to only those education records in which they have legitimate educational interests", satisfied by "physical or technological access controls" or an effective administrative policy (§99.31(a)(1)(ii); ED FAQ). So the value of this log is **accountability and dispute resolution**, not FERPA compliance — say that plainly when scoping it. Building it helps you *demonstrate* the §99.31 control; it is not the control itself.
- **Who may inspect the access record.** §99.32(c): "(1) The parent or eligible student. (2) The school official or his or her assistants who are responsible for the custody of the records. (3) Those parties authorized in §99.31(a)(1) and (3) for the purposes of auditing the recordkeeping procedures." That supports the current rule (directors read the audit collection) and argues for **not** giving drivers or ordinary operators the full log.
- **Practical split for this app:** *main director + directors* — everything (matches `firestore.rules`, `allow read: if … isDirector()`); *operators* — at most their own account events and events scoped to their granted screens, and no bulk student lists; *drivers* — none; their own actions are visible to them through the run, which is the record they need. Any widening is a policy change, not a UI setting.
- **Parents.** §99.10(a) gives a parent the right to "inspect and review the student's education records", and §99.10(b) requires compliance "within a reasonable period of time, but not more than **45 days**". If the log is an education record, a parent request can reach it. The screen should therefore make "everything about this child" extractable (filter by student) — otherwise staff will answer such requests by hand, badly.
- **Destruction.** §99.10(e): the school "shall not destroy any education records if there is an outstanding request to inspect and review". A retention purge must be able to pause. Combine with §99.32(a)(2): the disclosure record is kept "as long as the records are maintained".
- **The export is the leak, not the screen.** FERPA conditions disclosure on the recipient not re-disclosing "without the prior consent of the parent or eligible student" (§99.33(a)(1)), and GDPR Art. 32(4) requires that anyone "who has access to personal data does not process them except on instructions from the controller". A CSV of a child's movement history is a portable, uncontrolled copy: cap it, watermark it with who exported it, and log the export (which is exactly what `export.*` / `audit.exported` do in §2.4).

### 6.3 Retention

- NIST sets no number: retain "for [an organization-defined time period]"; the parameter is deliberately blank, guided by "administrative, legal, audit, or other operational purposes" ([AU-11](https://csf.tools/reference/nist-sp-800-53/r5/au/au-11/)). Names and timings of review (AU-6) are likewise organisation-defined.
- ICO: "The UK GDPR does not set specific time limits… This is up to you"; you must "be able to justify" it, have "a policy with standard retention periods", and "regularly review… erase or anonymise" ([ICO — storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)). Also: pseudonymised data "will usually still permit identification", so pseudonymising student names does **not** escape the retention rule.
- **The processing record already expects a number.** GDPR Art. 30(1) requires controllers to "maintain a record of processing activities", and Art. 30(1)(f) requires "where possible, the envisaged time limits for erasure of the different categories of data" ([EUR-Lex, Reg. 2016/679](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679)). Picking a retention period is therefore not optional tidying — it is a documented input to the school's ROPA, and the same number belongs in both places.
- What mature products chose (useful anchors, not law): Google 6 months; GitHub 180 days; Purview 180 days (1 year on E5). **Recommendation for this app: 12 months, configurable, stated in the UI and in the school's retention schedule** — long enough to cover a term-plus-appeal, short enough to be justifiable for children's data. The app's existing 90-day roll window (`ROLL_SUMMARY_DAYS`) is an *analytics* horizon, not a retention policy; do not let the log inherit it by accident.
- **Deletion vs erasure.** If a student is removed, do not leave a rich, name-bearing history forever: either purge that student's entries at the retention boundary or replace `target.label` with "Student (removed)" while keeping ids/`schemaVersion` so counts still reconcile. Note the tension: FERPA's §99.32 keeps *disclosure* records for as long as the education records are maintained, so this decision is a school-policy call, not an engineering preference.

### 6.4 Children's data, and the jurisdiction flag

GDPR Recital 38: "Children merit specific protection with regard to their personal data, as they may be less aware of the risks, consequences and safeguards concerned and their rights" ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679)). Two precision notes so this is not over-read:

- **Art. 8 does not govern a school's internal tool.** It sets the consent conditions for "the offer of information society services directly to a child" ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679)); a school processing attendance under public-task/legal-obligation bases is outside it.
- **The ICO Children's Code does not apply here either.** Its scope test is "information society services likely to be accessed by children", including "news or educational websites", and it "is not restricted to services specifically directed at children" ([ICO — services covered](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/)). A staff-only admin console is not an ISS. Citing the Code as authority for this screen would be wrong; the *sensitivity premise* it embodies is still the right instinct.

The operational consequences are modest and concrete: minimise, restrict to directors, state retention, log who viewed the log, and never let an export become an uncontrolled copy. And the log earns its keep at the worst moment: Art. 33(1) requires breach notification "not later than 72 hours after having become aware of it" ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679)) — an activity trail is how a school reconstructs what was exposed in time to answer that question.

**Flag:** FERPA (US) and GDPR/ICO (EU/UK) are the regimes with citable primary text. This app is bilingual en/ar and may well be deployed in the Gulf, where UAE Federal Decree-Law 45/2021 or Saudi PDPL would apply instead. Official sources could not be retrieved (the SDAIA PDPL PDF returned 404, the UAE legislation portal 403), so nothing is asserted about them; if that is the deployment target, the retention and access sections need a local review. *(The repo gives no jurisdiction hint either.)*

**Art. 30 note (to avoid a common conflation):** a record of processing activities (GDPR Art. 30) is a *register of processing operations*, not a log of individual events. This screen can **support** Art. 30/32/33 obligations — showing who touched what, and providing the timeline a breach assessment needs — but it is not the ROPA, and building it does not discharge that duty.

---

## 7. Anti-patterns

| Anti-pattern | What it looks like | Why it's wrong (source) | Do instead |
|---|---|---|---|
| **Unmapped jargon** | "bus.driverUid updated", "assignmentMode PATCH" | AU-3 requires the record to *establish* what/who; a director cannot establish anything from a field name | Human label per event; machine name only in filters/export (Purview's two-name model) |
| **Raw enum values** | `DROPPED_OFF`, `"reports"`, `owner:true` | The app already speaks both languages — an enum on screen is a third, untaught one | Render via the same dictionary the rest of the UI uses |
| **Unmapped uids** | `actor: "kR3x…"`, `target: "b7"` | Purview names system accounts rather than leaving holes; a uid answers nothing | Snapshot labels; uid only in technical details |
| **`user@example.com` for a deleted account** | A placeholder email standing in for a real person | Google's rename caveat shows how identity resolution decays; a fake email destroys the record's credibility | Snapshot at write time; "Removed account — Sara M. (operator)" |
| **No timezone** | "07:12" with no zone, or a bare UTC timestamp read as local | AU-8 requires UTC, a fixed offset, or an offset in the stamp; Purview prints "(UTC)", Google says whose zone it uses | Pick a convention, label it, store ISO+offset |
| **Unbounded lists** | "Showing all events", export with no cap | Google 100k rows, GitHub 100 MB/10 min, Atlassian 10k, Purview 50k — each product examined caps | Cursor pages, default 7 days, stated cap |
| **Search that lies** | A text box that only matches some fields, or silently misses old names | Google documents that renamed users become unfindable by their old name; GitHub avoids the pretence entirely | Scope the search explicitly ("searches actor, object and event labels, as recorded at the time"); search snapshots *and* current names |
| **Log as telemetry dumping ground** | Render errors, cache misses, "user navigated to Reports" | OWASP: process/audit/transaction logs "are usually collected for different purposes… they should be kept separate"; a mixed log is unreadable and dilutes the audit trail | Two sinks. This screen shows auditable actions only. |
| **Missing outcome** | Failed and successful sign-ins render identically | AU-3 lists "outcome" as a required element; Purview has `ResultStatus` | Outcome chip on every row; filter by it |
| **Editable/deletable log** | A director can clear entries, or retention is per-user | AU-9: protect audit information "from unauthorized access, modification, and deletion"; Google: administrators cannot delete log data | Append-only; writer credentials only on the server; deletion only by retention policy |
| **Silent truncation** | The list just stops at 50, or starts mid-history with no note | Google publishes its lag and admits events "might not be reported"; Purview refuses to commit to a delivery time | "Showing the most recent 50" + coverage banner + "load older" |
| **Fake totals** | "1,204 events" from a capped scan | Cheap-to-compute counts over truncated windows are wrong by construction | Omit the total, or compute it exactly and label it |
| **Blocking the driver on the log** | The tap waits for the audit write, or fails when it fails | The driver's primary job is the safe record of who is on the bus; the app is offline-first by design (`AGENTS.md`) | Audit write is downstream and non-blocking; if it fails, surface "N actions not recorded" to the director |
| **Block-level diff** | A JSON diff of the whole doc under every row | Unreadable, and it re-publishes PII the record didn't need | Changed fields only (§5) |
| **One entry per affected row with no cause** | 40 "marked absent" rows after a run is completed | The director cannot tell a cascade from 40 human decisions | One summary entry + `correlationId` |

---

## 8. What the screen must do — checklist

**Data**
- [ ] Every entry carries the §1.2 required fields; `eventType` comes from a closed enum with an i18n label per language.
- [ ] `occurredAt` (device, ISO + offset) and `recordedAt` (server, UTC) are separate; `timeConfidence` is set when they disagree materially.
- [ ] Actor identity is snapshotted (`uid`, `role`, `label`, `email`) at write time; non-human actors are labelled, never blank.
- [ ] `changes[]` is an allowlisted before/after list — never a whole-document snapshot.
- [ ] One `correlationId` per user action that touches more than one document.
- [ ] Append-only: no client write path, no director-facing delete, retention enforced by a scheduled job.

**Reading**
- [ ] Default: newest first, last 7 days, grouped by day, school timezone labelled (and stored UTC/offset).
- [ ] Each row: time · actor + role · sentence · outcome chip. No ids, no enum names.
- [ ] The sentence names the object the way the rest of the app does (Bus 3, Reports, Boarded).
- [ ] Filters: date range, actor (incl. System/Import), event type grouped by object, outcome. Every filter has an "all" state that is visibly in effect.
- [ ] Search states its scope and searches snapshot names as well as current ones.
- [ ] High-volume attendance is collapsed by run/bus in the default view and expands on demand.
- [ ] Row expands to a two-column before/after table (changed fields only), then a "technical details" disclosure (event id, schema, uids, raw JSON).
- [ ] Empty state distinguishes "no activity", "no matches", and "not recorded from this date".
- [ ] Coverage banner whenever the selected range predates the log or overlaps a known sync gap.

**Edges**
- [ ] Deleted/renamed actor renders from the snapshot, with "removed account" language — never an email placeholder or a uid.
- [ ] Device time shown next to server time when they differ; ordering never pretends to be both.
- [ ] Cascade actions read as one cause ("run completed; 4 unrecorded students marked absent"), not N orphan rows.
- [ ] Offline-synced driver actions are identifiable ("synced at …").
- [ ] Duplicate writes are impossible to display twice.

**Out**
- [ ] CSV (both languages, Arabic headers and digits working in Excel) for the current filter; JSON for support.
- [ ] Exports capped, the cap stated, and the export itself logged (`audit.exported`).
- [ ] `audit.viewed` records who opened the screen and the filter set — not the typed search text, not the entries.

**Privacy**
- [ ] Never-log list (§2.5) enforced by an allowlist in the writer, not by review.
- [ ] Retention period chosen, shown in the UI, recorded in the school's retention schedule, and enforced.
- [ ] Access: directors read everything; operators limited; drivers none — matching `firestore.rules`, not contradicting it.
- [ ] Filter-by-student exists, so a parental access request (§99.10, 45 days) can be answered from the screen.
- [ ] Retention job refuses to purge while an access request is open (§99.10(e)).

---

### Appendix — primary sources used

| Source | Link | Used for |
|---|---|---|
| NIST SP 800-92 (2006) | [csrc.nist.gov/pubs/sp/800/92/final](https://csrc.nist.gov/pubs/sp/800/92/final) ([PDF](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-92.pdf) — 406 to our fetcher) | clock skew, NTP, UTC normalisation, retention-as-policy, digest integrity; **not** the field list |
| NIST SP 800-53 Rev 5 — AU-2/3/8/9/11/12 | [OSCAL catalog](https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json), [AU-3 mirror](https://csf.tools/reference/nist-sp-800-53/r5/au/au-3/) | the required field set, timestamps, protection, retention |
| OWASP Logging Cheat Sheet | [link](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | when/where/who/what, action/object/result/reason, exclusions, log protection |
| OWASP Logging Vocabulary | [link](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html) | event naming, ISO 8601 + offset, from→to attributes |
| Google Workspace — Admin log events | [link](https://knowledge.workspace.google.com/admin/reports/admin-log-events) | attributes, Old/New value, filters, export, rename caveat, timezone |
| Google Workspace — retention & lag | [link](https://knowledge.workspace.google.com/admin/reports/data-retention-and-lag-times) | 6 months, immutable to admins, "events might not be reported" |
| GitHub — org audit log | [link](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization) | naming, no text search, export keys/limits, 180 days |
| GitHub — REST audit log & event reference | [REST](https://docs.github.com/en/rest/enterprise-admin/audit-log) · [events](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/audit-log-events-for-your-organization) | `order` default desc, UTC epoch ms, per-event `before`/`after` |
| Atlassian — org audit log | [view](https://support.atlassian.com/security-and-access-policies/docs/view-audit-log-activities) · [ALQL](https://support.atlassian.com/security-and-access-policies/docs/what-is-advanced-search-in-audit-log) · [export](https://support.atlassian.com/security-and-access-policies/docs/export-audit-logs) | 7-day default, exact-term search, JSON side panel, 1-year retention, 10k export |
| Stripe — activity log API (preview) | [list](https://docs.stripe.com/api/v2/iam/activity-logs) · [object](https://docs.stripe.com/api/v2/iam/activity-logs/object) | the "machine log, no reader" counter-example |
| Microsoft Purview — audit search | [link](https://learn.microsoft.com/en-us/purview/audit-search) | default range, UTC, columns, fly-out, export caps, latency |
| Microsoft Purview — detailed properties | [link](https://learn.microsoft.com/en-us/purview/audit-log-detailed-properties) | `ModifiedProperties`, `ResultStatus`, `CreationTime`, `UserType` for system actors |
| FERPA — 34 CFR §99.3 / §99.10 / §99.32 | [§99.3](https://www.govinfo.gov/content/pkg/CFR-2024-title34-vol1/xml/CFR-2024-title34-vol1-sec99-3.xml) · [§99.10](https://www.govinfo.gov/content/pkg/CFR-2024-title34-vol1/xml/CFR-2024-title34-vol1-sec99-10.xml) · [§99.32](https://www.govinfo.gov/content/pkg/CFR-2024-title34-vol1/xml/CFR-2024-title34-vol1-sec99-32.xml) | education record, directory information, access rights, disclosure record |
| US Dept of Education — FERPA FAQ | [studentprivacy.ed.gov](https://studentprivacy.ed.gov/frequently-asked-questions) | internal school-official access is exempt from §99.32; access-control duty |
| GDPR — Regulation (EU) 2016/679 | [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679) | Art. 5, 8, 15, 17, 30, 32, 33; Recital 38 |
| ICO — data minimisation | [link](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/) | Art. 5(1)(c) |
| ICO — storage limitation | [link](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/) | Art. 5(1)(e), no fixed periods, pseudonymisation |
| ICO — Children's Code scope | [link](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/) | why it does *not* apply to a staff-only console |
| Firebase — SnapshotOptions / offline / add data | [SnapshotOptions](https://firebase.google.com/docs/reference/node/firebase.firestore.SnapshotOptions) · [offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline) · [add data](https://firebase.google.com/docs/firestore/manage-data/add-data) | pending `serverTimestamp` reads null; queued writes; per-document last-write-wins |
| RFC 6902 — JSON Patch | [link](https://www.rfc-editor.org/rfc/rfc6902.html) | machine-readable diff, if ever needed |

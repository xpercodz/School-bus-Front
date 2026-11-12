# Firestore backups and point-in-time recovery

**Written for the state after the Blaze upgrade.** `school-bus-a4f23` is on Spark
today: scheduled backups, restores and PITR are all unavailable, because every
one of them is gated on billing being enabled. Nothing in this runbook can be run
until billing is attached to the project — the commands are correct, they just
refuse.

Two things are often confused and are separate features here:

- **Scheduled backups** — a copy of the whole database taken once a day or once a
  week, kept for a retention period you choose, restorable to a **new database**.
- **Point-in-time recovery (PITR)** — a rolling 7-day history at one version per
  minute, readable at an arbitrary whole-minute timestamp, off by default.

Neither is a restore-in-place feature. Read [What a restore actually
does](#what-a-restore-actually-does) before you need it, not during the incident.

## What is and is not available on Spark

Not available, and not a permissions problem:

- **Scheduled backups** and **restore**. The backups page opens with a billing
  prerequisite: "Make sure that billing is enabled for your Google Cloud
  project." ([backups](https://cloud.google.com/firestore/docs/backups)).
- **PITR**. "PITR storage doesn't have a free tier and you must have billing
  enabled if you want to use PITR"
  ([PITR overview](https://cloud.google.com/firestore/docs/pitr)).

Available on Spark and unchanged by the upgrade: reads and writes inside the free
daily quota, Security Rules, composite and single-field indexes, the rules editor
in the console, the TTL *policy* configuration, and the console's database
management pages. The free Firestore quota does not change with the plan — it is
the same 1 GiB stored, 50,000 document reads, 20,000 writes and 20,000 deletes per
day on Blaze ([Firestore pricing](https://cloud.google.com/firestore/pricing)).

The gap on Spark is therefore not a missing safety net for a large dataset. It is
that a destructive write today is unrecoverable, and that a rehearsal of the
recovery procedure below is impossible until billing is on.

## The Blaze requirement

Turning on billing is a project-level action, then a role check:

```bash
# Confirm the project is on a billing account. Spark shows an empty billingAccountName.
gcloud billing projects describe school-bus-a4f23
```

Managing backup schedules and restores needs Firestore IAM roles, any of which
`roles/datastore.owner` already covers
([backups](https://cloud.google.com/firestore/docs/backups)):

| Role | Use |
| --- | --- |
| `roles/datastore.backupSchedulesAdmin` | create / update / delete schedules |
| `roles/datastore.backupSchedulesViewer` | list / describe schedules |
| `roles/datastore.backupsAdmin` | read backups |
| `roles/datastore.restoreAdmin` | initiate a restore |

Every command below takes a database ID. The project has one database, so the ID
is `(default)` — and `(default)` is also what the app passes as its database ID
today, by omission, in both the browser client and the Admin SDK.

```bash
gcloud firestore databases list --project school-bus-a4f23
```

Everything in this runbook was checked against the docs and against the installed
`gcloud` (587.0.0) help output on 2026-11-12; see the PITR section for the one
place the docs and the CLI disagree.

## Creating a daily schedule and a weekly one

Per database you get **at most one daily and one weekly schedule**, and you cannot
run several weeklies on different days. The time of day is not configurable:
"Backups are taken at different times each day"
([backups](https://cloud.google.com/firestore/docs/backups)).

```bash
# Daily, at whatever hour Firestore picks.
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=14w
```

```bash
# Weekly, on a named day. DAY is SUN MON TUE WED THU FRI SAT.
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=weekly \
  --retention=14w \
  --day-of-week=SUN
```

- `--retention` tops out at **14 weeks** (`14w`); the Terraform equivalent states
  the ceiling as 8467200s. Durations are of the `7d` / `14w` form — the backups
  page's examples use `14w`, the CLI's own help uses `7d`.
- The daily schedule with 14 weeks of retention keeps **98 backups**, all of them
  charged. See [Costs](#costs) before copying that flag — for this project's
  budget a shorter daily retention is the sane default.
- **Recurrence is immutable.** `schedules update` changes `--retention` only: "you
  cannot update its recurrence. If you need a backup schedule with a different
  recurrence, delete the old backup schedule ... and create a new backup schedule"
  ([backups](https://cloud.google.com/firestore/docs/backups)).
- Backups stay in the database's location, and creating or retaining them does not
  affect live read or write performance, so no maintenance window is needed.

Manage them:

```bash
gcloud firestore backups schedules list --database='(default)'
gcloud firestore backups schedules describe \
  --database='(default)' --backup-schedule='SCHEDULE_ID'
gcloud firestore backups schedules update \
  --database='(default)' --backup-schedule='SCHEDULE_ID' --retention=7d
gcloud firestore backups schedules delete \
  --database='(default)' --backup-schedule='SCHEDULE_ID'
```

Listing the backups themselves is a different command, and it is location-scoped
rather than database-scoped:

```bash
gcloud firestore backups list \
  --location=us-central1 \
  --format="table(name, database, state)"
```

Deleting a schedule does **not** delete the backups it already made; they expire
at the end of their retention period or go with `gcloud firestore backups delete
--location=us-central1 --backup=BACKUP_ID`, which is irreversible
([backups](https://cloud.google.com/firestore/docs/backups)).

## What a restore actually does

A restore writes the backup **into a new database with a new ID**. It does not
overwrite the damaged one, and there is no in-place option:

> "A restore operation writes the data from a backup to a new Firestore database."
> — [backups](https://cloud.google.com/firestore/docs/backups)

That single fact is the whole shape of the recovery procedure: the data comes back
in a database the app is not pointed at, so the restore is only half the job. The
other half is repointing the app and re-applying everything a backup does not
carry.

What the backup contains: all data and index configurations
([backups](https://cloud.google.com/firestore/docs/backups)).

What it does **not** contain, per the same page and the post-restore checklist:

- **TTL policies.** "TTL policies are not included in backups and are not
  automatically reapplied to restored databases." This database carries two: the
  audit retention on `schools/{schoolId}/audit`, and the collector for the durable
  `codeAttempts` guess counter. Both are re-applied by hand, so neither is optional.
- **Security Rules.** "The rules for a database that was not previously used
  prohibit all reads and writes from web and mobile clients" until rules are
  published for it — so the app is not merely unindexed after a restore, it is
  locked out.
- **IAM.** The checklist says to verify appropriate IAM controls on the new
  database; bindings attached to the old database (if any) are not what you get.
- App Engine search data and blob entities from a `(default)` database, which is
  irrelevant to this project (Native mode, no App Engine) but worth knowing if the
  error text mentions it.

Also note: deleting the source database does not delete its backups, so a "delete
the old one" step during an incident cannot take the evidence with it.

### Recovery procedure, in order

Do these in order. Steps 2 and 3 are what people skip, and skipping them leaves a
restored database the app either cannot read or cannot write to.

**1. Create the new database by restoring a backup.**

```bash
gcloud firestore databases restore \
  --source-backup=projects/school-bus-a4f23/locations/us-central1/backups/BACKUP_ID \
  --destination-database='school-bus-restore-2026-11-20'
```

- The destination is created in the backup's location, and its ID must be unused.
  A valid ID is 4–63 characters, lowercase letters, digits and hyphens, starts with
  a letter, ends with a letter or digit, and must not look like a UUID
  ([multiple databases](https://firebase.google.com/docs/firestore/manage-databases)).
  The default database's own ID is `(default)`, and an ID already in use is
  rejected.
- Pick the newest backup taken **before** the corruption, not the newest overall.
  With an uncontrolled time of day, that usually means yesterday's.
- Watch it finish; the restore is long-running and the database is not accessible
  until it completes:

```bash
gcloud firestore operations list --database='school-bus-restore-2026-11-20'
```

**2. Repoint the app.** Two independent edits, in two independent repos.

- Browser client — `src/lib/firebase.ts` in this repo. The single init call is
  `initializeFirestore(app, settings)`, and the named database is its **third
  argument**: `initializeFirestore(app, settings, databaseId)`. Neither repo sets a
  database ID today, so this is an edit, not a setting. The installed Firebase 12
  typings mark the named-database overload `@beta`; the app-side helper is what
  carries it.
- Admin SDK — `src/firebase-admin.ts` in `School-bus-API`. The accessor builds the
  instance as `getFirestore(app)` where `app = getApp()`; the named form is
  `getFirestore(app, databaseId)`.
- Deploy both. Hosting and the API are separate deploys. A half-done repoint — one
  side moved, the other not — has the client and the server reading and writing
  different databases with no error anywhere, and the roll is the first moment you
  would notice.
- Offline queue: the persistent cache in `src/lib/firebase.ts` belongs to one
  Firestore instance. Attendance writes queued against the old database are not
  replayed into the new one; a driver who was offline through the roll keeps those
  taps in the old cache until they are discarded. Say so out loud when you roll.

**3. Re-apply both TTL policies** on the new database. The audit policy is the
`expiresAt` field on the `audit` collection group:

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=audit \
  --database='school-bus-restore-2026-11-20' \
  --enable-ttl
```

The second is the collector for `codeAttempts`, the durable per-IP guess counter.
The API writes `expiresAt` on every bucket document, but only a TTL policy deletes
them (`School-bus-API/README.md` documents it as a one-time setup):

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=codeAttempts \
  --database='school-bus-restore-2026-11-20' \
  --enable-ttl
```

Confirm both landed, because a restored database reports no TTL field until it is
re-applied:

```bash
gcloud firestore fields ttls list --database='school-bus-restore-2026-11-20'
```

TTL deletion itself is not instant — "data is typically deleted within 24 hours
after its expiration date" — so the collection will keep expired entries for a
while after the policy is back
([TTL](https://cloud.google.com/firestore/docs/ttl)).

**4. Re-apply Security Rules.** Deploy `firebase/firestore.rules` to the new
database ID. The Firebase CLI deploys rules per database, and this repo's
`firebase.json` has a single `firestore` block that names no database — so
`npm run deploy:rules` addresses the default database until that block is extended
to the new one. Check which database the configuration and the deploy output are
addressing before you trust it, or publish the same rules from the console's rules
editor for that database
([rules](https://firebase.google.com/docs/firestore/security/get-started)).

**5. Re-apply IAM.** The Cloud Run runtime service account already holds
`roles/datastore.user` at project level, which covers a new database in the same
project — that part needs nothing. What does need checking is any binding scoped to
the **old** database: the checklist's "verify that appropriate IAM controls are
applied to your new database" is about exactly those
([backups](https://cloud.google.com/firestore/docs/backups)).

**6. Verify.** Do not skip to step 7 on the strength of a successful restore.

- Sign in as a director against the deployed site (this exercises the API's Admin
  SDK path and the client's read path together).
- Open the roll, open one student's history, and confirm today's attendance rows
  are present and not empty.
- Make one stamped write — a student edit, a bus assignment — and confirm it
  appears in `/dashboard/activity`. That proves `updatedBy` / `updatedAt` stamping
  and the audit writer both survived the restore.
- Confirm the single-field collection-group index on `driverCodes.codeHash` exists
  on the new database. Index configurations travel in the backup, so it is probably
  there — but it was created by hand in the console rather than from
  `firestore.indexes.json`, and a driver with no index cannot have their code
  looked up, so confirm it rather than assume it.

**7. Retire the old database.** Only after the new one has run through a full
school day without a rollback:

```bash
gcloud firestore databases delete --database='(default)'
```

- Deletion is refused while delete protection is enabled, and deleting `(default)`
  is allowed only once no App Engine search data or blob entities remain in it
  ([multiple databases](https://firebase.google.com/docs/firestore/manage-databases)).
- A deleted database ID cannot be reused for about 5 minutes. That only matters if
  you plan to restore *back* under the same name — which is the emergency path if
  step 6 fails, so pick the scratch name of the new database with that in mind.
- Keep the backups. They are not deleted with the database, and they are the only
  copy of anything the restore window missed.

## PITR as a separate feature

PITR is not "better backups"; it answers a different question.

- Window: **7 days**, one version **per minute**, at whole-minute timestamps
  ([PITR](https://cloud.google.com/firestore/docs/pitr)).
- **Off by default**, and the window starts when you enable it: right after
  enabling you can only read from one hour before enablement, and only after 7
  days do you get the full window.
- Independently of PITR, you can read (but not export) documents at
  microsecond-granularity timestamps within the **past hour**, not earlier than
  `earliestVersionTime` — so the first hour after a bad write is readable even with
  PITR off.
- Disabling PITR makes the retained history unreadable, and re-enabling does not
  bring it back: data created before the disablement is deleted at its original
  expiration date.

Enabling it on an existing database:

```bash
# Confirmed in gcloud 587.0.0; the docs page only demonstrates the disable form.
gcloud firestore databases update --database='(default)' --enable-pitr
```

The PITR docs show `--enable-pitr` **only** for `gcloud firestore databases
create`, and show `--no-enable-pitr` for `update`
([use PITR](https://cloud.google.com/firestore/docs/use-pitr)). The positive flag
exists on `databases update` — `gcloud firestore databases update --help` lists it
— but it is not documented on that page, so it is the one flag in this runbook
with a weaker source than the rest. Enabling from the console's Disaster Recovery
page is documented either way.

Two recovery paths, and they are not the same operation:

- **Part of the database** — read at a stale timestamp and write the results back
  into the live database. This is the surgical path: one deleted document, one
  batch of wrong fields.
- **The whole database** — `gcloud firestore databases clone` at a timestamp, which
  is the PITR answer to "restore to a new database", or an export/import pair.
  A clone produces a new database exactly like a backup restore, so the repoint /
  TTL / rules / IAM work above applies unchanged.

**When to prefer PITR over backups:**

- The damage is hours old and you know the minute — a bad bulk delete, a bad
  import, a script that wrote the wrong field across a collection. A daily backup
  can only take you back to yesterday, which loses a day of attendance.
- You need one object back, not the database. Stale reads need no restore at all.
- You are about to run something risky (a migration, a rules change with a
  bulk-write path, a seed script against real data). PITR is cheap insurance for
  exactly the duration of the risk; a backup is not, because its time of day is
  not yours to choose.

Keep the daily backup anyway: PITR's 7 days is shorter than a quarterly mistake,
and it does not protect you if someone disables it.

## Costs

None of these features has a free tier. The free-quota column of the pricing table
reads **"Not supported"** for PITR data, backup data, restore operations and TTL
deletes; the 1 GiB / 50,000 reads / 20,000 writes allotment does not extend to any
of them ([Firestore pricing](https://cloud.google.com/firestore/pricing)). The
unit prices below are the `us-central1` **Default** column as the page lists them,
per GiB per hour; the per-month figures are arithmetic (× 730 h), not a separate
quote.

| Item | Listed price | ≈ per GiB-month |
| --- | --- | --- |
| Backup storage | $0.000041096 per GiB | $0.03 |
| Restore operation | $0.20 per GiB of backup, once per restore | — |
| PITR storage | $0.000205479 per GiB | $0.15 |
| Live storage (for scale) | $0.000205479 per GiB | $0.15 |

- **Backup storage is the database size, times how long you keep it.** "The cost of
  each backup is calculated using the storage size of the backup multiplied by the
  proportion of the month the backup is retained"
  ([Firestore pricing](https://cloud.google.com/firestore/pricing)). So the
  retention period is the cost dial, and it multiplies:

| Configuration | Backups retained per GiB of database | ≈ $/month per GiB of database |
| --- | --- | --- |
| daily, `--retention=7d` | 7 | $0.21 |
| daily, `--retention=14d` | 14 | $0.42 |
| daily, `--retention=14w` | 98 | $2.94 |
| weekly, `--retention=14w` | 14 | $0.42 |
| daily 7d + weekly 14w | 21 | $0.63 |

- **A 14-week daily schedule on a 1 GiB database is about $3/month by itself** —
  more than the entire $2 budget alert on this project. Read the database's current
  size off the Firestore usage page in the console before choosing retention, and
  start at `7d` or `14d` for the daily schedule. The weekly schedule at 14 weeks is
  the cheap way to keep a long horizon.
- **A restore is charged per restore, on the backup's size** — $0.20/GiB. Small at
  this scale, and the reason people rehearse restores rather than doing them
  speculatively.
- **PITR is charged on the database size, continuously**, at the same unit rate as
  live storage: "if the average size of your database during a month is 1 GiB and
  PITR is enabled for the whole month, then the billable PITR data size is 1 GiB as
  well". Enabling it on a small database is cents; leaving it on for a burst of
  traffic that grew the data is not. Disabling within a day still bills up to one
  day of PITR storage.
- These costs land on the same billing account as Cloud Run, so they count against
  the same $2 budget alert at 50/90/100/150%. A backup schedule is exactly the kind
  of quiet monthly line that a 100% alert is meant to catch. Budget alerts do not
  stop spending; on Blaze there is no automatic cap.

## Verify it works

Run this once, after the first schedule is created, and again after any change to
retention:

1. **Both schedules exist, with the retention you intended.**

```bash
gcloud firestore backups schedules list --database='(default)'
gcloud firestore backups schedules describe \
  --database='(default)' --backup-schedule='SCHEDULE_ID'
```

2. **A backup appears after the first window.** With an uncontrolled time of day,
   the honest check is the next calendar day:

```bash
gcloud firestore backups list \
  --location=us-central1 \
  --format="table(name, database, state)"
```

The `state` column is the one to read — a backup that has not finished is not a
backup. If nothing appears after 48 hours, the schedule exists and the thing behind
it does not: read the schedule's `describe` output before assuming the schedule is
the problem.

3. **Rehearse the restore into a scratch database.** At least once, well before an
   incident, and on a day you would notice a mistake. Restore the newest backup
   into a throwaway ID, then:

- count documents in a known collection, and compare it with the live count;
- confirm `schools/{schoolId}/audit` is present and readable;
- re-apply both TTL policies (step 3 above) on the scratch database and confirm
  each reports its field;
- delete the scratch database the same day.

```bash
gcloud firestore databases restore \
  --source-backup=projects/school-bus-a4f23/locations/us-central1/backups/BACKUP_ID \
  --destination-database='school-bus-restore-rehearsal'
```

Once the checks pass — and only then, or you have rehearsed nothing:

```bash
gcloud firestore databases delete --database='school-bus-restore-rehearsal'
```

4. **Confirm nothing else breaks when the app is repointed.** The rehearsal's real
   product is not the restored data, it is knowing whether the two edits in step 2
   of the procedure are enough. If you have never run the app against a named
   database, the first rehearsal is where you find out that the client's named
   overload is what carries the ID.

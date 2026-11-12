# Production readiness — the nine asks, and what was decided

**2026-11-12.** A "backend-only readiness" brief was written for this project
without its context. This page records the verdict on each of its nine asks and
the evidence that settled it, so the next reader does not re-derive any of it.
Where a claim came from documentation, the URL is given; where it came from the
code, the file is.

The brief assumed a server-rendered app whose backend serves the data. It is not:
the browser reads and writes Firestore directly (realtime + an offline write
queue), and the API handles only privileged account work. Two consequences run
through the whole list — half the asks belong to the **web** repo (rules,
indexes, contract mirror), and the API never sees the traffic the brief wanted
to rate-limit.

## The nine

| # | Ask | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Cloud Run `--min-instances=1 --max-instances=1` | **Partial.** `min=1` costs roughly $8.5/month at 1 vCPU/512 MiB on request-based billing and is a best-effort warm target, not a cold-start guarantee. `max=1` does **not** mean one process: limits are per revision, so a rolling deploy runs two, and at the cap requests wait up to 30 s then fail with `429`. Google's documented starting value is 3. | [min-instances](https://docs.cloud.google.com/run/docs/configuring/min-instances), [max-instances-limits](https://docs.cloud.google.com/run/docs/configuring/max-instances-limits), [pricing](https://cloud.google.com/run/pricing); `docs/ops/cloud-run-deploy.md` |
| 2 | Abstract the rate limiter so it can move to a distributed store | **Deferred.** The store is a module-level map behind `rateLimited(ip, limit, windowMs)`. An interface with one implementation is a seam with nothing on the other side; the durable half was the more valuable fix and now exists (`codeAttempts`). | `School-bus-API/src/middleware/security.ts` |
| 3 | `TRUSTED_PROXY_HOPS` fail-closed | **Done.** Short chains, over-long chains and non-IP entries fold to `untrusted`; the hop count is validated at boot and **measured** from `xff_observed` in production, because Firebase Hosting documents nothing about what it forwards. | `security.ts`, `docs/ops/cloud-run-deploy.md` |
| 4 | "Firebase Multi-Tenancy" plus rules enforcement | **Rejected, and already done.** Firestore has no multi-tenancy feature. Firebase's is GCIP/Identity Platform tenants: auth silos only, billing required, and it would change zero Firestore rules. Isolation is `schools/{schoolId}` + `users/{uid}.schoolId`, which the rules enforce. | [firebase.google.com/docs/auth](https://firebase.google.com/docs/auth), [identity-platform/docs/multi-tenancy](https://cloud.google.com/identity-platform/docs/multi-tenancy) |
| 5 | Composite indexes to prevent bottlenecks at 2,000 concurrent operations | **Rejected.** Manual (composite) indexes decide whether a query can run and how fast it is served; they do not raise concurrency, and each one adds write cost. The one composite query the app makes already has its index. The documented throughput hazard is a sequentially indexed field (500 writes/s per collection split), not query count. | [index-overview](https://firebase.google.com/docs/firestore/query-data/index-overview), [best-practices](https://firebase.google.com/docs/firestore/best-practices) |
| 6 | Scheduled Firestore backups | **Accepted.** Blaze-gated, and the project is on Spark — so this is blocked on the upgrade, not on code. A restore writes to a **new** database with a new ID and does not carry TTL policies. | [firestore/backups](https://firebase.google.com/docs/firestore/backups); `docs/ops/firestore-backups.md` |
| 7 | Stable IDs for classes and import keys | **Rejected for now.** Classes are strings by design: the import folds spellings (`Class 4A` → `Grade 4A`), dedupes creations by (name, class), and the preview is the guard. A `classes` collection is a migration plus an import rewrite plus a UI change. | `src/lib/sheet-import.ts`, `AGENTS.md` |
| 8 | Soft-delete / archive status for students | **Deferred, for a better reason than the brief gave.** Deleting a document never deletes its subcollections, so a hard delete leaves readable orphans — that argues for archiving. But an `archived` flag changes what the roll queries, which is UI behaviour, and there is no student API by design. | [delete-data](https://firebase.google.com/docs/firestore/manage-data/delete-data) |
| 9 | Shared contract types | **Partial.** Paths, shapes and error codes already match byte-for-byte. What the mirror cannot express is the validation bounds (name ≤ 80, password 12–128, code `/^\d{6}$/`) and status codes, which are not a function of the error code. The mirror stays hand-kept until the surface outgrows it. | `School-bus-API/src/contract.ts`, `src/lib/api-contract.ts` |

## What was actually changed

- `clientIp` fails closed; the hop count is validated at boot and logged.
- Wrong driver codes are counted durably (`codeAttempts`, 20 per 15 minutes per
  hashed IP, fail-open, TTL), so guessing survives a restart and a second
  instance.
- The rules bound what a created student carries and what a driver may rewrite on
  an existing run or attendance record.
- The claims in `APP_OVERVIEW.md` §8 and the API README were corrected to match.

## Known residual risks (deliberate, not oversights)

- **A 6-digit code is 10^6 possibilities with several hundred live.** Both guards
  bound one address, not the service. A longer code, or account-bound sign-in,
  is the structural fix.
- **The API is reachable at its `*.run.app` URL, and the two ingress paths cost
  different numbers of proxy hops.** Every documented lever that closes the public
  URL also breaks the Hosting rewrite, so the compensating control is in the
  application; and because a direct request produces a shorter
  `x-forwarded-for` chain than the rewrite, no single `TRUSTED_PROXY_HOPS` is
  correct for both. A caller who pads the header to exactly `hops` entries can
  choose the throttle bucket — and `codeAttempts` keys on that same resolved
  address, so the durable counter is dodged with it. The fix is one ingress path
  (serve `/v1/**` from the `run.app` origin and set the hop count for that sole
  path), with a longer code as the structural backstop for a public 6-digit
  credential.
- **`max-instances=1` is an availability trade.** It converts a burst into
  documented 429s rather than scaling; revisit if the fleet grows.
- **No CI.** Neither repo has a workflow, so a rules or auth change ships on human
  review alone. The emulator matrix used to verify the last rules change would be
  the natural first job.

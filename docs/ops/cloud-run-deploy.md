# Deploying the API to Cloud Run

**Written for the state after the Blaze upgrade.** `school-bus-a4f23` is on Spark
today, so the deploy below is refused. The commands and the numbers in this
runbook are correct for the project the moment billing is attached; nothing here
works before that.

## The Blaze prerequisite, and what fails on Spark

`gcloud run deploy --source .` needs a billing-enabled project twice over: Cloud
Run itself refuses to create a service, and a source deploy first builds an image
in Artifact Registry, which refuses for the same reason.

On Spark the failure is the billing check, not the code or the IAM:

- `gcloud run deploy` returns **`BILLING_DISABLED`**.
- The build step reports **`PERMISSION_DENIED`** on Artifact Registry — a source
  deploy builds there before Cloud Run is asked to run anything.
- The hosted app's **`/v1/**` returns 503**, because `firebase.json` rewrites those
  paths to a Cloud Run service that has no revision behind it. Sign-in on the
  deployed site cannot work in that state, and that is the honest answer rather
  than a misleading CORS or network error.

Until billing is on, the API runs locally (`npm run dev` in `School-bus-API`,
reached through `VITE_API_URL`) and the rewrites stay in place unused.

Check the state before reading further:

```bash
gcloud billing projects describe school-bus-a4f23
```

## The deploy command

Copied from `School-bus-API/README.md`, which is the source of truth for this
command. Run it from the `School-bus-API` checkout — `--source .` uploads that
directory.

```bash
gcloud run deploy school-bus-api \
  --source . --project school-bus-a4f23 --region us-central1 \
  --allow-unauthenticated \
  --service-account school-bus-api@school-bus-a4f23.iam.gserviceaccount.com \
  --min-instances=0 --max-instances=1 \
  --memory=512Mi --cpu=1 --cpu-throttling --concurrency=80 --timeout=30 \
  --set-env-vars "^|^NODE_ENV=production|FIREBASE_PROJECT_ID=school-bus-a4f23|APP_ORIGINS=<comma-separated origins>|FIREBASE_API_KEY=<public web key>|TRUSTED_PROXY_HOPS=2" \
  --set-secrets CODE_PEPPER=code-pepper:latest
```

Both `<…>` placeholders must be replaced before this runs — pasted as-is, the
shell reads them as redirections. `APP_ORIGINS` is the comma-separated list of
deployed Hosting origins; `FIREBASE_API_KEY` is the public web key from the same
`.env.local` the client uses.

Each flag, one line:

| Flag | What it decides |
| --- | --- |
| `--source .` | Build from the current directory with Cloud Build, push the image to Artifact Registry, deploy that image. Needs Blaze for the build. |
| `--project school-bus-a4f23` | The project that owns the service, the image and the billing. |
| `--region us-central1` | Placement. `us-central1` is one of the regions Firebase Hosting rewrites support ([Hosting and Cloud Run](https://firebase.google.com/docs/hosting/cloud-run)). |
| `--allow-unauthenticated` | Invocable without an IAM identity. The Hosting rewrite needs this — Firebase's own walkthrough answers "Y" to the same question ([Hosting and Cloud Run](https://firebase.google.com/docs/hosting/cloud-run)). It is also what leaves the public `*.run.app` URL open; see [The open bypass](#the-open-bypass). |
| `--service-account school-bus-api@…` | The runtime identity ADC falls back to. It needs `roles/datastore.user`, `roles/firebaseauth.admin`, and `roles/iam.serviceAccountTokenCreator` **on itself** to mint custom tokens without a key file. |
| `--min-instances=0` | Scale to zero. Nothing is billed while idle — see [Min and max instances](#min-and-max-instances). |
| `--max-instances=1` | A per-revision ceiling of one instance. Deliberate: it keeps the in-memory rate limiter a single counter. It is not a guarantee of one process; see below. |
| `--memory=512Mi --cpu=1` | One vCPU, half a GiB. Enough for a Hono process whose work is Firestore round-trips. |
| `--cpu-throttling` | request-based billing: CPU is allocated only while a request is being served, which is also why idle time at `min-instances=0` is free ([CPU allocation](https://cloud.google.com/run/docs/configuring/cpu-allocation)). |
| `--concurrency=80` | Up to 80 concurrent requests per instance before a second one would be wanted. With `--max-instances=1`, the 81st concurrent request is where queueing starts. |
| `--timeout=30` | Per-request timeout in seconds. The auth routes add a deliberate 400 ms delay on every answer; a timeout below that would be a bug. |
| `--set-env-vars "^|^…"` | Non-secret configuration. The `^|^` prefix is a custom delimiter: `--set-env-vars` splits on commas and `APP_ORIGINS` contains commas. `APP_ORIGINS` must list the deployed Hosting origins — same-origin calls still send an `Origin` on POST, and the API's origin guard rejects a mismatch. |
| `--set-secrets CODE_PEPPER=code-pepper:latest` | The one real secret, injected from Secret Manager. `CODE_PEPPER` must be the value the existing driver codes were hashed with, or no code verifies. |

Verify what actually landed, rather than what you asked for:

```bash
gcloud run services describe school-bus-api \
  --project school-bus-a4f23 --region us-central1 \
  --format 'value(status.url)'
```

## Min and max instances

These two flags are not symmetric — one is a warm target, the other is a ceiling —
and neither means what a single-process mental model expects.

### `--min-instances=0` versus `=1`

- **`=0`** scales to zero. "If min instances is set to 0, you are not billed when
  instances are idle" ([min instances](https://cloud.google.com/run/docs/configuring/min-instances)).
  The price is a cold start on the first request after a quiet period. For this
  app that is one sign-in after the morning, and the driver's roster never touches
  the API — it reads Firestore directly — so the cold start lands on the least
  latency-sensitive path the API has.
- **`=1`** keeps one instance warm and **is billed for it**. At `us-central1`
  request-based rates, one warm 1 vCPU / 512 MiB instance costs about
  **$9.9/month** gross: idle CPU at $0.0000025 per vCPU-second plus memory at
  $0.0000025 per GiB-second, over 730 hours. The monthly free allotment (180,000
  vCPU-seconds, 360,000 GiB-seconds, shared with the active time the service does
  use) brings a fully idle month to about **$8.5** ([Cloud Run pricing](https://cloud.google.com/run/pricing)).
- **`=1` is a best-effort target, not a cold-start guarantee.** "Minimum instances
  are a best-effort target to keep instances warm and ready. You might experience
  temporary drops below your configured minimum instances" — zone capacity,
  infrastructure rebalancing, a crashing container, and quota or billing limits are
  all named, and "minimum instances can be restarted at any time"
  ([min instances](https://cloud.google.com/run/docs/configuring/min-instances)).
  Google's high-availability guidance is at least 3, which is not affordable here.

Keep `0`. The $8.5 buys a warm start for sign-in and the privileged writes; it is
not a cold-start guarantee even when you pay it, and it is $8.5 against a $2 budget
alert.

### `--max-instances=1` is not "one process"

Three separate reasons:

- **Limits are per revision.** "Because maximum instance limits are set for each
  revision independently, you might temporarily exceed the specified limit during
  the period after deployment" ([max instances](https://cloud.google.com/run/docs/configuring/max-instances-limits)).
  A rolling deploy runs the old and new revisions side by side, so for that window
  the service can have two instances — two processes, so two in-memory
  rate-limit counters.
- **The in-memory counters reset.** They are per instance and reset whenever the
  instance restarts or a deploy replaces the revision. The durable half is in
  Firestore and shared: `codeAttempts` counts wrong codes per client-IP bucket (20
  in a 15-minute window locks that bucket for 15 minutes, TTL-expired, deliberately
  fail-open), and a matched code keeps its own `attempts` / `lockedUntil` pair for
  the owner-role gate. So landing on a second instance or a fresh revision buys a
  small multiple of the limit, never an unlimited one.
- **At the cap, requests wait, then fail.** When no instance has spare capacity,
  Cloud Run "attempts to serve a new inbound request for up to 30 seconds" and then
  the request fails with:

  ```
  HTTP 429
  The request was aborted because there was no available instance.
  ```

  ([troubleshooting](https://cloud.google.com/run/docs/troubleshooting),
  [max instances](https://cloud.google.com/run/docs/configuring/max-instances-limits)).
  With `--concurrency=80` that queue appears only above 80 in-flight requests, or
  while a revision is starting and cannot take traffic — not on ordinary load.
  A burst that queues is a 30-second stall for the caller, which for a sign-in
  flow reads as "the app is hanging".

**Google's documented starting value is 3** — "A good rule of thumb is to start
with a maximum instances value of 3, then monitor for invocation failures and
adjust" ([max instances](https://cloud.google.com/run/docs/configuring/max-instances-limits)).
That guidance is written for event-driven services, and this service deliberately
takes 1 instead, to keep the rate limiter a single counter. If the morning burst
starts producing 429s, raising `--max-instances` is the fix and it costs the
rate-limiter property, not much money: idle instances above the minimum are not
billed.

## Measuring `TRUSTED_PROXY_HOPS` (do this after the first deploy)

The rate limiter keys on the client IP, and `clientIp()` reads the
`x-forwarded-for` chain `TRUSTED_PROXY_HOPS` entries **from the end** — the entries
our own proxies append, which a caller cannot forge. The number therefore has to
match this deployment. Two things make it a measurement rather than a lookup:

- **Firebase Hosting's forwarding is undocumented.** The API's own middleware says
  as much — "Firebase Hosting does not document what it forwards, so the real hop
  count cannot be derived from docs" — so the chain has to be measured rather than
  looked up.
- **Getting it wrong is silent.** The failure mode is coarse throttling (everyone
  in one bucket), not a bypass or an error.

The API emits one `xff_observed` JSON line per request on the two rate-limited
routes (`POST /v1/auth/director-sign-in`, `POST /v1/auth/verify-code`) with `chainLen`,
`hops`, `resolved` and a sanitized `raw` echo. Procedure:

1. **Generate a few requests through Hosting.** Success or failure both log — the
   throttle runs before the handler, so even a request the handler rejects gives
   you the line. A missing `Origin` is allowed by the origin guard, so `curl`
   works:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST \
     https://<hosting-origin>/v1/auth/director-sign-in \
     -H 'content-type: application/json' -d '{}'
   ```

   `<hosting-origin>` is the site's own origin — the one `APP_ORIGINS` lists and
   the one the browser uses — not the `run.app` URL, or you measure the wrong
   chain. The default Hosting domain is `<project-id>.web.app` when no custom site
   was created; `npx firebase-tools@latest hosting:sites:list` (or the console's
   Hosting page) gives the authoritative answer. Repeat a handful of times from
   different networks if you can, including a mobile connection. `/health` will not
   produce a line; it is not rate-limited.

2. **Read the lines.**

   ```bash
   gcloud logging read \
     'resource.type="cloud_run_revision" AND resource.labels.service_name="school-bus-api" AND textPayload:"xff_observed"' \
     --project school-bus-a4f23 --limit 200 \
     --format 'value(textPayload)'
   ```

   The API writes the line with `console.info`, so it arrives as plain stdout text.
   In Logs Explorer the same query works; if it returns nothing, drop the
   `textPayload:` clause and search the message instead — the field name depends on
   how the runtime ingests stdout.

3. **Look at the distribution of `chainLen`**, not at a single line:

   ```bash
   gcloud logging read \
     'resource.type="cloud_run_revision" AND resource.labels.service_name="school-bus-api" AND textPayload:"xff_observed"' \
     --project school-bus-a4f23 --limit 500 \
     --format 'value(textPayload)' \
     | grep -o '"chainLen":[0-9]*' | sort | uniq -c | sort -rn
   ```

   The modal value is the chain this deployment produces. Ordinary traffic should
   agree on it; a spread means something in front of the service varies (a
   different Hosting edge, a proxy you did not know about).

4. **Set `TRUSTED_PROXY_HOPS` to that value** and redeploy. The semantics are worth
   stating because the name is misleading: the resolver indexes
   `hops[hops.length - TRUSTED_PROXY_HOPS]`, and a chain longer than
   `TRUSTED_PROXY_HOPS + 1` folds to the single `untrusted` bucket. So the number
   is the **total chain length** the deployment produces when the caller adds
   nothing, and the `+ 1` is the single entry a caller is allowed to prepend.

5. **Confirm `resolved` is a real client address and never `untrusted`** on
   ordinary traffic — `resolved === "untrusted"` is the immediate signal that the
   value does not match the deployment:

   ```bash
   gcloud logging read \
     'resource.type="cloud_run_revision" AND resource.labels.service_name="school-bus-api" AND textPayload:"xff_observed"' \
     --project school-bus-a4f23 --limit 200 \
     --format 'value(textPayload)' \
     | grep -o '"resolved":"[^"]*"' | sort | uniq -c | sort -rn
   ```

6. **Confirm a padded header cannot move the bucket.** Send the same request with
   one and then two forged entries in front:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST \
     https://<hosting-origin>/v1/auth/director-sign-in \
     -H 'content-type: application/json' -H 'x-forwarded-for: 1.2.3.4' -d '{}'
   ```

   One forged entry must still resolve to the same address as step 5; two must fold
   to `untrusted`. If one forged entry changes the resolved address, the hop count
   is too high.

The recorded deploy command above carries `TRUSTED_PROXY_HOPS=2` — the value stated
in the API README for Hosting → Cloud Run. Treat it as the hypothesis this
procedure confirms or corrects, not as the answer.

## The open bypass

With default ingress (`--ingress=all`) and `--allow-unauthenticated`, the service is
invocable **directly at its `*.run.app` URL by anyone on the internet**, whatever
Hosting does. Hosting is a path to the service, not a gate on it.

```bash
# 200 from anywhere, no Hosting involved.
curl -s -o /dev/null -w '%{http_code}\n' \
  https://school-bus-api-<hash>-uc.a.run.app/health
```

Every documented control that would close it also breaks the Hosting rewrite:

| Lever | Why it breaks the rewrite |
| --- | --- |
| `--ingress=internal` | The documented allowed sources are internal Application Load Balancers, VPC networks in the project, VPC Service Controls perimeters, and a named list of Google products (Cloud Scheduler, Cloud Tasks, Dialogflow CX, Eventarc, Pub/Sub, Workflows, BigQuery, synthetic monitors). **Firebase Hosting is not on that list**, so the rewrite has no documented path in ([ingress](https://cloud.google.com/run/docs/securing/ingress)). |
| `--ingress=internal-and-cloud-load-balancing` | Adds external Application Load Balancer traffic and nothing else: "Direct requests to the run.app URL from the internet are not allowed." A Hosting rewrite is not a load balancer request, so it is not admitted ([ingress](https://cloud.google.com/run/docs/securing/ingress)). |
| `--no-default-url` | The docs name the affected products explicitly: disabling the default `run.app` URL "prevents these services from working as expected", and **Firebase Hosting** is one of them ([default URL](https://cloud.google.com/run/docs/configuring/instances/default-url)). |
| `--no-allow-unauthenticated` | Hosting presents no IAM identity for the rewrite, which is why Firebase's setup answers "Y" to allowing unauthenticated invocations ([Hosting and Cloud Run](https://firebase.google.com/docs/hosting/cloud-run)). |

So **the compensating control is application-level, and there is no network-level
one available while the app is same-origin through Hosting.** What that means in
practice is that the API's own guards are the only guards on the public path:

- Every privileged route authenticates: director sign-in verifies a Firebase
  password *and* a `director` profile, then mints a token; driver routes verify a
  Firebase Bearer token and a code checked as an HMAC against `codeHash`.
- Driver-code attempts are counted in a Firestore transaction with a 10-attempt
  lockout for 15 minutes, so the code path cannot be hammered.
- The origin guard rejects a request whose `Origin` is present and not allowlisted.
  A missing `Origin` is allowed on purpose (curl, same-origin form) — so this is
  CSRF protection, not authentication.
- The per-IP throttle (10 requests / 60 s on each auth route) applies at the
  `run.app` URL exactly as it does through Hosting.
- Errors are generic (`server_error`) with the detail in logs; every privileged
  write appends to `schools/{schoolId}/audit`, with codes and tokens never in the
  trail.

What the bypass does skip: Hosting's security headers and the path-based routing.
Neither is an access control, and neither should be treated as one. The practical
consequences to keep in mind are a second, unmonitored front door for the same
endpoints, and that its presence is a standing reason to keep the auth routes'
guards tested rather than assume the deployment is not reachable.

## Cost guardrails

Four controls, and they are what keeps this at $0 once it is running:

- **The $2/month budget alert at 50/90/100/150%** on the billing account. It
  notifies; it does not cap. Blaze has no automatic spending cap, so the ceiling is
  whatever the rest of this list enforces. Confirm it still exists after any
  billing change:

  ```bash
  gcloud billing budgets list --billing-account=BILLING_ACCOUNT_ID
  ```

- **`--min-instances=0` plus `--cpu-throttling`.** Scale to zero means no idle
  instance to pay for; request-based billing means the CPU is allocated only while
  a request is served ([CPU allocation](https://cloud.google.com/run/docs/configuring/cpu-allocation)).
  Together they make an idle service cost nothing.

- **`--max-instances=1`** as a hard blast-radius ceiling: if something loops, the
  damage is bounded to one instance's requests. It is also the property that keeps
  the rate limiter a single counter, which is why the number is 1 and not 3.

- **The Artifact Registry cleanup policy** in
  `School-bus-API/infra/artifact-registry-cleanup.json`. Each image is about
  158 MB and the Artifact Registry free tier is 0.5 GB, so without the policy every
  deploy permanently eats into the free allowance — three deploys and the project
  is paying for storage it does not use. The policy keeps the 2 most recent
  versions and deletes the rest:

  ```bash
  gcloud artifacts repositories set-cleanup-policies REPOSITORY \
    --project school-bus-a4f23 --location us-central1 \
    --policy infra/artifact-registry-cleanup.json --no-dry-run
  ```

  It must be applied with `--no-dry-run` to take effect (the policy is live, not a
  dry run), and it runs as a background job, so changes "should take effect within
  approximately one day" ([cleanup policy](https://cloud.google.com/artifact-registry/docs/repositories/cleanup-policy)).
  `REPOSITORY` is the repository the deploy created; `gcloud run deploy --source .`
  conventionally builds into `cloud-run-source-deploy` in the region, but confirm
  it with `gcloud artifacts repositories list --location us-central1` rather than
  trusting the convention.

Backups and PITR are billed to the same account and count against the same $2
alert — see `docs/ops/firestore-backups.md`. A daily backup schedule with 14 weeks
of retention is the single most likely way to spend past a $2 budget on this
project, and it is one flag away.

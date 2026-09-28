# SECURITY_ROADMAP — School Bus Transit

Follow-up hardening queue (researched 2026-09 via live web research across five
domains; sources were fetched during research — re-verify URLs before acting).
Companion to `SECURITY.md` (current model) — this file is the **future work**
list, not the current state. Grouped in tiers; nothing here is implemented yet
unless marked done.

## Already done (audit + hardening round 1, branch `security-hardening`)

Security headers (XFO DENY / nosniff / Referrer-Policy / Permissions-Policy /
no `X-Powered-By`), tenant-isolated Firestore rules with no client profile
creation, staff writes scoped to their own bus with field validation,
director-read-only `audit` subcollection, driver codes stored as HMAC-SHA256
`codeHash` (CODE_PEPPER) with transactional per-code lockout, uniform 400 ms
delay + bounded in-memory per-IP rate limit + Origin checks on auth routes,
structured failure logs, fail-closed seed (`--demo`), Secure+SameSite locale
cookie, CSV formula-injection guard. Verified: lint/build/tsc green, live
header check, `npm audit` clean except one tracked moderate (uuid chain).

## Tier 1 — Code wins (in-repo, committable without console access)

1. `Cache-Control: no-store` on the School-bus-API's responses + the CSV download
   (OWASP A04/A09 — PII must not reach shared/CDN caches). The web app no longer
   has server routes of its own, so this half is an **API-repo** change.
2. Global generic error surfaces: a React Router error boundary plus a `not-found`
   route (the Next.js `error.tsx` / `global-error.tsx` / `not-found.tsx` files went
   away with the App Router); map Firebase SDK error codes to generic i18n
   messages; never surface raw error strings (OWASP Top 10 2025 A10 "Mishandling of
   Exceptional Conditions", ASVS 5.0 V16.5). The API half is already done — see
   `onError` in `School-bus-API/src/app.ts`.
3. Self-host the Material Symbols icon font via
   `@fontsource/material-symbols-rounded` (5.3.8, + outlined variant; both verified
   on npm, OFL-1.1, SLSA provenance) and remove the Google Fonts `<link>` +
   preconnects in `index.html` — removes the app's only remaining external runtime
   asset load (privacy + no-SRI hole). Text fonts (Inter, JetBrains Mono, IBM Plex
   Sans Arabic) are already self-hosted via `@fontsource`.
4. CSV hardening: also neutralize full-width formula triggers (`＝＋－＠`),
   tab/CR/LF-leading cells, and mid-field separator tricks (OWASP CSV
   Injection; note: no sanitizer is safe for every spreadsheet consumer).
5. Formalize the structured log line shape (`{level,event,message,requestId,ts}`)
   for correlation (auth routes already emit `{event,reason,ip}` JSON).
6. Add `Cross-Origin-Opener-Policy: same-origin` to the `hosting.headers` block in
   `firebase.json` (skip COEP: no SharedArrayBuffer use and it breaks cross-origin
   assets; revisit via report-only only if ever needed).
   `X-Permitted-Cross-Domain-Policies: none` is scanner-score-only, optional.

## Tier 2 — Console / edge settings (no code; needs your Firebase/Vercel/GCP access)

1. **Firebase App Check** (web): create a reCAPTCHA Enterprise score-based key
   (never add localhost to a prod key), register the app under Security → App
   Check, initialize `initializeAppCheck` with `ReCaptchaEnterpriseProvider`
   early in startup, use the web debug provider in dev, then **Enforce on
   Cloud Firestore before launch** (enforcement is console-level, not a rules
   expression). Optional (Preview): enforce on Firebase Authentication — covers
   `SignInWithCustomToken`, i.e. the driver code flow. Server routes: verify
   `X-Firebase-AppCheck` with `getAppCheck().verifyToken()` in firebase-admin.
   Cost ≈ $0 at this scale (10k free assessments/org/month).
2. **Auth console settings**: confirm Email enumeration protection ON; set
   password policy (Require mode, strong, force upgrade); directors must be
   created only via Admin SDK (never public sign-up; optional
   `beforeUserCreated` blocking function for invite-only sign-up — Blaze);
   per-IP sign-up rate limiting is built into Firebase.
3. **TOTP MFA for directors** (GA since 2023): enable TOTP via Admin SDK
   `projectConfigManager().updateProjectConfig(...)`, enrollment UI using
   `TotpMultiFactorGenerator`, handle `auth/multi-factor-auth-required` at
   sign-in, require verified emails. Driver custom-token accounts CANNOT
   enroll — keep their sessions short. (Native Firebase web passkeys:
   unverified/contradictory — re-check console "Sign-in method → Passkey"
   before building.)
4. **HSTS**: add a `Strict-Transport-Security` header to the `hosting.headers`
   block in `firebase.json`. Firebase Hosting serves HTTPS and redirects HTTP but
   does not send HSTS itself — this is now a code change in this repo rather than a
   console setting.
5. **Data safety**: enable Firestore PITR (7-day window) + a scheduled daily
   backup (~30-day retention); Cloud Billing budget alert (~50/90%);
   least-privilege IAM for the server service account (never owner;
   prefer Workload Identity Federation over a JSON key; rotate any JSON key
   ≥ every 90 days); confirm web API-key restrictions.
6. **An edge/WAF rate limit in front of the API** for
   `/v1/auth/(verify-code|director-sign-in)` (10 req/60 s per IP, deny) — a global
   layer ahead of the API's in-memory limiter, which is per-instance and resets on
   restart. Separately, that limiter itself needs a shared store (Redis or a
   Firestore counter) before the API runs more than one instance.
7. **Driver-code lifecycle**: add `issuedAt`/`expiresAt` to `driverCodes`
   docs; `verify-code` rejects expired codes; rotate on policy (30–90 days);
   alert on hash-miss storms (wrong-code sweeps are otherwise invisible —
   today only role-gate failures count); audit to `schools/{id}/audit`.

## Tier 3 — CI/CD (repo has no `.github` yet; all items $0)

1. **Dependabot**: alerts + security + version updates are free on private
   repos. `.github/dependabot.yml` (npm, weekly, grouped). Dismiss the uuid
   GHSA-w5hq-g745-h8pq alert with reason `tolerable_risk` + tracking comment
   (do NOT use `ignore` — it doesn't silence alerts). Re-check quarterly.
2. **First CI workflows** (PR) — one per repo, since they are independent:
   `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` →
   `npm audit --audit-level=high`. The web repo's build also produces the Hosting
   bundle; the API repo's produces `dist/index.js`.
3. **Firestore rules tests in CI**: `@firebase/rules-unit-testing` +
   `firebase emulators:exec --only firestore --project demo-schoolbus` (no
   login needed for Firestore-only; needs JDK 21 + Node ≥ 20 in CI; pin
   `firebase-tools@15`); always `loadFirestoreRules` (emulator defaults to
   open rules); optionally curl the `:ruleCoverage` endpoint inside the exec'd
   script. The rules ARE the security boundary — they currently ship
   unguarded.
4. **gitleaks** pre-commit hook (`pre-commit-config.yaml`, pin latest v8 tag)
   + `gitleaks-action` in CI (GitHub-native secret scanning is paid on private
   repos; free tier is public-only).
5. **Sentry free tier**: `npx @sentry/wizard@latest -i react` for the web app and
   `-i node` (or manual `@sentry/node`) for the API — two projects, two DSNs. Tag
   Firebase auth error codes, and alert on auth-failure spikes (e.g. a single
   auth-error code exceeding `max(5, 3×7-day daily avg)` in a 10-min window —
   guidance, verify condition syntax in the Sentry UI). Free tier: 5k
   errors/month.
6. **Rules deploy from CI** (later): `google-github-actions/auth@v3` with
   Workload Identity Federation + `roles/firebaserules.admin`, workflow
   `permissions: {id-token: write}`, OIDC subject pinned to the repo +
   `refs/heads/main`, then `firebase deploy --only firestore:rules
   --project <prod-id>`. Never a service-account key or legacy
   `FIREBASE_TOKEN` in CI (legacy path exists but is documented as less
   secure). NOTE: `google-github-actions/deploy-firebase` does not exist;
   `FirebaseExtended/action-hosting-deploy` is hosting-only.

## Tier 4 — Later / needs budget or product decisions

1. **Distributed guess-budget for driver codes**: shared-store rate limiting
   (Upstash `@upstash/ratelimit` sliding window, keyed per-IP AND a global
   `vc:global` budget attackers can't rotate past). The in-memory limiter is
   per-instance and IPs are rotatable — this is the biggest residual gap for
   the 6-digit codes. OWASP position: a static 6-digit (~20-bit) code as a
   persistent credential is only defensible as a high-risk secret with a
   global guess-budget + per-IP throttle + expiry/rotation + short sessions +
   burst alerting. (Replacement options — single-use codes/magic links — are
   blocked today: drivers have placeholder `@drivers.invalid` emails.)
2. **CAPTCHA escalation**: Cloudflare Turnstile (free, unlimited) after ≥3
   failures on both login forms, server-side Siteverify (token single-use,
   300 s). Alternative for directors: Google reCAPTCHA Enterprise enforcement
   on the email/password provider (`emailPasswordEnforcementState`, AUDIT →
   ENFORCE; availability/pricing per project unverified).
3. **HttpOnly session cookies**: exchange the existing custom-token flow for a
   `__Host-` `createSessionCookie` (14-day) + `verifySessionCookie(token,
   checkRevoked: true)` in the School-bus-API's handlers; call
   `revokeRefreshTokens(uid)` on
   role demotion / termination / "sign out everywhere". Kills XSS token theft
   from localStorage. Larger migration (keep `onAuthStateChanged` for
   Firestore UI). Firebase also ships `Persistence.COOKIE` (beta) for
   client/server sync.
4. **Content-Security-Policy.** Firebase Hosting serves a static SPA, so the old
   plan of per-request nonces from a Next.js proxy/middleware is no longer
   available. What is reachable now is a **static** CSP in the `firebase.json`
   `hosting.headers` block (no nonces), rolled out as
   `Content-Security-Policy-Report-Only` first. It must allow the Firebase
   connect-src hosts (`*.googleapis.com`, `*.firebaseio.com`,
   `firestore.googleapis.com`) and the Google Fonts origins until Material Symbols
   is self-hosted (Tier 1.3); `'unsafe-inline'` is likely needed for styles. A
   nonce-based CSP would require serving the shell from a host with edge
   middleware, or from the API itself.
5. **SAST**: Semgrep CE (free, intra-file only — misses cross-file bugs) now;
   CodeQL only if GitHub Code Security is ever purchased (~$30/active
   committer/mo, private repos; `codeql-action` init@v4 + `security-extended`).
6. **osv-scanner** scheduled scan (aggregates beyond npm advisory feed; SARIF
   upload on private repos may need Code Security — test `upload-sarif: false`
   first).
7. **Resolve the API repo's `npm audit` findings** — currently **9** (8 moderate,
   1 low). Every moderate is the single `firebase-admin` → `@google-cloud/*` →
   `google-gax` / `teeny-request` / `retry-request` / `uuid` chain, and is fixed by
   `firebase-admin@>=14.4`; the repo pins `^13.10.0`, so this needs a deliberate
   major bump (re-verify `cert`/`initializeApp`/`getAuth`/`getFirestore`/
   transactions afterwards). The low is `esbuild`, a devDependency of tsup/tsx.
   The **web repo is now at 0 vulnerabilities** — moving `firebase-admin` out
   carried the entire chain with it.
8. **Uptime checks** (UptimeRobot free / Better Stack free / Sentry free
   uptime monitor) probing the web app's `/` and the API's `/health` (which
   already exists and deliberately does not touch Firebase). Note: an HTTP 200
   does not exercise Firestore rules — real auth/backend health comes from
   the Tier 3.5 logs/alerts.

## Maintenance cadence (proposed)

- Quarterly: `npm audit`, `npm outdated`, deprecation check, uuid advisory
  re-check, key rotation (≥90 days), Dependabot alert review.
- Before launch: Tier 2 items 1–5 + Tier 1 all + Tier 3 items 1–5.
- Rules deploys only after Tier 3.3 tests pass in CI; keep the console
  rules-timeline rollback in mind.

## Unverified / check-hands-on items

Firebase "Auth user blocklist" feature (docs 404), a console toggle for TOTP
MFA (Admin SDK path is documented), native Firebase web passkeys (contradictory
evidence — check console), reCAPTCHA Enterprise pricing/enforcement on this
project, Vercel Firewall plan gating, GitHub free-private feature gating
(environments/branch protection/secret scanning are paid or public-only),
Sentry numeric alert condition syntax + free-tier channels, coverage-endpoint
curl-under-emulators:exec recipe shape, google-gax uuid bump status.

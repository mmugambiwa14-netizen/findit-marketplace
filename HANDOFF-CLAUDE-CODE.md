# PeekaListing — Remaining Work Handoff for Claude Code

Updated: 2026-08-13
Repository: `mmugambiwa14-netizen/findit-marketplace`
Working directory: `C:\Users\mmuga\OneDrive\Desktop\FindIt-Extensive-Product-Audit-Remediated-v2-2026-07-27`
Current branch: `cloudflare-staging-ready`
Current committed HEAD at handoff: `40d8a285f1a94651a81e2252cfa345bca83fb781`
Remote: `https://github.com/mmugambiwa14-netizen/findit-marketplace.git`

## Mission

Finish the five remaining workstreams below. This is a staging/pre-production handoff.

Do not point `peekalisting.com` at a new deployment, change production DNS, merge to
`main`, modify the production Supabase project, or deploy a production Worker while
working through this handoff.

Never place service-role keys, Supabase secret keys, VAPID private keys, Cloudflare
API tokens, or other server secrets in source, `VITE_*` variables, this handoff, a
commit message, or chat output. Use local process environment variables, dashboard
secrets, or GitHub Actions secrets only.

## What is already complete

The following source fixes are present in the working tree and have passed the
available static/contract gates:

- Service-worker push import, cache write lifetime, stale-while-revalidate lifetime,
  and stamped-worker verification.
- Logout push-subscription cleanup and cross-account React Query cache isolation.
- Account-scoped messaging, notification, Peek, recommendation, and Tour query keys.
- Bounded Tour history reads and batched service-image signing.
- Email delivery outbox schema/RPC compatibility, indexes, RLS/policy cleanup, and
  account-deletion guards.
- Constant-time Web Push dispatcher token comparison.
- Private marketplace rollback search-path hardening.
- Regression coverage in `tests/runtimeHardeningContracts.test.mjs` and updates to
  affected contract tests.

Last verified before this handoff:

- `npm run test:contracts`: 944 passed, 0 failed.
- Recommendation contracts: 79 passed.
- Tour contracts: 106 passed.
- Product audit contracts: 15 passed.
- Lint, application/migration/Edge Function typechecks, source graph, hygiene,
  SQL-boundary, deployment-security, workflow-pinning, and production dependency
  audit passed.
- Production build, service-worker stamp/check, bundle-secret scan, and build-budget
  verification passed.
- `FINDIT_STAGING_ORIGIN=https://staging.peekalisting.com npm run verify:cloudflare-staging`
  passed against the currently deployed staging site. That site was older than the
  current working tree, so rerun it after the new Pages deployment.
- Staging Supabase advisors had no performance warnings. The only security warnings
  were leaked-password protection disabled and insufficient MFA options.

## Current working-tree rules

The working tree contains intentional source, migration, test, and generated-audit
changes. Do not use `git reset --hard`, `git checkout --`, or broad cleanup commands.
Start with:

```powershell
git status -sb
git diff --stat
git diff --check
```

The three new migration files are currently untracked and are part of this work:

- `supabase/migrations/20260812150656_email_notifications_indexes_and_runtime_hardening.sql`
- `supabase/migrations/20260812153000_email_notification_policy_cleanup.sql`
- `supabase/migrations/20260812160000_runtime_advisor_hardening.sql`

The handoff file itself should be included in the eventual staging PR.

---

## 1. Deploy the current build to Cloudflare Pages staging

### Current state

Cloudflare Wrangler was not authenticated in the previous session. The deployment
script is already defined in `package.json`:

```text
deploy:pages:staging = npm run build && npx wrangler pages deploy dist --project-name=peekalisting-staging --branch=staging
```

Relevant files:

- `package.json` — `deploy:pages:staging` and `verify:cloudflare-staging` scripts.
- `public/_headers` — security headers; preserve it.
- `public/_redirects` — SPA fallback; preserve it.
- `public/sw.js` and `public/push-sw.js` — PWA/service-worker runtime.
- `scripts/stamp-service-worker.mjs` — build stamp/check.
- `scripts/verify-cloudflare-staging.mjs` — hosted staging acceptance verifier.
- `scripts/verify-deployment-security.mjs` — static Cloudflare boundary verifier.
- `.github/workflows/peekalisting-preview.yml` — Pages preview workflow.
- `.github/workflows/deploy-production-pages.yml` — production workflow; do not run
  or alter its production target during this task.

### Steps

1. Check the CLI and authentication without printing token values:

   ```powershell
   npx wrangler --version
   npx wrangler whoami
   ```

2. If unauthenticated, use the Cloudflare OAuth/device flow. Complete it in the
   authenticated browser/device flow, then rerun `npx wrangler whoami`:

   ```powershell
   npx wrangler login
   ```

   If the local callback is unavailable:

   ```powershell
   npx wrangler login --device --browser=false --no-use-keyring
   ```

   An API token is acceptable only as a process/CI secret with the minimum Pages
   deployment scope. Never put it in `.env`, `VITE_*`, Git, or this handoff.

3. Validate the source before deployment:

   ```powershell
   npm run verify:deployment-security
   npm run build
   npm run verify:service-worker
   ```

4. Deploy only the isolated staging Pages project/branch:

   ```powershell
   npm run deploy:pages:staging
   ```

5. Verify the custom staging hostname and the generated Pages deployment:

   ```powershell
   $env:FINDIT_STAGING_ORIGIN = 'https://staging.peekalisting.com'
   npm run verify:cloudflare-staging
   npx wrangler pages deployment list --project-name=peekalisting-staging
   ```

6. Confirm the latest deployment asset hash corresponds to the current build, SPA
   deep links work after refresh, PWA manifest/service worker are current, and
   `public/_headers` and `public/_redirects` are still active.

### Acceptance

Do not proceed to production routing. This workstream is complete only when the
current branch is live at staging, the verifier passes, and no Vercel URL appears in
the current staging auth/callback path.

---

## 2. Enable Supabase Auth hardening on the staging project

### Target and safety

Target only the staging Supabase project:

```text
Project ref: bwgklpxoetrrkutottdb
Project name: FindIt Staging
```

Do not apply these settings to the production Supabase project.

### Dashboard steps

Open the Supabase dashboard for the staging project, then go to:

```text
Authentication → Configuration → Password Security
```

Enable leaked-password protection / Have I Been Pwned password checks.

Then go to the Authentication MFA/security configuration and enable TOTP enrollment
and verification. If the dashboard offers another supported MFA factor and the
project owner wants the advisor fully clear, enable it only after reviewing its UX,
recovery, and email/phone implications. Do not enable a factor that the application
does not support without adding the corresponding product flow and tests.

### Repository verification

The read-only hosted verifier is already implemented at
`scripts/verify-hosted-auth-hardening.mjs`. It uses the exact project ref and does
not print the access token. Run it with process-only variables:

```powershell
$env:FINDIT_SUPABASE_ACCESS_TOKEN = '<staging-management-token>'
$env:FINDIT_EXPECTED_PROJECT_REF = 'bwgklpxoetrrkutottdb'
$env:FINDIT_AUTH_PREFLIGHT_MODE = 'staging'
$env:FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT = 'staging'
$env:FINDIT_EXPECT_LEAKED_PASSWORD_PROTECTION = 'true'
$env:FINDIT_EXPECT_TOTP_MFA = 'true'
npm run verify:hosted-auth-hardening
```

Do not save the token in a tracked file or send it to Claude through the repository.
If the dashboard uses different field names, update only the read-only policy
mapping in `scripts/lib/auth-config-policy.mjs` after checking the returned API
shape, then add a regression test.

### Acceptance

The staging advisor must no longer report:

- `auth_leaked_password_protection`
- `auth_insufficient_mfa_options`

Run the Supabase security advisor after the settings change and record the result in
the PR/acceptance notes. Do not change application authorization/RLS to hide an Auth
advisor warning.

---

## 3. Finish local database, RLS, browser, accessibility, PWA, and load certification

### Current state

Docker Desktop is installed and was started. Local Supabase is currently running at
the repository's configured ports, but the first local reset command was interrupted
by the user. Verify the state before proceeding. The local configuration intentionally
has Realtime disabled in `supabase/config.toml`; do not claim realtime browser QA
passed unless Realtime is explicitly started and tested.

Check:

```powershell
docker ps --format 'table {{.Names}}\t{{.Status}}'
npx supabase@2.84.2 status
```

### Clean local database certification

This is disposable local data only. Never add `--linked` and never run a reset against
a hosted project.

```powershell
npx supabase@2.84.2 db reset --local --yes
npx supabase@2.84.2 db lint --local --level error
```

The authoritative clean migration/RLS matrix is in:

```text
scripts/run-migration-database-certification.sh
supabase/tests/
```

From Git Bash/WSL, run:

```bash
bash ./scripts/run-migration-database-certification.sh
```

From PowerShell, run the individual package gates as needed:

```powershell
npm run test:web-push-local
npm run test:recommendation-database-local
npm run test:security-advisor-local
npm run test:auth-local
npm run test:owner-listings-local
npm run test:services-local
npm run test:admin-local
npm run test:business-profiles-local
npm run test:messaging-local
npm run test:notifications-local
npm run test:listing-creation-local
npm run test:media-lifecycle-local
npm run test:listing-expiry-local
npm run test:search-scale-local
npm run test:tours-upload-local
npm run test:tours-processing-local
npm run test:tours-lifecycle-local
npm run test:tours-seller-local
npm run test:tours-integration-local
npm run test:tours-discovery-local
npm run test:tours-moderation-local
npm run test:tours-scale-local
npm run test:messaging-scale-local
npm run test:notification-scale-local
```

If a suite requires a service intentionally stopped by `supabase/config.toml`,
record that exact dependency and start only the needed local service. Do not convert
an unavailable external integration into a fake pass.

### Browser/accessibility/PWA coverage

The repository currently has extensive Node/SQL contract coverage but does not have a
tracked Playwright/Vitest/Lighthouse stack in `package.json`. Claude should inspect
the current package before adding tooling. If browser certification is required,
add a pinned, maintained Playwright setup with isolated non-production test users and
failure artifacts; do not install a floating dependency or weaken the contract suite.

Minimum browser boundary after tooling is available:

- Chromium, Firefox, and WebKit critical flows.
- At least mobile widths 320/360/390/412 and desktop 1024/1280/1440.
- Auth redirect/session restoration in the installed PWA path.
- SPA deep links and refresh.
- listing/search/detail, Peeks, chats, notifications, profile, business, and admin
  authorization journeys.
- skeleton/loading, empty, error, offline/reconnect, service-worker update, and
  notification permission states.
- axe accessibility checks, keyboard navigation, focus trapping, labels, landmarks,
  and modal overflow.

Do not use production data or real user accounts. Keep traces/screenshots/video out of
Git unless intentionally needed as reviewed baselines.

### Acceptance

Every runnable local SQL/RLS/smoke suite passes after a clean reset. Any missing
browser dependency, unavailable provider, disabled Realtime service, or staging-only
credential is documented as an exact external blocker rather than suppressed.

---

## 4. Resolve the Cloudflare queue worker's unimplemented job types

### Current state

The worker is at:

```text
workers/edge/src/index.ts
```

Its queue consumer currently has a real `media.cleanup` implementation, but these
accepted types intentionally fail closed and retry to the DLQ:

```text
notification.dispatch
email.dispatch
web_push.dispatch
search.sync
analytics.record
```

This is not a harmless TODO. Do not acknowledge any of these jobs without a durable,
idempotent handler.

Related existing server boundaries to reuse, not duplicate:

- `supabase/functions/essential-notification-fanout/`
- `supabase/functions/transactional-email-dispatch/`
- `supabase/functions/web-push-dispatch/`
- recommendation queue/RPC migrations under `supabase/migrations/`
- notification and Web Push SQL contracts under `supabase/tests/`
- `infrastructure/cloudflare/wrangler.toml.example`
- `infrastructure/cloudflare/provision-staging.sh`
- `tests/criticalHighInfrastructureContracts.test.mjs`

### Required decision and implementation

For every accepted job type, choose one of these explicitly:

1. Implement a real adapter to the existing canonical Supabase/outbox boundary, with
   server-only credentials, bounded timeout, idempotency by job ID/domain event ID,
   safe payload validation, transient/permanent error classification, retry limits,
   and DLQ evidence; or
2. Remove the type from the accepted `PlatformJobType`/`JOB_TYPES` contract and ensure
   no producer can enqueue it until its domain handler is implemented.

Do not create generic “success” stubs. Do not move service-role credentials into the
browser. Do not call a public unrestricted send endpoint. Do not implement `search.sync`
or `analytics.record` unless the current repository has a canonical destination and
durable semantics for those jobs.

If implementing handlers, add focused worker tests covering:

- valid and malformed envelopes;
- success and acknowledgement;
- transient retry and bounded attempts;
- permanent failure/DLQ;
- duplicate delivery/idempotency;
- per-job timeout;
- partial multi-device Web Push delivery;
- trace/job correlation without private content in logs.

Use `wrangler check`/dry run and local `wrangler dev` or a dedicated test harness
before any staging Worker deployment. Provision only staging bindings/secrets using
the example files; do not create or delete production R2/Queue/KV resources.

### Acceptance

There are no accepted queue types that can silently lose work or retry forever. Every
supported type has tests and a staging-safe handler; unsupported types are rejected
before enqueue. The worker continues to acknowledge `media.cleanup` only after the
R2 deletion succeeds.

---

## 5. Publish the verified changes to GitHub without merging or cutting over production

### Current state

The current branch is `cloudflare-staging-ready` and has not been committed or pushed.
PR #60 is a separate draft PR whose head is the older branch
`infra/cloudflare-production-cutover` and whose previous CI pointed at Vercel. Do not
silently force-push the current work into that branch.

PR: `https://github.com/mmugambiwa14-netizen/findit-marketplace/pull/60`

### Steps

1. Review scope before staging. The current source, tests, migration files, generated
   audit artifacts, and this handoff are intentional. Check for unrelated user work:

   ```powershell
   git status -sb
   git diff --stat
   git diff --check
   ```

2. Run the final source gates after workstreams 1–4:

   ```powershell
   npm run lint
   npm run typecheck
   npm run typecheck:migration
   npm run typecheck:edge-functions
   npm run verify:sql-boundary
   npm run test:contracts
   npm run test:tours-contracts
   npm run test:product-audit
   npm run build
   npm run verify:service-worker
   npm run verify:bundle-secrets
   ```

3. Stage explicit intended files. Do not use a destructive cleanup. If generated
   artifacts changed only because of these tests, review them and include them when
   they are the repository's normal certification outputs.

4. Commit with a concise message, for example:

   ```text
   Harden staging runtime and complete audit handoff
   ```

5. Check GitHub CLI authentication without printing credentials:

   ```powershell
   gh --version
   gh auth status
   ```

6. Push the current branch:

   ```powershell
   git push -u origin cloudflare-staging-ready
   ```

7. Open or update a draft PR targeting `main`. Prefer a new draft PR for this branch
   unless the repository owner explicitly chooses to consolidate into PR #60. The PR
   body must state that production DNS/custom domain was not changed and must include
   the exact passed commands and any external blockers.

8. Do not merge, mark ready, or run production deployment until the staging Pages
   acceptance, staging Auth hardening, database/RLS certification, and any required
   live browser acceptance are complete.

### Acceptance

The branch has a reproducible commit SHA, is pushed to GitHub, and has a draft PR with
the validation evidence and remaining account-owner actions. Production remains
unchanged.

---

## Final report Claude should produce

Report only:

- five workstreams attempted and their status;
- staging deployment URL and deployed commit/build identity;
- Supabase staging Auth advisor result;
- local migration/RLS/smoke/browser test totals;
- queue job types implemented versus intentionally rejected;
- commit SHA and draft PR URL;
- exact unresolved external-only blockers;
- explicit confirmation that `peekalisting.com` and production Supabase were not
  changed.

Do not claim the release is certified while any required runnable test is failing or
while the current branch has not been deployed and verified in staging.

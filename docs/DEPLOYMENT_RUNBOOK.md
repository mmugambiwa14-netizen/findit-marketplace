# Deployment Runbook

Status: production deployment design; staging backend accepted, frontend host blocked
Last reviewed: 2026-07-26

This runbook deliberately contains gates and placeholders where the target
hosting/provider decision is absent. It is not evidence that FindIt can be
deployed today.


## Milestone 7 release-candidate addendum — 2026-07-27

Apply migrations through `0042` in order. Deploy `essential-notification-fanout` with its dedicated secret and enable `FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED` only after the queue, retry, dead-letter and observability smokes pass. Run `npm run certify:release-candidate`, then the guarded staging acceptance workflow, which includes public search, messaging, notification fan-out, Tours lifecycle and observability scale gates. Roll back in reverse order (`0042`, `0041`, `0040`) after disabling workers; preserve delivered notifications, queued/dead-letter jobs, canonical listings/conversations and metric evidence.

## Required inputs

- approved Document 4 and release scope;
- target static web host/CDN and production domains;
- Supabase organization/project and confirmed PostgreSQL major version;
- named release operator, reviewer, rollback decision-maker, and incident lead;
- environment-specific secrets/config from `ENVIRONMENT_VARIABLES.md`;
- explicit fresh-launch decision or supplied legacy-data reconciliation plan;
- immutable database and storage backups plus restore evidence;
- successful QA/RLS/auth/storage/provider test evidence;
- production data and object reconciliation manifests.

## Environment model

Use separate local, staging, and production Supabase projects and provider
credentials. Never reuse production secrets in local/staging. Browser builds
receive only public `VITE_*` values. Edge/server/service-role/provider secrets
remain in the relevant managed secret store.

Required frontend hosting behavior:

- HTTPS only with HSTS after validation;
- SPA fallback to `index.html` for all React Router paths;
- immutable cache headers for hashed assets and no immutable caching for HTML;
- security headers appropriate to the final integrations, including a tested
  Content Security Policy;
- compression and CDN delivery;
- no directory listing or source-map exposure unless intentionally protected;
- direct deep-link health checks for public, protected, admin, recovery, and
  not-found routes.

## Pre-deployment gates

From a clean checkout and supported Node/npm version:

```powershell
npm.cmd ci
npm.cmd audit
npm.cmd run validate:env
npm.cmd run lint
npm.cmd run typecheck:migration
npm.cmd run typecheck:active
npm.cmd run typecheck
npm.cmd run test:contracts
npm.cmd run verify:base44-elimination
npm.cmd run build
```

These commands are mandatory release gates. Their historical success does not substitute for a fresh run against this archive and its lockfile.

The checked-in `.github/workflows/migration-gates.yml` automates the currently
green frontend subset: locked installation, production dependency audit,
environment validation, lint, migration/active-graph typechecks, contracts,
and the Base44-free production build scan. It is pushed to the private
repository, but its shared result has not yet been independently verified. It intentionally does not claim the
broad typecheck, database, browser, provider, or deployment gates.

Database release gates:

```powershell
supabase db reset --local --no-seed
supabase db lint --local --level warning
supabase test db
```

Also apply the same pending migrations to an anonymized production-like
snapshot. Execute reconciliation and the full anon/user/owner/participant/
admin/super-admin/suspended RLS matrix. Execute the version-matched rollback or
forward-fix rehearsal and restore validation before production.

Current staging evidence: project `bwgklpxoetrrkutottdb` has migrations
`0001`–`0030`, clean hosted schema lint, four active Edge Functions, hosted
public REST/anonymous denial, dedicated maintenance-worker authentication and
a disposable Auth/profile/RLS/logout smoke. Linked pgTAP is blocked before
assertions by the managed CLI role's missing `extensions` schema usage; do not
replace that missing runner privilege with browser-role grants.

## Deployment sequence

1. Freeze the release commit, dependency lockfile, migration set, and object/
   data manifests; record checksums.
2. Confirm backups, PITR window, restore target, storage copy, and on-call
   ownership.
3. Put irreversible provider/data work behind an approved maintenance/cutover
   plan. Do not combine unrelated dependency, schema, auth, and storage changes.
4. Apply additive database migrations using the release identity. Capture
   start/end time, migration versions, output, and post-apply reconciliation.
5. Deploy and verify enabled Edge Functions with secrets and least-privilege
   caller configuration. The two upload functions verify user JWTs. The
   internal media-cleanup function must accept only the server secret bearer;
   never expose that credential to the browser.
6. Create/configure storage buckets and policies from the approved inventory;
   do not publish quarantined/unscanned objects.
7. Build the frontend using the production public variables and the frozen
   lockfile. Scan the output for secrets and unexpected Base44/provider hosts.
8. Deploy immutable assets and HTML, preserving the immediately previous
   frontend artifact for rollback.
9. Run health/smoke checks before opening traffic.
10. Configure the trusted media-cleanup schedule, run one bounded invocation,
    and verify claimed/cleaned/retry counts plus stale-claim alerts. Store its
    credential only in the scheduler's secret manager/Vault.
11. Observe the defined canary/soak period. Stop or roll back on gate breach.

## Health and smoke checks

- root and representative nested routes return the application over HTTPS;
- static assets load without mixed content or console initialization errors;
- signup confirmation, login, refresh, logout, recovery, blocked account, and
  denied admin access behave as expected;
- anonymous search/detail, owner listing CRUD, Favourites, messaging,
  lightweight Contact Support, and the six-page V1 admin journeys pass;
- RLS denial probes reject unrelated users and guessed object keys;
- enabled email/SMS notifications arrive once and retries are observable;
- disabled payment/AI features make no external calls;
- error, latency, database, auth, storage, and security telemetry is arriving;
- expired image intents are claimed in bounded batches, attached media is never
  selected, successful objects disappear, and retry/stale-claim alerts work;
- Base44 traffic matches the approved coexistence inventory, then reaches zero
  before final dependency removal.

## Frontend rollback

Restore the previous immutable frontend artifact and environment configuration,
then repeat deep-link and auth smoke checks. Frontend rollback must not assume a
database migration can be reversed.

## Database/data rollback

Use the release-specific rollback/forward-fix decision approved before the
release. Stop writes when required, preserve failure evidence, and restore to a
new validation target before replacing production. Destructive reversal must
never be improvised during an incident. See `BACKUP_AND_DISASTER_RECOVERY.md`.

## Completion record

Record release ID/commit, operators/reviewers, timestamps, artifacts and
checksums, migrations, feature flags, reconciliation totals, smoke-test links,
monitoring dashboards, incidents, rollback decision, and final sign-off.

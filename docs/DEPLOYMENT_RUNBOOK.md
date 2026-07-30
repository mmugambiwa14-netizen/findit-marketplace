# Deployment Runbook

Status: staging candidate accepted; production deployment not authorized
Last reviewed: 2026-07-30

This runbook defines release gates. It is not evidence that FindIt can be
opened to production traffic without the completion record and explicit owner
approval.

## Current release-candidate boundary

Freeze and deploy the complete contiguous migration chain through `0082`.
Migrations `0081` and `0082` harden the public business-profile projection and
move `pg_trgm` out of the exposed API schema. The implementation branch must
retain 82 migrations, 53 rollback capsules, green release-candidate gates,
green clean-database gates and a named staging acceptance record.

Deploy every enabled Edge Function from the frozen commit. Enable recommendation,
notification, expiry, media, Peek processing, cleanup, cache and observability
workers only after their independent secrets, bounded queues, retries,
dead-letter paths and health checks pass. Run `npm run certify:release-candidate`,
the guarded staging acceptance workflow and the read-only hosted Auth hardening
preflight before any production activation.

## Required inputs

- approved release scope and exact frozen commit;
- target static web host/CDN and final production domains;
- separate production Supabase project and confirmed PostgreSQL major version;
- named release operator, reviewer, rollback decision-maker and incident lead;
- environment-specific secrets/config from `ENVIRONMENT_VARIABLES.md`;
- explicit fresh-launch decision or supplied legacy-data reconciliation plan;
- immutable database and Storage backups plus isolated restore evidence;
- successful QA/RLS/Auth/Storage/provider test evidence;
- production data and object reconciliation manifests;
- approved monitoring destinations, alert thresholds, RPO and RTO.

## Environment model

Use separate local, staging and production Supabase projects and provider
credentials. Never reuse production secrets in local or staging. Browser builds
receive only public `VITE_*` values. Edge, service-role, worker, SMTP, OAuth,
monitoring and Management API credentials remain in the relevant managed secret
store.

Required frontend hosting behavior:

- HTTPS only with HSTS after validation;
- SPA fallback to `index.html` for every React Router path;
- immutable cache headers for hashed assets and no immutable caching for HTML;
- security headers appropriate to final integrations, including a tested
  Content Security Policy;
- compression and CDN delivery;
- no directory listing or source-map exposure unless intentionally protected;
- direct deep-link checks for public, protected, admin, recovery and not-found
  routes.

## Pre-deployment gates

From a clean checkout using the supported Node/npm version:

```powershell
npm.cmd ci
npm.cmd run audit:production
npm.cmd run validate:env
npm.cmd run verify:source-graph
npm.cmd run verify:hygiene
npm.cmd run verify:sql-boundary
npm.cmd run audit:product-surface
npm.cmd run lint
npm.cmd run typecheck:migration
npm.cmd run typecheck:active
npm.cmd run typecheck:edge-functions
npm.cmd run typecheck
npm.cmd run test:contracts
npm.cmd run test:tours-contracts
npm.cmd run verify:base44-elimination
npm.cmd run build
npm.cmd run certify:release-candidate
```

These commands are mandatory. Historical success does not substitute for a
fresh run against the frozen commit and lockfile.

The three PR suites must be green on the exact release commit:

- release candidate gates;
- migration gates, including both clean-database jobs;
- recommendation database gates.

The Management API token must not enter ordinary PR CI. During an authorized,
owner-controlled release session, declare the exact production Auth policy from
`ENVIRONMENT_VARIABLES.md` and run:

```powershell
npm.cmd run verify:hosted-auth-hardening
```

The command is GET-only and exact-target guarded. It must confirm the canonical
HTTPS site URL, exact redirect allowlist, sign-up confirmations, minimum
password strength, leaked-password protection, TOTP MFA, CAPTCHA, custom SMTP,
provider states and disabled anonymous/phone signup paths. A missing field or
missing expectation fails production certification.

Database release gates:

```powershell
supabase db reset --local --no-seed
supabase db lint --local --level error
supabase test db
```

Also apply the complete pending chain to an anonymized production-like snapshot.
Execute reconciliation, both new security matrices and the full
anon/user/owner/participant/admin/super-admin/suspended RLS matrix. Rehearse the
version-matched rollback or approved forward fix and validate restoration before
production.

Current staging evidence: `bwgklpxoetrrkutottdb` has migrations through `0082`,
including the security-invoker public business-profile projection and isolated
`pg_trgm` extension. Supabase Security Advisor no longer reports the former
security-definer-view error or extension-in-public warning. The complete clean
migration, RLS, recommendation, related-services, analytics and security
matrices pass. The staging frontend and guarded functional acceptance are
available, but this does not certify provider-side production Auth, mail,
domain, monitoring or recovery.

## Deployment sequence

1. Freeze the release commit, dependency lockfile, migration/function set and
   object/data manifests; record checksums.
2. Confirm native backups, PITR window, isolated restore target, Storage copy,
   numeric RPO/RTO and on-call ownership.
3. Record the fresh-launch or legacy reconciliation decision. Production is
   currently empty; do not copy staging fixtures or users by assumption.
4. Run the read-only production Auth hardening preflight and resolve every
   provider-side mismatch before database cutover.
5. Put irreversible provider/data work behind an approved maintenance plan. Do
   not combine unrelated dependency, schema, Auth, Storage and domain changes.
6. Apply additive database migrations using the release identity. Capture
   start/end time, migration versions, output and post-apply reconciliation.
7. Re-run Supabase Security and Performance Advisors. Stop on any ERROR or
   unreviewed security warning.
8. Deploy and verify enabled Edge Functions with least-privilege caller
   configuration. Upload functions verify user JWTs; internal workers accept
   only their independently rotated server bearers.
9. Create or verify private Storage buckets, object limits and policies. Do not
   publish quarantined, unattached or unprocessed objects.
10. Build the frontend with production public variables and the frozen lockfile.
    Scan output for secrets, stale staging references and unexpected providers.
11. Deploy immutable assets and HTML while preserving the immediately previous
    frontend artifact for rollback.
12. Configure all trusted worker schedules, run one bounded invocation per
    worker and verify claimed/completed/retry/dead-letter counts and alerts.
13. Run the full health, Auth, browser and device smoke matrix before traffic.
14. Observe the approved canary/soak period. Stop or roll back on any gate breach.

## Health and smoke checks

- root and representative nested routes return the application over HTTPS;
- assets load without mixed content or initialization errors;
- signup confirmation, Google callback, login, refresh, logout, recovery,
  replayed/expired recovery, blocked account and denied admin access behave as
  expected;
- TOTP enrollment/challenge/verification and required admin AAL enforcement pass;
- CAPTCHA protects signup, sign-in and password reset without trapping valid
  users;
- custom SMTP delivers confirmation, recovery, email-change and security mail
  exactly once, with unmodified Auth links;
- anonymous search/detail, owner listing CRUD, Favourites, messaging, support and
  all admin journeys pass;
- RLS denial probes reject unrelated users, suspended users and guessed object
  keys;
- disabled payment/AI/Apple/phone-signup paths make no external calls;
- error, latency, database, Auth, Storage, worker and security telemetry arrives
  at the approved destinations;
- expired image and Peek intents are claimed in bounded batches, attached media
  is never selected, successful objects disappear, retries/dead letters are
  observable and stale-claim alerts fire;
- recommendations, personalization, analytics and Peek failures never prevent
  canonical listing pages from loading;
- iPhone Safari/Chrome, Android Chrome, desktop Chrome/Safari/Firefox, keyboard,
  screen reader, reduced motion, low bandwidth and failed playback checks pass.

## Frontend rollback

Restore the previous immutable frontend artifact and environment configuration,
then repeat deep-link and Auth smoke checks. Frontend rollback must not assume a
database migration can be reversed.

## Database/data rollback

Use the release-specific rollback or forward-fix decision approved before the
release. Disable affected workers, stop unsafe writes when required, preserve
failure evidence and restore to a new validation target before replacing
production. Destructive reversal must never be improvised during an incident.
See `BACKUP_AND_DISASTER_RECOVERY.md`.

## Completion record

Record the release ID and commit, operators/reviewers, timestamps, artifacts and
checksums, migrations, Edge Function versions, feature flags, Auth preflight
summary, reconciliation totals, browser/device evidence, monitoring dashboards,
backup/restore evidence, incidents, rollback decision and final sign-off.
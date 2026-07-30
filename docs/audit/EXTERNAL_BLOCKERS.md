# External Production Blockers

Reviewed: 2026-07-30

This file records only boundaries that still require an external provider,
credential, owner decision, physical device or production change window. Local,
CI and hosted staging evidence is no longer listed as blocked.

## Cleared evidence

The following former blockers are closed on the current implementation branch:

- all 82 migrations apply to clean PostgreSQL/Supabase stacks in GitHub Actions;
- both clean-database jobs pass schema lint and the complete pgTAP matrix;
- release candidate, migration and recommendation database workflows pass on
  branch head `0b9496c004aec244fb98e2faef44d5eb1d7ba377`;
- hosted staging is migrated through `0082`;
- hosted listing, service, messaging, recommendation, analytics, worker and Peek
  acceptance evidence exists;
- the staging frontend is deployed on GitHub Pages;
- the former Security Advisor definer-view ERROR is fixed;
- `pg_trgm` is no longer installed in the exposed `public` schema;
- Base44 production dependencies and runtime references are removed.

Historical statements that Docker, migrations, GitHub Actions, runtime smoke or
the staging frontend had never run are superseded by this evidence.

## 1. Production release authorization and cutover window

**Blocks:** every production database, Edge Function, worker and frontend
change.

Required externally:

- explicit owner approval to promote the frozen implementation commit;
- named release operator, independent reviewer, rollback decision-maker and
  incident lead;
- a maintenance/cutover window covering migrations `0050` through `0082` and
  all changed Edge Functions;
- a signed fresh-launch decision. The production project is empty and staging
  fixtures, users and objects must not be copied by assumption;
- a release completion record with checksums, migration/function versions,
  reconciliation totals and final sign-off.

Production `jvbpxnfxkptuexgssplj` remains intentionally untouched at migration
`0049` until these conditions are met.

## 2. Production domain, host, DNS and TLS

**Blocks:** production redirects, OAuth publication, sender-domain mail links,
HSTS/CSP certification and real-user traffic.

Required externally:

- final application domain and frontend host/CDN;
- DNS ownership and HTTPS certificate;
- SPA fallback, immutable hashed-asset caching and non-immutable HTML caching;
- tested HSTS, Content Security Policy and other response headers;
- exact production origin in Supabase Auth redirects, upload CORS and OAuth
  provider configuration;
- deep-link checks for public, protected, admin, recovery and not-found routes.

The GitHub Pages site remains staging only and is bound to the staging Supabase
project.

## 3. Hosted Auth hardening

**Blocks:** production signup, account recovery and privileged administration.

The repository now includes the read-only, exact-target guarded command:

```powershell
npm.cmd run verify:hosted-auth-hardening
```

The provider-side settings still require an authorized owner session and a
compatible plan. Production certification requires:

- canonical HTTPS site URL and exact redirect allowlist;
- email confirmations enabled;
- minimum password length of at least 12 and the approved strongest character
  policy;
- leaked-password protection enabled;
- TOTP MFA enabled and enrolled for every founder/admin account;
- CAPTCHA or equivalent bot protection enabled for Auth entry points;
- anonymous Auth and direct phone signup disabled for the current release;
- custom SMTP and verified sender configured;
- Google OAuth publicly published and callback-tested if its button is enabled;
- Apple remaining disabled and hidden unless separately approved.

The Management API access token remains process-only and must never enter
ordinary PR CI or browser variables.

## 4. Production SMTP and sender domain

**Blocks:** reliable confirmation, recovery, email-change and security mail.

Required externally:

- approved SMTP provider or compatible Supabase plan;
- verified sender domain, sender address and DNS records;
- published repository templates;
- provider link tracking disabled so Auth URLs are not rewritten;
- delivery, bounce and suppression monitoring;
- confirmation, recovery, email-change and security-message browser tests.

Supabase's default testing mail service is not accepted for production.

## 5. Monitoring and incident response destinations

**Blocks:** safe production operation even though database-side metrics,
health functions, bounded workers and operational alerts exist.

Required externally:

- approved frontend and Edge error sink;
- delivery destination for `operational_alerts` and worker dead-letter alerts;
- database, Auth, Storage, latency, saturation and abuse dashboards;
- alert thresholds, escalation route and incident ownership;
- log retention and access controls appropriate to user privacy;
- canary/soak stop conditions and a tested incident procedure.

An alert table without a routed human destination is not production monitoring.

## 6. Native backup, PITR and isolated restore

**Blocks:** production migrations and real user data.

Required externally:

- provider-native backup/PITR on a plan that meets the approved objective;
- numeric RPO and RTO plus a named backup owner;
- encrypted pre-cutover database backup;
- Storage bytes and metadata captured at the same recovery point;
- native restore into a separate isolated project;
- count, checksum, Auth/profile, foreign-key, RLS and object verification;
- measured recovery time and data-loss result;
- credential/session rotation procedure for compromise scenarios.

The verified staging logical export is useful evidence but is not a substitute
for provider-native recovery.

## 7. Production secrets and worker schedules

**Blocks:** production notifications, cleanup, expiry, recommendation
maintenance and Peek processing.

Required externally:

- independent, randomly generated production worker secrets;
- matching secret placement in Supabase and the approved scheduler only;
- exact production upload origins;
- request-budget salt and protected health credentials;
- enabled schedules for media cleanup, listing expiry, notification fan-out,
  recommendation maintenance, Peek processing, cleanup, cache invalidation and
  observability;
- one bounded smoke invocation per worker with retry/dead-letter evidence;
- secret rotation owner and schedule.

No service-role or worker secret may enter a `VITE_` variable or generated
frontend asset.

## 8. Browser, device and assistive-technology acceptance

**Blocks:** opening the exact production build to broad traffic.

Required physical or hosted-browser evidence:

- iPhone Safari and Chrome;
- Android Chrome;
- desktop Chrome, Safari and Firefox;
- keyboard-only and screen-reader navigation;
- reduced-motion mode;
- slow and interrupted mobile networks;
- expired signed media, failed upload, failed processing and failed playback;
- signup, confirmation, Google callback, refresh, logout, recovery and revoked
  sessions;
- responsive layout, safe-area handling, touch targets and deep links.

Static accessibility and route contracts remain necessary but are not a
replacement for real assistive-technology testing.

## 9. Capacity and cost acceptance

**Blocks:** claims that the initial production configuration can sustain large
traffic rather than merely scale architecturally.

Required externally:

- approved initial Supabase, frontend host, Storage/CDN and Actions/provider
  plans;
- production-like load tests for public search, listing detail, messaging,
  notifications, recommendation services and Peek delivery;
- connection, database, Storage, bandwidth, FFmpeg queue and Actions-minute
  budgets;
- alert thresholds and scaling triggers;
- a documented degraded mode that keeps canonical listing pages available when
  recommendations, analytics, notifications or Peek infrastructure fails.

## Current production decision

The codebase and hosted staging environment are release candidates. Production
remains blocked by the external items above. Do not merge the draft PR, migrate
the production project or onboard real users until the owner-approved cutover
record closes or explicitly accepts each item.
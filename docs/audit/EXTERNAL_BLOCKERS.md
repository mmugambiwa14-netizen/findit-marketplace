# External Production Blockers

Reviewed: 2026-07-31  
Staging SQL boundary: `0101`  
Production SQL boundary: `0049`

This file lists work that cannot be completed safely through repository or
staging database changes alone. Repository-owned feature, maps and public
privileged-RPC findings are closed. Exact-source package-lock normalization and
MapLibre asset vendoring remain documented internal boundaries in
`docs/certification/internal-release-engineering-2026-07-31.md`. The draft PR
remains unmerged.

## Cleared in repository and staging

- MapLibre GL JS `5.12.0` and MapTiler Cloud replace Leaflet/direct public OSM
  tile use.
- Current location is opt-in, city-resolving and exact-coordinate non-persistent.
- Incomplete feature flags are fail-closed for the Zimbabwe-first release.
- Recommendation metadata matches seven enabled services.
- Redundant browser grants on `recommendation_events_default` are removed.
- All anonymous-callable and authenticated-callable public privileged functions
  are cleared through private implementations and public invoker wrappers.
- Staging has 101 canonical migrations through `0101`, with zero sequence
  mismatch or generated-version residue.
- The due Peek cache-invalidation queue is zero after bounded recovery.
- Repository hygiene scans production source for unfinished markers.
- Deployment security, immutable Action pins, dependency inventory, centralized
  database matrices and exact-source certification are repository-enforced.

## 1. GitHub Actions runner execution

Current workflows still fail before runner steps begin. Jobs expose no steps or
logs, so this is not accepted as either a code pass or a test assertion failure.

Required externally:

- restore GitHub Actions runner/account execution;
- run release candidate, migration and recommendation database workflows;
- require all suites to pass on one unchanged final commit;
- confirm scheduled notification, recommendation, Peek and observability jobs
  execute automatically.

Hosted staging migrations, semantic matrices and rollback transactions are
supporting evidence but do not replace final conventional CI.

## 2. Production release authorization

Production project `jvbpxnfxkptuexgssplj` remains intentionally unchanged at
migration `0049`.

Required externally:

- explicit owner approval;
- named release operator, reviewer, rollback decision-maker and incident lead;
- migration and Edge Function cutover window;
- pre-cutover backup and rollback checkpoints;
- fresh-launch or legacy-reconciliation decision;
- signed completion record for the exact promoted commit.

## 3. Domain, hosting, DNS and TLS

Required externally:

- final production domain and host/CDN;
- DNS ownership and HTTPS certificate;
- application of the repository-owned SPA rewrite and response-header policy;
- exact production origin in Supabase redirects, CORS and OAuth settings;
- deployed verification of HSTS, CSP, cache rules and deep links;
- deep-link tests for public, protected, admin, recovery and fallback routes.

## 4. MapTiler production configuration

The code and environment contracts are complete. Each deployed environment
still requires:

- a separate MapTiler browser key restricted to exact allowed origins;
- approved `VITE_MAPTILER_STYLE_ID`;
- key quota, abuse and cost alerts;
- browser acceptance for vector styles, reverse geocoding and degraded map
  behavior;
- the current CSP allowance for the exactly pinned MapLibre runtime, followed
  by removal of that allowance when the official assets are vendored.

No unrestricted MapTiler key should be committed or exposed on an unapproved
origin.

## 5. Supabase Auth hardening

The connector can verify advisor state but exposes no supported mutation for
these provider settings. Required owner/provider actions are:

- enable leaked-password protection;
- enable TOTP MFA and enroll every founder/admin account;
- configure CAPTCHA or equivalent bot protection;
- set canonical site URL and exact redirect allowlist;
- keep anonymous Auth and direct phone signup disabled for V1;
- configure production SMTP and verified sender domain;
- publish and callback-test Google OAuth before enabling its production button;
- keep Apple OAuth disabled unless separately certified.

Current advisor warnings remain for leaked-password protection and insufficient
MFA options.

## 6. Monitoring and incident response

Required externally:

- routed error and alert destination;
- database, Auth, Storage, latency, saturation and abuse dashboards;
- escalation ownership and incident runbook;
- verified scheduler execution for notification, recommendation, Peek cleanup,
  cache invalidation and observability workers;
- log-retention and privacy controls.

An empty queue after manual recovery is not proof that scheduling is healthy.

## 7. Backup, PITR and isolated restore

Required externally:

- provider-native backup/PITR on an approved plan;
- numeric RPO and RTO;
- encrypted pre-cutover database and Storage backup;
- restore into a separate isolated project;
- count, checksum, foreign-key, Auth/profile, RLS and object verification;
- measured recovery result and named recovery owner.

## 8. Browser, device and accessibility acceptance

Required on the exact production build:

- iPhone Safari and Chrome;
- Android Chrome;
- desktop Chrome, Safari and Firefox;
- keyboard-only and screen-reader navigation;
- reduced motion and safe-area behavior;
- interrupted and slow mobile networks;
- signup, confirmation, Google callback, logout and recovery;
- MapLibre rendering, MapTiler failure states and location permission denial;
- CSP compatibility for runtime styles without inline script permission;
- Peek upload, processing, playback and cleanup failures.

## 9. Capacity and cost acceptance

Required externally:

- approved Supabase, host/CDN, Storage, MapTiler and scheduler plans;
- production-like load tests for search, details, messaging, notifications,
  recommendations and Peek;
- connection, bandwidth, Storage, geocoding and FFmpeg budgets;
- cost alerts and scaling triggers;
- validated degraded modes that keep canonical listing pages available.

## Current decision

The branch remains a staging release candidate. Before merge or production, the
internal exact-source lock and runtime-asset boundaries must be closed, and the
external gates above must pass or be explicitly accepted in a signed production
decision. Do not migrate production or onboard real users from the current
state.

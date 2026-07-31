# External Production Blockers

Reviewed: 2026-07-31  
Staging SQL boundary: `0100`  
Production SQL boundary: `0049`

This file lists only work that cannot be completed safely through repository or
staging database changes alone. Repository-owned feature-control and maps drift
has been corrected. The draft PR remains unmerged.

## Cleared in repository and staging

- Map rendering now uses MapLibre GL JS `5.12.0` with MapTiler Cloud.
- Current location is implemented as an opt-in city-resolution flow with manual
  fallback and no persistence of exact device coordinates by the control.
- Currency conversion, phone verification, service radius and international
  publishing are fail-closed until complete contracts exist.
- Recommendation operational metadata matches seven enabled services.
- Redundant browser grants were removed from
  `recommendation_events_default`.
- Staging has 100 canonical migration rows from `0001` through `0100`, zero
  sequence mismatches and zero generated-version residue.
- Seven due Peek cache invalidations were recovered; the due queue is zero.
- Repository hygiene now scans production source for unfinished markers.
- Leaflet is removed from the active package manifest and source graph.

## 1. GitHub Actions runner execution

Recent workflows fail before runner steps begin. This blocks conventional
clean-checkout, build and clean-database certification on the final unchanged
head.

Required externally:

- restore GitHub Actions runner/account execution;
- run release candidate, migration and recommendation database workflows;
- require all suites to pass on one unchanged final commit;
- confirm scheduled worker and observability workflows execute automatically.

Hosted rollback-only staging transactions are valid supporting evidence but do
not replace final conventional CI.

## 2. Production release authorization

Production project `jvbpxnfxkptuexgssplj` remains intentionally unchanged at
migration `0049`.

Required externally:

- explicit owner approval;
- named release operator, reviewer, rollback decision-maker and incident lead;
- a migration and Edge Function cutover window;
- pre-cutover backup and rollback checkpoints;
- fresh-launch or legacy-reconciliation decision;
- signed completion record for the exact promoted commit.

## 3. Domain, hosting, DNS and TLS

Required externally:

- final production domain and host/CDN;
- DNS ownership and HTTPS certificate;
- SPA deep-link fallback and cache rules;
- HSTS, Content Security Policy and response-header certification;
- exact production origin in Supabase redirects, CORS and OAuth settings;
- deep-link tests for public, protected, admin, recovery and fallback routes.

## 4. MapTiler production configuration

The code and environment contracts are complete, but each deployed environment
still requires:

- a MapTiler browser key restricted to the exact allowed web origins;
- approved `VITE_MAPTILER_STYLE_ID`;
- key quota, abuse and cost alerts;
- browser acceptance for vector styles, reverse geocoding and degraded map
  behavior;
- Content Security Policy allowances for the pinned MapLibre runtime and
  MapTiler endpoints, or self-hosting of the pinned runtime assets.

No unrestricted MapTiler key should be committed or exposed on an unapproved
origin.

## 5. Supabase Auth hardening

The current connector exposes advisor checks but no supported mutation for
these provider settings. They therefore remain owner/provider actions:

- enable leaked-password protection;
- enable TOTP MFA and enroll every founder/admin account;
- configure CAPTCHA or equivalent bot protection;
- set the canonical site URL and exact redirect allowlist;
- keep anonymous Auth and direct phone signup disabled for V1;
- configure production SMTP and a verified sender domain;
- publicly publish and callback-test Google OAuth before enabling its production
  button;
- keep Apple OAuth disabled unless separately certified.

Current Supabase Security Advisor warnings remain for leaked-password protection
and insufficient MFA options.

## 6. Monitoring and incident response

Database metrics, operational alerts and bounded workers exist, but production
still needs:

- a routed error and alert destination;
- database, Auth, Storage, latency, saturation and abuse dashboards;
- escalation ownership and incident runbook;
- verified scheduler execution for notification, recommendation, Peek cleanup,
  cache invalidation and observability workers;
- log-retention and privacy controls.

An empty queue after manual recovery is not proof that the scheduler is healthy.

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

The branch and staging database are release candidates, not a production
release. Do not merge the draft PR, migrate production or onboard real users
until the external gates above and the remaining authenticated-function
hardening are closed or explicitly accepted in a signed cutover decision.

# Milestone 7 — Scale Hardening and Release Certification

Status: **repository implementation complete; hosted production acceptance required**  
Date: 2026-07-27

## Completed boundary

This milestone closes the remaining repository work in the approved FindIt redesign and Tours plan while preserving canonical listing, saved-item and conversation identities.

### High-volume reads

- Chats use deterministic keyset pages: 30 conversations and 50 messages per request.
- Public Property, Vehicle and Machinery search uses a generated search document, hot-path indexes, `limit + 1` keyset pages and no exact browse count.
- Notifications use owner-scoped `(created_at, id)` keysets with a maximum page size of 50.
- The public Tours catalogue retains its `(published_at, id)` cursor and eligible-feed partial index.
- Active browser pages no longer use deep offsets or full-thread loading on these paths.

### Essential notification delivery

- Tour ready, failed and rejected events are server-generated.
- Listing status changes notify the owner.
- Saved-listing unavailability is queued instead of synchronously fanning out inside the listing transaction.
- The service-only worker claims jobs with leases, processes bounded recipient pages, retries with capped exponential backoff and dead-letters terminal failures.
- Delivery is idempotent by recipient, event type and source key.
- Queue rows, recipient identities and notification bodies are not exposed to browser roles or copied into telemetry.

### Operational visibility

- Compact hourly metrics cover upload, processing, cleanup, cache, feed, playback, reports, messages and notification fan-out.
- Deterministic alerts cover processing failures, latency, abandoned uploads, dead-letter queues, fan-out backlog and stale claims.
- Founder health reads compact snapshots instead of repeatedly scanning full media or fan-out tables.
- Completed fan-out jobs have bounded service-controlled retention; dead letters remain for investigation.
- External alert delivery and provider dashboards remain deployment configuration, not repository code.

### Release control

- Production Tours remain closed unless a named staging acceptance record is supplied.
- Essential notification workers are separately feature-gated and require a dedicated secret.
- CI contains repository hygiene, SQL boundary, locked install, lint, all typechecks, contracts, production build and production audit gates.
- The manual staging acceptance workflow now runs Tour lifecycle, public search scale, messaging scale, notification fan-out scale and observability suites.
- Rollbacks disable new functions and triggers in reverse order while preserving canonical data, delivered notifications, queued jobs and incident evidence.

## New release units

- `supabase/migrations/0040_v1_scale_hardening_and_observability.sql`
- `supabase/migrations/0041_v1_public_search_and_notification_scale.sql`
- `supabase/migrations/0042_v1_release_observability_completion.sql`
- matching targeted rollback files under `supabase/rollback/`
- `supabase/functions/essential-notification-fanout/`
- updated `supabase/functions/tour-observability-monitor/`

## Package verification

Run:

```bash
npm run certify:release-candidate
```

The command writes `artifacts/milestone-7-release-certification.json` and records contracts, source graph, repository hygiene, SQL boundary, environment validation and any installed-toolchain gates available in the environment.

Current package evidence is also summarized in `QA_STATUS.md` and `RELEASE_CANDIDATE_VERIFICATION.md`.

## Required hosted acceptance

Before production activation:

1. Apply migrations through `0042` to an authorized local runtime and staging.
2. Complete a locked install, lint, all typechecks, production build and dependency audit.
3. Run every guarded hosted lifecycle, search, messaging, notification and observability smoke.
4. Inspect actual query plans, connection usage, storage growth, bandwidth and worker queues.
5. Complete iOS Safari, Android Chrome, desktop, keyboard, screen-reader, reduced-motion and low-bandwidth acceptance.
6. Disable Tours and notification fan-out, then rehearse targeted rollback in reverse order without deleting canonical data or incident evidence.
7. Retain the generated staging acceptance artifact and configure its exact identity for production.

This archive is a **production candidate**, not evidence of a deployed production release.

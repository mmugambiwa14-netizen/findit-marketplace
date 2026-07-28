# Phase 1 Rollback and Restore Strategy

FindIt migrations are forward-only. Production rollback means restoring the
immutable pre-release backup into an isolated replacement project/database,
verifying it, and switching traffic only under the approved incident plan. A
generic down migration that drops 41 tables is intentionally not supplied:
it would destroy user data and would be less safe than a tested restore.

## Checked-in executable rehearsal

The Windows-local rehearsal uses:

- `scripts/phase1-backup-local.ps1`
- `scripts/phase1-restore-rehearsal.ps1`

The backup script targets the `public` application schema and the required
`auth` data in the exact local container `supabase_db_findit`. It deliberately
excludes Supabase-owned platform schemas, including `vault`, `storage`,
`realtime` and platform-specific `extensions`; their recovery follows the
provider-supported project backup/export procedure. The restore script creates
only the three documented PostgreSQL extension prerequisites in the disposable
database, verifies SHA-256, restores into only that database
`findit_restore_rehearsal`, checks public-table and RLS-table counts, then
removes that disposable database. It never replaces the main local `postgres`
database.

Example from the repository root:

```powershell
New-Item -ItemType Directory -Path C:\tmp -Force
./scripts/phase1-backup-local.ps1 -OutputFile C:\tmp\findit-phase1.dump
./scripts/phase1-restore-rehearsal.ps1 `
  -BackupFile C:\tmp\findit-phase1.dump `
  -ExpectedSha256 '<hash printed by backup>' `
  -Confirmation FINDIT_LOCAL_RESTORE_REHEARSAL
```

## Production release requirements

Before applying migrations to a shared environment:

1. Identify the exact prior migration version and database owner.
2. Take a provider-supported physical/PITR backup and a logical backup.
3. Record SHA-256, size, timestamp, encryption and access location.
4. Restore into an isolated project and run schema/RLS/reconciliation checks.
5. Record RPO, RTO, restore duration and the traffic-switch procedure.
6. Prefer a reviewed forward fix when data written under the new schema cannot
   safely be represented by the old schema.
7. Never execute a destructive down script against an unresolved target.

Production credentials, backup URLs and encryption keys must remain in the
approved secrets/operations system, not this repository.


## Tours Milestone 3 / C rollback

The seller workflow remains protected by both `VITE_FEATURE_TOURS` and the
backend `tours` feature state. For an incident, disable browser exposure and
backend writes before changing schema behavior.

Migration `0036_v1_seller_tour_workflow.sql` widens owner upload eligibility
to normal review, correction and renewal states, renews an expired authorization
in place only while its canonical parent remains eligible, and permits
idempotent completion when the exact object reached private Storage just before
authorization expiry. Its targeted rollback is:

```text
supabase/rollback/0036_v1_seller_tour_workflow.rollback.sql
```

The rollback restores the previous `draft`, `available`, and `under_offer`
authorization boundary and the Milestone 2 rule that an upload must be
confirmed before its authorization expires. It does not drop Tour rows or
media. Existing objects must remain available for investigation and controlled
cleanup.

## Tours Milestone 4 / D rollback

Migration `0037_v1_listing_tour_integration.sql` adds metadata-only public Tour summaries, unavailable saved-listing entitlements, richer listing context in messaging, and broader parent cache invalidation. Disable browser and backend Tours before rollback.

Targeted rollback:

```text
supabase/rollback/0037_v1_listing_tour_integration.rollback.sql
```

The rollback removes `public_tour_summaries`, restores the Milestone 3 listing, saved-listing, media and storage policies, restores the previous inbox/conversation result shapes and new-conversation eligibility, and returns Tour invalidation triggers to status-only behavior. It intentionally preserves all Tour rows, media objects, reports, cleanup jobs and audit history.

## Tours Milestone 5 / E rollback

Migration `0038_v1_public_tours_catalogue.sql` adds the service-only public
Tours read model and seven supporting feed/search indexes. Disable
`VITE_FEATURE_TOURS`, redeploy the previous frontend if necessary, and disable
backend Tour publication before changing the schema.

Targeted rollback:

```text
supabase/rollback/0038_v1_public_tours_catalogue.rollback.sql
```

The rollback removes `public_tour_feed` and only the indexes introduced by
migration `0038`. It preserves canonical listings and services, Tour rows,
private source/playback/thumbnail objects, saves, conversations, reports,
cleanup jobs and audit history. Do not delete media during an emergency UI or
feed rollback; retain it for investigation and controlled cleanup.


## Tours Milestone 6 / F rollback

Migration `0039_v1_tour_reporting_and_admin.sql` adds durable report target
identity, a Tour-aware report queue and decision path, the expanded founder Tour
queue, and an admin-only review-media metadata boundary. Disable
`VITE_FEATURE_TOURS`, disable backend Tour publication, and undeploy
`tour-admin-review-access` before applying a database rollback.

Targeted rollback:

```text
supabase/rollback/0039_v1_tour_reporting_and_admin.rollback.sql
```

The rollback removes the expanded Tour queue and private review-media RPC, then
restores the Milestone 2 queue signature. It intentionally preserves the
Tour-safe report decision path, `target_id`, report identity trigger, reports,
Tours, canonical listings/services, users, audit history, and media. Reverting
those safety additions would reintroduce a known defect where actioning a Tour
report could delete its parent listing.

## Milestone 7 public search and notification scale rollback

Migration `0041_v1_public_search_and_notification_scale.sql` replaces deep
public-search and notification offsets with bounded keyset pages, adds the
saved-listing notification fan-out queue, and emits compact queue health
snapshots. Before rollback, deploy the previous frontend and stop
`essential-notification-fanout`.

Targeted rollback:

```text
supabase/rollback/0041_v1_public_search_and_notification_scale.rollback.sql
```

The rollback disables new lifecycle triggers, worker RPCs, health functions and
keyset read APIs. It intentionally preserves delivered notifications, fan-out
jobs, generated search documents, indexes and operational metrics for incident
reconciliation. Do not purge pending jobs or notification history until the
incident owner has recorded the disposition of every unfinished batch.


## Milestone 7 release observability completion rollback

Migration `0042_v1_release_observability_completion.sql` is the sole owner of
notification fan-out alert evaluation, founder queue health and bounded
completed-job retention. Stop `tour-observability-monitor` before rollback.

Targeted rollback:

```text
supabase/rollback/0042_v1_release_observability_completion.rollback.sql
```

Apply this rollback before `0041` and `0040`. It removes the alert/health/retention
functions and retention index, but intentionally preserves fan-out jobs,
delivered notifications, operational metrics and alerts for incident evidence.

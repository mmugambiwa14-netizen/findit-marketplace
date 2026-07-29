# Recommendation Foundation Runbook

## Boundary

Phase 1 provides data, projection, privacy, retention, configuration and operational foundations only. Phase 2 recommendation APIs remain disabled. Listing routes, listing publication and listing actions do not depend on this subsystem.

## Migration sequence

- `0050_recommendation_data_foundation.sql` — normalized taxonomy, relationships, projections, partitioned first-party events, cache and popularity aggregates.
- `0051_recommendation_projection_ingestion_and_retention.sql` — projection logic, bounded event RPC, partition preparation, retention and aggregate refresh.
- `0052_recommendation_taxonomy_weights_and_admin.sql` — organic ranking profiles and audited administration.
- `0053_recommendation_foundation_hardening.sql` — attribution, privacy, immutability and hot-index constraints.
- `0054_recommendation_foundation_certification_corrections.sql` — cursor and aggregate-write corrections plus bounded health reporting.
- `0055_recommendation_projection_queue.sql` — asynchronous fail-open projection queue, retries and dead letters.
- `0056_recommendation_partition_and_configuration_integrity.sql` — safe populated-partition migration and configuration-integrity enforcement.

Every migration has a matching non-destructive rollback capsule. Rollbacks disable access or workers and preserve records, audit evidence, queues and dead letters.

## Listing isolation guarantee

Listing and detail triggers only attempt to enqueue a projection job. Enqueue failures are caught inside the trigger and never abort the authoritative listing transaction. Projection work runs separately through `process_listing_recommendation_projection_jobs`, using bounded batches and `FOR UPDATE SKIP LOCKED`.

A failed projection receives a stable `projection_failed` code, retries with capped exponential backoff and moves to a retained dead-letter row after the configured attempt limit. Raw PostgreSQL errors are not stored in the queue or returned to customers.

## Worker operation

The internal Edge Function is `recommendation-maintenance`. It requires `FINDIT_RECOMMENDATION_WORKER_SECRET`, uses a constant-time bearer comparison and exposes no browser contract.

Supported modes:

- `projection` — drains up to 500 due projection jobs, with 1–20 allowed attempts.
- `maintenance` — prepares seven monthly event partitions, refreshes current/recent popularity aggregates and purges bounded expired data.
- `all` — performs both paths for controlled manual recovery.

GitHub scheduling remains opt-in through `FINDIT_RECOMMENDATION_WORKERS_ENABLED=true`:

- Projection: every five minutes, batch 200, maximum eight attempts.
- Maintenance: daily at 03:11 UTC, retention batch 5,000.

Disabling the worker delays projections or maintenance but never disables listing delivery.

## Verification

Static and source gates:

```text
npm run verify:recommendation-phase1
```

Complete local database certification with Docker and Supabase CLI:

```text
supabase db start
supabase db lint --local --level error
npm run certify:recommendation-phase1-local
supabase stop --no-backup
```

The database suites cover guest, authenticated owner, unrelated user, suspended user, admin and service-role boundaries; spoofed attribution; invasive context rejection; retention; populated partition migration; stable cursors under concurrent inserts; queue failure isolation; retry; dead letters; and suspension-aware projection removal.

## Recovery

1. Keep listing traffic running; recommendation maintenance is not a listing dependency.
2. Inspect `recommendation_foundation_health()` through a service-role operation.
3. Check due jobs and unretried dead letters without exposing either table to browser roles.
4. Correct the projection dependency, then call `retry_recommendation_projection_dead_letter` for explicitly reviewed rows.
5. Use the matching rollback capsule only when the affected migration must be disabled. Do not delete evidence or ordinary moderated content.

## Current evidence boundary

The implementation and executable test suites are committed. GitHub Actions currently creates an empty-name `startup_failure` before any job is allocated, so that run is not evidence that source, migrations or tests failed. Phase 2 must not begin until a clean Supabase reset, database lint and all three Phase 1 database suites execute successfully in an available runner or local Docker environment.

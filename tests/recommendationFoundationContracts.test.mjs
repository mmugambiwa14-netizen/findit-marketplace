import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  foundationMigration,
  projectionMigration,
  taxonomyMigration,
  hardeningMigration,
  correctionMigration,
  queueMigration,
  integrityMigration,
  eligibilityMigration,
  workerFunction,
  eventService,
  maintenanceWorker,
  sqlBoundary,
] = await Promise.all([
  read('../supabase/migrations/0050_recommendation_data_foundation.sql'),
  read('../supabase/migrations/0051_recommendation_projection_ingestion_and_retention.sql'),
  read('../supabase/migrations/0052_recommendation_taxonomy_weights_and_admin.sql'),
  read('../supabase/migrations/0053_recommendation_foundation_hardening.sql'),
  read('../supabase/migrations/0054_recommendation_foundation_certification_corrections.sql'),
  read('../supabase/migrations/0055_recommendation_projection_queue.sql'),
  read('../supabase/migrations/0056_recommendation_partition_and_configuration_integrity.sql'),
  read('../supabase/migrations/0057_recommendation_eligibility_geospatial_and_deletion_closure.sql'),
  read('../supabase/functions/recommendation-maintenance/index.ts'),
  read('../src/services/recommendationEvents.ts'),
  read('../supabase/functions/recommendation-maintenance/index.ts'),
  read('../scripts/verify-sql-boundary.mjs'),
]);

test('recommendation foundation stores privacy-limited events behind RLS and partitions', () => {
  assert.match(foundationMigration, /create table public\.recommendation_events/i);
  assert.match(foundationMigration, /partition by range \(occurred_at\)/i);
  assert.match(foundationMigration, /enable row level security/i);
  assert.match(foundationMigration, /force row level security/i);
  assert.match(foundationMigration, /anonymous_session_id uuid/i);
  assert.match(foundationMigration, /octet_length\(context::text\) <= 2048/i);
  assert.doesNotMatch(foundationMigration, /device_fingerprint|advertising_id|message_body/i);
});

test('listing recommendation projections and queues remain server-only and fail open', () => {
  assert.match(projectionMigration, /create table public\.listing_recommendation_features/i);
  assert.match(projectionMigration, /revoke all on public\.listing_recommendation_features from anon, authenticated/i);
  assert.match(queueMigration, /create table public\.recommendation_projection_jobs/i);
  assert.match(queueMigration, /process_listing_recommendation_projection_jobs/i);
  assert.match(queueMigration, /exception when others then/i);
  assert.match(queueMigration, /return new/i);
});

test('taxonomy, relationships and weights are deterministic and audited', () => {
  assert.match(taxonomyMigration, /create table public\.recommendation_taxonomy_nodes/i);
  assert.match(taxonomyMigration, /create table public\.recommendation_relationships/i);
  assert.match(taxonomyMigration, /create table public\.recommendation_weight_profiles/i);
  assert.match(taxonomyMigration, /recommendation_configuration_audit/i);
  assert.match(taxonomyMigration, /reason_code/i);
  assert.match(integrityMigration, /recommendation_relationships_active_identity/i);
  assert.match(integrityMigration, /recommendation_weight_profiles_one_active/i);
});

test('foundation hardening closes direct grants, function search paths and stale data', () => {
  assert.match(hardeningMigration, /alter table public\.recommendation_events force row level security/i);
  assert.match(hardeningMigration, /revoke all on function public\.record_recommendation_event/i);
  assert.match(hardeningMigration, /set search_path = ''/i);
  assert.match(correctionMigration, /purge_expired_recommendation_data/i);
  assert.match(eligibilityMigration, /eligible_listing_recommendation_features/i);
  assert.match(eligibilityMigration, /content_suspended_at is null/i);
});

test('maintenance worker uses independent authentication and bounded operations', () => {
  assert.match(workerFunction, /FINDIT_RECOMMENDATION_WORKER_SECRET/);
  assert.match(workerFunction, /constantTimeEqual/);
  assert.match(workerFunction, /process_listing_recommendation_projection_jobs/);
  assert.match(workerFunction, /ensure_recommendation_event_partition/);
  assert.match(workerFunction, /refresh_recommendation_popularity_daily/);
  assert.match(workerFunction, /purge_expired_recommendation_data/);
  assert.doesNotMatch(workerFunction, /throw new Error\([^)]*error\.message/);
});

test('client event delivery is best effort and never blocks listing rendering', () => {
  assert.match(eventService, /queueMicrotask/);
  assert.doesNotMatch(eventService, /console\./);
});

test('maintenance endpoint drains only bounded service-role queues and returns safe errors', () => {
  assert.match(maintenanceWorker, /FINDIT_RECOMMENDATION_WORKER_SECRET/);
  assert.match(maintenanceWorker, /constantTimeEqual/);
  assert.match(maintenanceWorker, /boundedInteger\(body\.projectionLimit, 200, 1, 500\)/);
  assert.match(maintenanceWorker, /boundedInteger\(body\.projectionMaxAttempts, 8, 1, 20\)/);
  assert.match(maintenanceWorker, /boundedInteger\(body\.retentionLimit, 5000, 1, 50_000\)/);
  assert.match(maintenanceWorker, /process_listing_recommendation_projection_jobs/);
  assert.match(maintenanceWorker, /ensure_recommendation_event_partition/);
  assert.match(maintenanceWorker, /refresh_recommendation_popularity_daily/);
  assert.match(maintenanceWorker, /purge_expired_recommendation_data/);
  assert.match(maintenanceWorker, /code: "recommendation_maintenance_unavailable"/);
  assert.match(maintenanceWorker, /message: "Recommendation maintenance is temporarily unavailable\."/);
});

test('every Phase 1 migration has a non-destructive rollback and the boundary is locked', async () => {
  const rollbackNames = {
    '0050': 'recommendation_data_foundation',
    '0051': 'recommendation_projection_ingestion_and_retention',
    '0052': 'recommendation_taxonomy_weights_and_admin',
    '0053': 'recommendation_foundation_hardening',
    '0054': 'recommendation_foundation_certification_corrections',
    '0055': 'recommendation_projection_queue',
    '0056': 'recommendation_partition_and_configuration_integrity',
    '0057': 'recommendation_eligibility_geospatial_and_deletion_closure',
  };

  for (const [number, name] of Object.entries(rollbackNames)) {
    const rollback = await read(`../supabase/rollback/${number}_${name}.rollback.sql`);
    assert.doesNotMatch(rollback, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
    assert.match(rollback, /revoke|force row level security/i);
  }
  assert.match(sqlBoundary, /0081_public_business_profile_view_security\.sql/);
});

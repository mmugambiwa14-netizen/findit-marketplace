import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [
  foundation,
  projection,
  administration,
  hardening,
  certification,
  projectionQueue,
  integrity,
  closure,
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
  read('../src/services/recommendationEventsService.js'),
  read('../supabase/functions/recommendation-maintenance/index.ts'),
  read('../scripts/verify-sql-boundary.mjs'),
]);

test('Phase 1 storage is normalized, partitioned and RLS protected', () => {
  for (const table of [
    'recommendation_taxonomy_nodes',
    'recommendation_relationships',
    'listing_recommendation_features',
    'recommendation_events',
    'recommendation_cache',
    'recommendation_popularity_daily',
  ]) {
    assert.match(foundation, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(foundation, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(foundation, /partition by range \(occurred_at\)/);
  assert.match(foundation, /No advertising identifier, fingerprint, message body or contact inference/i);
  assert.doesNotMatch(foundation, /grant\s+(?:insert|update|delete|all)[\s\S]{0,80}recommendation_events[\s\S]{0,40}to\s+(?:anon|authenticated)/i);
});

test('projection and event functions are bounded and independent', () => {
  assert.match(projection, /refresh_listing_recommendation_feature\(p_listing_id uuid\)/);
  assert.match(projection, /status not in \('available', 'under_offer'\)/);
  assert.match(projection, /content_suspended_at is not null/);
  assert.match(projection, /refresh_listing_recommendation_features_batch/);
  assert.match(projection, /ensure_recommendation_event_partition/);
  assert.match(projection, /purge_expired_recommendation_data/);
  assert.match(projection, /event context contains an unsupported field/);
});

test('configuration is versioned, organic and audited', () => {
  assert.match(administration, /recommendation_weight_profiles/);
  assert.match(administration, /recommendation_configuration_audit/);
  assert.match(administration, /recommendation weights must total one/);
  assert.match(administration, /admin_upsert_recommendation_taxonomy_node/);
  assert.match(administration, /admin_upsert_recommendation_relationship/);
  assert.match(administration, /admin_upsert_recommendation_weight_profile/);
  assert.equal((administration.match(/'organic-v1'/g) ?? []).length, 7);
  assert.match(administration, /Paid placement is not represented here/);
});

test('hardening closes identity, attribution and audit mutation paths', () => {
  assert.match(hardening, /recommendation_events_exactly_one_identity/);
  assert.match(hardening, /listing seller attribution does not match/);
  assert.match(hardening, /search events cannot include a listing or seller/);
  assert.match(hardening, /recommendation configuration audit history is immutable/);
  assert.match(hardening, /idx_recommendation_events_request_cursor/);
});

test('certification corrections avoid full projection rewrites', () => {
  assert.match(certification, /feature\.popularity_score is distinct from rolling_scores\.total_score/);
  assert.match(certification, /where feature\.popularity_score <> 0/);
  assert.match(certification, /has_more boolean/);
  assert.match(certification, /recommendation_foundation_health/);
  assert.doesNotMatch(certification, /update public\.listing_recommendation_features\s+set\s+popularity_score = 0\s*,\s*projected_at = now\(\)\s*;/);
});

test('listing writes enqueue asynchronously and fail open', () => {
  assert.match(projectionQueue, /create table if not exists public\.recommendation_projection_jobs/);
  assert.match(projectionQueue, /create table if not exists public\.recommendation_projection_dead_letters/);
  assert.match(projectionQueue, /exception when others then[\s\S]{0,160}null;/i);
  assert.match(projectionQueue, /for update skip locked/i);
  assert.match(projectionQueue, /p_limit not between 1 and 500/);
  assert.match(projectionQueue, /p_max_attempts not between 1 and 20/);
  assert.match(projectionQueue, /projection_failed/);
  assert.match(projectionQueue, /listing_write_dependency/);
  assert.match(projectionQueue, /"schema_version":55/);
  assert.doesNotMatch(projectionQueue, /sqlerrm|sqlstate|last_error_message/i);
  assert.doesNotMatch(projectionQueue, /grant execute on function public\.process_listing_recommendation_projection_jobs[\s\S]{0,80}to (?:anon|authenticated)/i);
});

test('partition and configuration integrity handles populated partitions and audited activation changes', () => {
  assert.match(integrity, /recommendation_events_partition_buffer/);
  assert.match(integrity, /lock table public\.recommendation_events_default in access exclusive mode/);
  assert.match(integrity, /taxonomy attributes contain an unsupported field/);
  assert.match(integrity, /taxonomy parent would create a cycle/);
  assert.match(integrity, /recommendation\.weights\.deactivate/);
  assert.match(integrity, /counts_are_estimates/);
  assert.match(integrity, /"schema_version":56/);
});

test('closure enforces active-seller eligibility, privacy-safe geography and deletion compatibility', () => {
  assert.match(closure, /public_location extensions\.geography\(point, 4326\)/);
  assert.match(closure, /using gist \(public_location\)/);
  assert.match(closure, /seller\.status = 'active'/);
  assert.match(closure, /trg_users_recommendation_eligibility/);
  assert.match(closure, /event subject is not publicly eligible/);
  assert.match(closure, /recommendation_events_actor_id_fkey[\s\S]{0,100}on delete cascade/);
  assert.match(closure, /recommendation_events_listing_id_fkey[\s\S]{0,100}on delete cascade/);
  assert.match(closure, /recommendation_events_seller_id_fkey[\s\S]{0,100}on delete cascade/);
  assert.match(closure, /Exact owner-supplied coordinates are never projected/);
  assert.match(closure, /'schema_version', 57/);
});

test('browser event delivery is session scoped and non-blocking', () => {
  assert.match(eventService, /readStoredString\('session'/);
  assert.match(eventService, /writeStoredString\('session'/);
  assert.doesNotMatch(eventService, /window\.sessionStorage|window\.localStorage|\blocalStorage\b/);
  assert.match(eventService, /Promise\.race/);
  assert.match(eventService, /REQUEST_TIMEOUT_MS = 1500/);
  assert.match(eventService, /catch \{\s*return \{ accepted: false, eventId: null \};\s*\}/);
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
  assert.match(sqlBoundary, /0066_recommendation_service_named_arguments\.sql/);
});

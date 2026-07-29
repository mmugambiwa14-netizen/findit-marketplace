import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [foundation, projection, administration, hardening, certification, eventService, sqlBoundary] = await Promise.all([
  read('../supabase/migrations/0050_recommendation_data_foundation.sql'),
  read('../supabase/migrations/0051_recommendation_projection_ingestion_and_retention.sql'),
  read('../supabase/migrations/0052_recommendation_taxonomy_weights_and_admin.sql'),
  read('../supabase/migrations/0053_recommendation_foundation_hardening.sql'),
  read('../supabase/migrations/0054_recommendation_foundation_certification_corrections.sql'),
  read('../src/services/recommendationEventsService.js'),
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

test('browser event delivery is session scoped and non-blocking', () => {
  assert.match(eventService, /window\.sessionStorage/);
  assert.doesNotMatch(eventService, /localStorage/);
  assert.match(eventService, /Promise\.race/);
  assert.match(eventService, /REQUEST_TIMEOUT_MS = 1500/);
  assert.match(eventService, /queueMicrotask/);
  assert.doesNotMatch(eventService, /console\./);
});

test('every Phase 1 migration has a non-destructive rollback and the boundary is locked', async () => {
  for (const number of ['0050', '0051', '0052', '0053', '0054']) {
    const rollback = await read(`../supabase/rollback/${number}_${{
      '0050': 'recommendation_data_foundation',
      '0051': 'recommendation_projection_ingestion_and_retention',
      '0052': 'recommendation_taxonomy_weights_and_admin',
      '0053': 'recommendation_foundation_hardening',
      '0054': 'recommendation_foundation_certification_corrections',
    }[number]}.rollback.sql`);
    assert.doesNotMatch(rollback, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
  }
  assert.match(sqlBoundary, /0054_recommendation_foundation_certification_corrections\.sql/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  foundation,
  projection,
  administration,
  hardening,
  projectionRollback,
  administrationRollback,
  hardeningRollback,
  eventService,
  sqlBoundary,
] = await Promise.all([
  readFile(new URL('../supabase/migrations/0050_recommendation_data_foundation.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/0051_recommendation_projection_ingestion_and_retention.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/0052_recommendation_taxonomy_weights_and_admin.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/0053_recommendation_foundation_hardening.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/rollback/0051_recommendation_projection_ingestion_and_retention.rollback.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/rollback/0052_recommendation_taxonomy_weights_and_admin.rollback.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/rollback/0053_recommendation_foundation_hardening.rollback.sql', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/recommendationEventsService.js', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-sql-boundary.mjs', import.meta.url), 'utf8'),
]);

const FOUNDATION_TABLES = [
  'recommendation_taxonomy_nodes',
  'recommendation_relationships',
  'listing_recommendation_features',
  'recommendation_events',
  'recommendation_cache',
  'recommendation_popularity_daily',
];

test('Phase 1 creates normalized, RLS-protected recommendation storage', () => {
  for (const table of FOUNDATION_TABLES) {
    assert.match(foundation, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(foundation, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(foundation, /partition by range \(occurred_at\)/);
  assert.match(foundation, /No advertising identifier, fingerprint, message body or contact inference/i);
  assert.doesNotMatch(foundation, /grant\s+(?:insert|update|delete|all)[\s\S]{0,80}recommendation_events[\s\S]{0,40}to\s+(?:anon|authenticated)/i);
});

test('projection and event ingestion are independent, bounded and cursor-ready', () => {
  assert.match(projection, /refresh_listing_recommendation_feature\(p_listing_id uuid\)/);
  assert.match(projection, /status not in \('available', 'under_offer'\)/);
  assert.match(projection, /content_suspended_at is not null/);
  assert.match(projection, /trg_listings_recommendation_projection/);
  assert.match(projection, /ensure_recommendation_event_partition/);
  assert.match(projection, /refresh_listing_recommendation_features_batch/);
  assert.match(projection, /purge_expired_recommendation_data/);
  assert.match(projection, /p_limit not between 1 and 2000/);
  assert.match(projection, /p_limit not between 1 and 50000/);
  assert.match(projection, /event context contains an unsupported field/);
});

test('admin configuration is audited and ranking weights are deterministic', () => {
  assert.match(administration, /create table if not exists public\.recommendation_weight_profiles/);
  assert.match(administration, /recommendation weights must total one/);
  assert.match(administration, /create table if not exists public\.recommendation_configuration_audit/);
  assert.match(administration, /admin_upsert_recommendation_taxonomy_node/);
  assert.match(administration, /admin_upsert_recommendation_relationship/);
  assert.match(administration, /admin_upsert_recommendation_weight_profile/);
  assert.match(administration, /public\.write_audit_log\('recommendation\.taxonomy\.upsert'/);
  assert.equal((administration.match(/'organic-v1'/g) ?? []).length, 7);
  assert.doesNotMatch(administration, /paid[_ -]?placement/i);
});

test('hardening prevents identity mixing, attribution spoofing and audit mutation', () => {
  assert.match(hardening, /recommendation_events_exactly_one_identity/);
  assert.match(hardening, /\(actor_id is null\) <> \(anonymous_session_id is null\)/);
  assert.match(hardening, /listing seller attribution does not match/);
  assert.match(hardening, /search events cannot include a listing or seller/);
  assert.match(hardening, /recommendation configuration audit history is immutable/);
  assert.match(hardening, /idx_recommendation_events_request_cursor/);
  assert.match(hardening, /idx_listing_recommendation_quality_popularity/);
});

test('browser event delivery is short-lived, session-scoped and never blocks customer actions', () => {
  assert.match(eventService, /window\.sessionStorage/);
  assert.doesNotMatch(eventService, /localStorage/);
  assert.match(eventService, /Promise\.race/);
  assert.match(eventService, /REQUEST_TIMEOUT_MS = 1500/);
  assert.match(eventService, /catch \{\s*return \{ accepted: false, eventId: null \};\s*\}/);
  assert.match(eventService, /queueMicrotask/);
  assert.doesNotMatch(eventService, /console\./);
  assert.doesNotMatch(eventService, /message|email|phone|address|fingerprint|advertising_id/);
});

test('rollback capsules preserve evidence and fail closed', () => {
  for (const rollback of [projectionRollback, administrationRollback, hardeningRollback]) {
    assert.doesNotMatch(rollback, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
    assert.match(rollback, /revoke|force row level security/i);
  }
});

test('SQL boundary is anchored to the complete Phase 1 migration set', () => {
  assert.match(sqlBoundary, /0053_recommendation_foundation_hardening\.sql/);
});

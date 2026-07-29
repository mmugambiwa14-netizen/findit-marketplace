import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  'supabase/migrations/0062_recommendation_service_operations_and_audit.sql',
  'utf8',
);
const rollback = await readFile(
  'supabase/rollback/0062_recommendation_service_operations_and_audit.rollback.sql',
  'utf8',
);
const auditCompatibility = await readFile(
  'supabase/migrations/0069_recommendation_audit_target_compatibility.sql',
  'utf8',
);
const workflow = await readFile('.github/workflows/migration-gates.yml', 'utf8');

const adminFunctions = [
  'admin_update_recommendation_service_policy_v1',
  'admin_purge_recommendation_service_cache_v1',
];

test('service operations use stable policy identities and durable audit evidence', () => {
  assert.match(migration, /add column if not exists id uuid default gen_random_uuid\(\)/);
  assert.match(migration, /create unique index if not exists idx_recommendation_service_policies_id/);
  assert.match(migration, /entity_type in \('taxonomy_node', 'relationship', 'weight_profile', 'service_policy'\)/);
  assert.match(migration, /'purge_cache'/);
  assert.doesNotMatch(migration, /select gen_random_uuid\(\), to_jsonb\(policy\)/);
});

test('all service mutations are admin guarded and runtime service role cannot mutate policy', () => {
  for (const functionName of adminFunctions) {
    const start = migration.indexOf(`function public.${functionName}`);
    assert.notEqual(start, -1, `${functionName} exists`);
    const body = migration.slice(start, start + 6000);
    assert.match(body, /if not public\.is_admin\(\) then/);
    assert.match(body, /admin access required/);
  }
  assert.match(migration, /grant execute on function public\.admin_update_recommendation_service_policy_v1[\s\S]*to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.admin_update_recommendation_service_policy_v1[\s\S]{0,120}to service_role/);
});

test('policy updates and cache purges are bounded', () => {
  assert.match(migration, /p_timeout_ms not between 50 and 5000/);
  assert.match(migration, /p_cache_fresh_seconds not between 0 and 3600/);
  assert.match(migration, /p_cache_stale_seconds not between 1 and 86400/);
  assert.match(migration, /p_maximum_page_size not between 1 and 100/);
  assert.match(migration, /p_limit not between 1 and 50000/);
  assert.match(migration, /for update skip locked/);
});

test('health contract contains operational counts but no customer data', () => {
  const healthFunction = migration.slice(
    migration.indexOf('create or replace function public.recommendation_services_health_v1()'),
    migration.indexOf('revoke all on function public.recommendation_services_health_v1()'),
  );

  assert.match(migration, /recommendation_services_health_v1/);
  assert.match(migration, /freshCacheEntries/);
  assert.match(migration, /staleCacheEntries/);
  assert.match(migration, /expiredCacheEntries/);
  assert.doesNotMatch(healthFunction, /actor_id|anonymous_session_id|email|phone|message_body/);
  assert.match(migration, /revoke all on function public\.recommendation_services_health_v1\(\)[\s\S]*from public, anon, authenticated/);
});

test('migration and rollback keep recommendation services disabled by default', () => {
  assert.match(migration, /'services_enabled', false/);
  assert.match(rollback, /set enabled = false/);
  assert.doesNotMatch(rollback, /drop\s+table|truncate|delete\s+from/i);
});

test('CI executes the service operations database suite', () => {
  assert.match(workflow, /v1_recommendation_service_operations\.sql/);
});

test('recommendation admin audit calls accept UUID entity identifiers', () => {
  assert.match(
    auditCompatibility,
    /function public\.write_audit_log\(\s*action_name text,\s*target_id uuid/,
  );
  assert.match(auditCompatibility, /target_id::text/);
  assert.match(
    auditCompatibility,
    /revoke all on function public\.write_audit_log\(text, uuid, text, jsonb, jsonb\)[\s\S]*from public, anon, service_role/,
  );
  assert.match(
    auditCompatibility,
    /grant execute on function public\.write_audit_log\(text, uuid, text, jsonb, jsonb\)[\s\S]*to authenticated/,
  );
});

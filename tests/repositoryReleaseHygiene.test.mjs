import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  packageJsonText,
  workflow,
  stagingWorkflow,
  migrationWorkflow,
  certification,
  hygiene,
  sqlBoundary,
  publicProfileMigration,
  publicProfileRollback,
  extensionMigration,
  extensionRollback,
  foreignKeyIndexMigration,
  foreignKeyIndexRollback,
  recommendationForeignKeyMigration,
  recommendationForeignKeyRollback,
  rlsAuthMigration,
  rlsAuthRollback,
  permissivePolicyMigration,
  permissivePolicyRollback,
  privateHelperMigration,
  privateHelperRollback,
] = await Promise.all([
  read('package.json'),
  read('.github/workflows/release-candidate-gates.yml'),
  read('.github/workflows/tours-staging-acceptance.yml'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/tours-release-certification.mjs'),
  read('scripts/verify-repository-hygiene.mjs'),
  read('scripts/verify-sql-boundary.mjs'),
  read('supabase/migrations/0081_public_business_profile_view_security.sql'),
  read('supabase/rollback/0081_public_business_profile_view_security.rollback.sql'),
  read('supabase/migrations/0082_pg_trgm_extension_schema_security.sql'),
  read('supabase/rollback/0082_pg_trgm_extension_schema_security.rollback.sql'),
  read('supabase/migrations/0083_foreign_key_covering_indexes.sql'),
  read('supabase/rollback/0083_foreign_key_covering_indexes.rollback.sql'),
  read('supabase/migrations/0084_recommendation_foreign_key_covering_indexes.sql'),
  read('supabase/rollback/0084_recommendation_foreign_key_covering_indexes.rollback.sql'),
  read('supabase/migrations/0085_rls_auth_initialization_plans.sql'),
  read('supabase/rollback/0085_rls_auth_initialization_plans.rollback.sql'),
  read('supabase/migrations/0086_rls_permissive_policy_consolidation.sql'),
  read('supabase/rollback/0086_rls_permissive_policy_consolidation.rollback.sql'),
  read('supabase/migrations/0087_private_policy_helper_boundary.sql'),
  read('supabase/rollback/0087_private_policy_helper_boundary.rollback.sql'),
]);

const packageJson = JSON.parse(packageJsonText);

test('release candidate exposes repository hygiene and SQL boundary gates', () => {
  assert.equal(packageJson.scripts['verify:hygiene'], 'node ./scripts/verify-repository-hygiene.mjs');
  assert.equal(packageJson.scripts['verify:sql-boundary'], 'node ./scripts/verify-sql-boundary.mjs');
  assert.match(workflow, /npm run verify:hygiene/);
  assert.match(workflow, /npm run verify:sql-boundary/);
  assert.match(stagingWorkflow, /npm run verify:hygiene/);
  assert.match(stagingWorkflow, /npm run verify:sql-boundary/);
  assert.match(certification, /Repository hygiene/);
  assert.match(certification, /SQL boundary/);
  assert.equal(packageJson.scripts['audit:product-surface'], 'node ./scripts/audit-product-surface.mjs');
  assert.match(workflow, /npm run audit:product-surface/);
  assert.match(stagingWorkflow, /npm run audit:product-surface/);
  assert.match(certification, /Product surface audit/);
});

test('hygiene gate checks pictographic symbols, merge markers and high-confidence secrets', () => {
  assert.match(hygiene, /prohibitedUnicodeRanges/);
  assert.match(hygiene, /unresolved merge-conflict marker/);
  assert.match(hygiene, /PRIVATE KEY/);
  assert.match(hygiene, /GitHub token/);
  assert.match(hygiene, /AWS access key/);
});

test('SQL gate requires a contiguous migration sequence and safe recent rollbacks', () => {
  assert.match(sqlBoundary, /migration sequence expected/);
  assert.match(sqlBoundary, /missing rollback pair/);
  assert.match(sqlBoundary, /unbalanced/);
  assert.match(sqlBoundary, /destructive table\/data rollback statements/);
  assert.match(sqlBoundary, /0087_private_policy_helper_boundary\.sql/);
});

test('public business profiles use an invoker view and a non-exposed least-column function', () => {
  assert.match(publicProfileMigration, /create schema if not exists private/i);
  assert.match(publicProfileMigration, /security definer/i);
  assert.match(publicProfileMigration, /set search_path = ''/i);
  assert.match(publicProfileMigration, /security_invoker = true/i);
  assert.match(publicProfileMigration, /security_barrier = true/i);
  assert.match(publicProfileMigration, /revoke all on table public\.business_profiles_public from public, anon, authenticated, service_role/i);
  assert.match(publicProfileMigration, /grant select on table public\.business_profiles_public to anon, authenticated, service_role/i);
  assert.doesNotMatch(publicProfileMigration, /registration_number|issuing_body|verification_status/);
  assert.match(publicProfileRollback, /security_invoker = false/i);
  assert.match(publicProfileRollback, /drop function if exists private\.public_business_profiles\(\)/i);
});

test('pg_trgm extension is relocated out of the public API schema with a reversible migration', () => {
  assert.match(extensionMigration, /alter extension pg_trgm set schema extensions/i);
  assert.match(extensionMigration, /create schema if not exists extensions/i);
  assert.match(extensionRollback, /alter extension pg_trgm set schema public/i);
  assert.doesNotMatch(extensionMigration, /drop extension/i);
  assert.doesNotMatch(extensionRollback, /drop extension/i);
});

test('advisor-reported foreign keys receive reversible covering indexes', () => {
  const createCount = (foreignKeyIndexMigration.match(/create index if not exists/gi) ?? []).length;
  const dropCount = (foreignKeyIndexRollback.match(/drop index if exists/gi) ?? []).length;
  assert.equal(createCount, 43);
  assert.equal(dropCount, createCount);
  for (const activeIndex of [
    'idx_fk_app_alerts_listing_id',
    'idx_fk_conversations_last_message_sender_id',
    'idx_fk_notification_fanout_listing_id',
    'idx_fk_inquiries_listing_id',
    'idx_fk_listing_media_owner_id',
    'idx_fk_listing_private_locations_owner_id',
    'idx_fk_listing_tour_events_actor_id',
    'idx_fk_listing_tour_slots_pending_tour_id',
    'idx_fk_reports_reporter_id',
    'idx_fk_service_media_owner_id',
    'idx_fk_services_location_id',
  ]) {
    assert.match(foreignKeyIndexMigration, new RegExp(activeIndex));
    assert.match(foreignKeyIndexRollback, new RegExp(activeIndex));
  }
  assert.doesNotMatch(foreignKeyIndexMigration, /drop index|delete from|truncate/i);
  assert.doesNotMatch(foreignKeyIndexRollback, /drop table|delete from|truncate/i);
});

test('recommendation foreign keys receive parent-aware reversible coverage', () => {
  const expectedIndexes = [
    'idx_fk_recommendation_cache_subject_listing_id',
    'idx_fk_recommendation_events_seller_id',
    'idx_fk_recommendation_service_policies_updated_by',
    'idx_fk_recommendation_weight_profiles_created_by',
  ];
  assert.equal(
    (recommendationForeignKeyMigration.match(/create index if not exists/gi) ?? []).length,
    expectedIndexes.length,
  );
  assert.equal(
    (recommendationForeignKeyRollback.match(/drop index if exists/gi) ?? []).length,
    expectedIndexes.length,
  );
  for (const indexName of expectedIndexes) {
    assert.match(recommendationForeignKeyMigration, new RegExp(indexName));
    assert.match(recommendationForeignKeyRollback, new RegExp(indexName));
  }
  assert.match(recommendationForeignKeyMigration, /on public\.recommendation_events \(seller_id\)/i);
  assert.doesNotMatch(recommendationForeignKeyMigration, /only public\.recommendation_events/i);
  assert.doesNotMatch(recommendationForeignKeyMigration, /drop index|delete from|truncate/i);
  assert.doesNotMatch(recommendationForeignKeyRollback, /drop table|delete from|truncate/i);
});

test('RLS auth initialization plans are fingerprinted, reversible and independently certified', () => {
  assert.match(rlsAuthMigration, /findit_rls_initplan_expected/);
  assert.match(rlsAuthMigration, /qual_md5 text not null/);
  assert.match(rlsAuthMigration, /with_check_md5 text not null/);
  assert.match(rlsAuthMigration, /md5\(coalesce\(policy\.qual, ''\)\)/);
  assert.match(rlsAuthMigration, /expected_count <> 36/);
  assert.match(rlsAuthMigration, /direct_policy_count <> 36/);
  assert.match(rlsAuthMigration, /unexpected_policy_count <> 0/);
  assert.match(rlsAuthMigration, /optimized_policy_count <> 36/);
  assert.match(rlsAuthMigration, /replace\(policy_row\.qual, 'auth\.uid\(\)', '\(select auth\.uid\(\)\)'\)/);
  assert.match(rlsAuthMigration, /alter policy %I on public\.%I/);
  assert.match(rlsAuthRollback, /expected_count <> 36/);
  assert.match(rlsAuthRollback, /optimized_policy_count <> 36/);
  assert.match(rlsAuthRollback, /regexp_replace/);
  assert.match(rlsAuthRollback, /'auth\.uid\(\)'/);
  assert.doesNotMatch(rlsAuthMigration, /drop policy|drop table|truncate|delete from/i);
  assert.doesNotMatch(rlsAuthRollback, /drop policy|drop table|truncate|delete from/i);
  assert.match(migrationWorkflow, /v1_rls_auth_initialization_plans\.sql/);
});

test('overlapping permissive policies are fingerprinted, split by action and reversible', () => {
  assert.match(permissivePolicyMigration, /findit_permissive_policy_expected/);
  assert.match(permissivePolicyMigration, /expected_count <> 18/);
  assert.match(permissivePolicyMigration, /md5\(coalesce\(policy\.qual, ''\)\)/);
  assert.match(permissivePolicyMigration, /drop policy announcements_admin_write/);
  assert.match(permissivePolicyMigration, /create policy announcements_admin_insert/);
  assert.match(permissivePolicyMigration, /create policy announcements_admin_update/);
  assert.match(permissivePolicyMigration, /create policy announcements_admin_delete/);
  assert.match(permissivePolicyMigration, /listing_private_locations_server_insert/);
  assert.match(permissivePolicyMigration, /users_update_own_or_admin/);
  assert.match(permissivePolicyMigration, /overlapping_count <> 0/);
  assert.match(permissivePolicyRollback, /expected_count <> 33/);
  assert.match(permissivePolicyRollback, /create policy announcements_admin_write/);
  assert.match(permissivePolicyRollback, /create policy users_admin_manage/);
  assert.match(permissivePolicyRollback, /create policy users_update_own_profile_fields/);
  assert.doesNotMatch(permissivePolicyMigration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(permissivePolicyRollback, /drop table|truncate|delete from/i);
  assert.match(migrationWorkflow, /v1_rls_permissive_policy_consolidation\.sql/);
});

test('policy-only definer helpers move behind a private reversible boundary', () => {
  const helperNames = [
    'can_read_listing_context',
    'has_active_tour_upload_intent',
    'has_valid_listing_upload_intent',
    'has_valid_marketplace_image_upload_intent',
    'is_attached_marketplace_image',
    'is_public_marketplace_image',
  ];

  assert.equal(
    (privateHelperMigration.match(/alter function public\.[^(]+\([^;]+set schema private;/gi) ?? []).length,
    6,
  );
  assert.match(privateHelperMigration, /findit_0087_expected_functions/);
  assert.match(privateHelperMigration, /findit_0087_expected_policies/);
  assert.match(privateHelperMigration, /caller_count <> 0/);
  assert.match(privateHelperMigration, /moved_count <> 6/);

  for (const helperName of helperNames) {
    assert.match(privateHelperMigration, new RegExp(`private\\.${helperName}`));
    assert.match(privateHelperRollback, new RegExp(`public\\.${helperName}`));
  }

  assert.match(privateHelperMigration, /alter policy listings_public_read_available/);
  assert.match(privateHelperMigration, /alter policy tour_source_authorized_insert/);
  assert.match(privateHelperMigration, /alter policy listing_image_validated_insert/);
  assert.match(privateHelperMigration, /alter policy marketplace_image_validated_insert/);
  assert.match(privateHelperMigration, /alter policy marketplace_image_owner_delete_unattached/);
  assert.match(privateHelperMigration, /alter policy marketplace_image_authorized_read/);
  assert.doesNotMatch(privateHelperMigration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(privateHelperRollback, /drop table|truncate|delete from/i);
  assert.match(migrationWorkflow, /v1_private_policy_helper_boundary\.sql/);
});

test('PR gates typecheck Supabase Edge Functions with Deno', () => {
  assert.equal(packageJson.scripts['typecheck:edge-functions'], 'node ./scripts/edge-functions-typecheck.mjs');
  assert.match(workflow, /denoland\/setup-deno@v2/);
  assert.match(workflow, /npm run typecheck:edge-functions/);
  assert.match(migrationWorkflow, /denoland\/setup-deno@v2/);
  assert.match(migrationWorkflow, /npm run typecheck:edge-functions/);
});

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
  assert.match(sqlBoundary, /0081_public_business_profile_view_security\.sql/);
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

test('PR gates typecheck Supabase Edge Functions with Deno', () => {
  assert.equal(packageJson.scripts['typecheck:edge-functions'], 'node ./scripts/edge-functions-typecheck.mjs');
  assert.match(workflow, /denoland\/setup-deno@v2/);
  assert.match(workflow, /npm run typecheck:edge-functions/);
  assert.match(migrationWorkflow, /denoland\/setup-deno@v2/);
  assert.match(migrationWorkflow, /npm run typecheck:edge-functions/);
});

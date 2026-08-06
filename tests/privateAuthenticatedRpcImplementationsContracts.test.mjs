import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [migration, rollback, databaseTest, sqlBoundary, migrationWorkflow, recommendationWorkflow] = await Promise.all([
  readFile(new URL('../supabase/migrations/0101_private_authenticated_rpc_implementations.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/rollback/0101_private_authenticated_rpc_implementations.rollback.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/tests/v1_private_authenticated_rpc_implementations.sql', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-sql-boundary.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/migration-gates.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/recommendation-database-gates.yml', import.meta.url), 'utf8'),
]);

test('0101 fingerprints the exact 57-function authenticated privileged catalog', () => {
  assert.match(migration, /row_count <> 57/);
  assert.match(migration, /distinct_name_count <> 57/);
  assert.match(migration, /ce6194659e01b758dc20948daf351bea/);
  assert.match(migration, /self_reference/);
  assert.match(migration, /language_name not in \('sql', 'plpgsql'\)/);
  assert.match(migration, /anon_execute/);
});

test('0101 preserves complete public RPC compatibility through invoker wrappers', () => {
  assert.match(migration, /pg_get_function_arguments/);
  assert.match(migration, /pg_get_function_result/);
  assert.match(migration, /pronargdefaults/);
  assert.match(migration, /provolatile/);
  assert.match(migration, /proisstrict/);
  assert.match(migration, /proparallel/);
  assert.match(migration, /procost/);
  assert.match(migration, /prorows/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /set search_path = ''''/);
  assert.match(migration, /select \* from private\.%I/);
  assert.match(migration, /select private\.%I/);
  assert.match(migration, /findit:0101-authenticated-boundary/);
});

test('0101 preserves grants and removes all public privileged execution', () => {
  assert.match(migration, /authenticated_execute/);
  assert.match(migration, /service_execute/);
  assert.match(migration, /revoke all on function public\.%I/);
  assert.match(migration, /left an authenticated public SECURITY DEFINER function/);
  assert.match(migration, /did not preserve the target execution-grant matrix/);
  assert.match(migration, /left PUBLIC execute on a compatibility wrapper/);
});

test('0101 rollback restores the exact original catalog fingerprint', () => {
  assert.match(rollback, /drop function public\.%I/);
  assert.match(rollback, /alter function %s set schema public/);
  assert.match(rollback, /ce6194659e01b758dc20948daf351bea/);
  assert.match(rollback, /did not restore the exact public catalog/);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('database certification covers the full wrapper and grant matrix', () => {
  assert.match(databaseTest, /57 original public compatibility wrappers/);
  assert.match(databaseTest, /53-function matrix/);
  assert.match(databaseTest, /four authenticated-only recommendation admin RPCs/);
  assert.match(databaseTest, /owner_listing_notes/);
  assert.match(databaseTest, /message_inbox_page/);
  assert.match(databaseTest, /notification_rows_page/);
  assert.match(databaseTest, /create_v1_listing_submission/);
  assert.match(databaseTest, /admin_user_rows_page/);
});

test('both clean database workflows certify the 0101 boundary', () => {
  assert.match(sqlBoundary, /0101_private_authenticated_rpc_implementations\.sql/);
  assert.match(migrationWorkflow, /v1_private_authenticated_rpc_implementations\.sql/);
  assert.match(recommendationWorkflow, /v1_private_authenticated_rpc_implementations\.sql/);
});

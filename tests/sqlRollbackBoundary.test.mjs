import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createdTablesIn,
  hasDestructiveRollbackStatements,
} from '../scripts/lib/sqlRollbackBoundary.mjs';

/**
 * SQL rollback boundary (F-013).
 *
 * The gate rejects destructive statements in rollback capsules because a
 * rollback that drops production data is worse than the migration it reverses.
 * The exception it was missing is the one case where a drop is exactly correct:
 * a rollback removing a table that its own paired migration created.
 *
 * The risk in adding that exception is over-permission, so the tests below
 * spend most of their effort proving the exemption stays narrow rather than
 * proving the happy path works.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIGRATION_CREATING_ONE_TABLE = `
begin;
create table if not exists public.peek_request_fulfilments (
  id uuid primary key
);
commit;
`;

test('a rollback dropping a table its paired migration created is permitted', () => {
  const rollback = 'drop table if exists public.peek_request_fulfilments;';
  assert.equal(
    hasDestructiveRollbackStatements(rollback, MIGRATION_CREATING_ONE_TABLE),
    false,
  );
});

test('a rollback dropping a table its paired migration did NOT create is rejected', () => {
  // The whole point of the exemption is that it is scoped to the pair. Dropping
  // someone else's table is the case the gate exists to catch.
  const rollback = 'drop table if exists public.listings;';
  assert.equal(
    hasDestructiveRollbackStatements(rollback, MIGRATION_CREATING_ONE_TABLE),
    true,
  );
});

test('truncate is still rejected even for a table the paired migration created', () => {
  const rollback = 'truncate public.peek_request_fulfilments;';
  assert.equal(
    hasDestructiveRollbackStatements(rollback, MIGRATION_CREATING_ONE_TABLE),
    true,
  );
});

test('delete from is still rejected even for a table the paired migration created', () => {
  const rollback = 'delete from public.peek_request_fulfilments where true;';
  assert.equal(
    hasDestructiveRollbackStatements(rollback, MIGRATION_CREATING_ONE_TABLE),
    true,
  );
});

test('a missing paired migration grants no exemption', () => {
  // Fail closed: if we cannot prove the migration created the table, the drop
  // is treated as destructive.
  const rollback = 'drop table if exists public.peek_request_fulfilments;';
  assert.equal(hasDestructiveRollbackStatements(rollback, null), true);
  assert.equal(hasDestructiveRollbackStatements(rollback, ''), true);
});

test('a create table named only inside a migration comment grants no exemption', () => {
  const migration = `
    -- create table public.peek_request_fulfilments (id uuid);
    /* create table public.peek_request_fulfilments (id uuid); */
    select 1;
  `;
  const rollback = 'drop table if exists public.peek_request_fulfilments;';
  assert.equal(hasDestructiveRollbackStatements(rollback, migration), true);
});

test('a multi-table drop is not exempted even when every table is paired', () => {
  // Parsing a table list correctly is not worth the risk here, so the narrow
  // single-target form is the only shape that earns the exemption.
  const migration = `
    create table public.a (id uuid);
    create table public.b (id uuid);
  `;
  assert.equal(
    hasDestructiveRollbackStatements('drop table public.a, public.b;', migration),
    true,
  );
});

test('existing exclusions still hold: comments, quoted literals, publication membership', () => {
  const migration = 'select 1;';

  // Regression guards for behaviour the gate already had before the exemption
  // was introduced. Each of these previously caused a false rejection.
  assert.equal(
    hasDestructiveRollbackStatements('-- this rollback avoids drop table and truncate', migration),
    false,
  );
  assert.equal(
    hasDestructiveRollbackStatements(
      "select has_table_privilege('public.listings', 'TRUNCATE');",
      migration,
    ),
    false,
  );
  assert.equal(
    hasDestructiveRollbackStatements(
      'alter publication supabase_realtime drop table public.messages;',
      migration,
    ),
    false,
  );
});

test('quoted identifiers are matched with PostgreSQL case semantics', () => {
  // Unquoted identifiers fold to lower case; quoted ones do not. Conflating the
  // two would let a rollback drop "Listings" on the strength of a migration
  // that created listings.
  const migration = 'create table public."MixedCase" (id uuid);';
  assert.equal(
    hasDestructiveRollbackStatements('drop table public."MixedCase";', migration),
    false,
  );
  assert.equal(
    hasDestructiveRollbackStatements('drop table public.mixedcase;', migration),
    true,
  );
});

test('createdTablesIn reports the qualified names a migration creates', () => {
  const tables = createdTablesIn(`
    create table if not exists public.alpha (id uuid);
    create table beta (id uuid);
  `);
  assert.ok(tables.has('public.alpha'));
  assert.ok(tables.has('beta'));
  assert.equal(tables.size, 2);
});

test('the Peek fulfilment pair that broke the release gate is accepted', () => {
  // The concrete case from F-013: this rollback is the correct reversal of its
  // migration, and rejecting it skipped twelve later CI steps.
  const stem = '20260807020000_peek_request_fulfilment_lifecycle';
  const rollback = readFileSync(
    join(projectRoot, 'supabase/rollback', `${stem}.rollback.sql`),
    'utf8',
  );
  const migration = readFileSync(
    join(projectRoot, 'supabase/migrations', `${stem}.sql`),
    'utf8',
  );
  assert.match(migration, /create table if not exists public\.peek_request_fulfilments/i);
  assert.match(rollback, /drop table if exists public\.peek_request_fulfilments/i);
  assert.equal(hasDestructiveRollbackStatements(rollback, migration), false);
});

test('the repository passes its own SQL boundary gate', () => {
  // The end-to-end assertion. Before F-013 was fixed this exited 1, and every
  // later step in the release workflow reported conclusion=skipped.
  const output = execFileSync(
    process.execPath,
    ['./scripts/verify-sql-boundary.mjs'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  assert.match(output, /SQL boundary verification passed/);
});

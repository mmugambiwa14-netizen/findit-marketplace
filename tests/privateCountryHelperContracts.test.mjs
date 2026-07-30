import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary] = await Promise.all([
  read('supabase/migrations/0089_private_country_helper_implementations.sql'),
  read('supabase/rollback/0089_private_country_helper_implementations.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
]);

test('country capability definers move behind private implementations and invoker wrappers', () => {
  const helpers = [
    ['is_country_browsable', 'text'],
    ['is_country_publishable', 'text'],
    ['is_supported_listing_currency', 'text, text'],
  ];

  for (const [name, args] of helpers) {
    const escapedArgs = args.replace(/ /g, '\\s*');
    assert.match(migration, new RegExp(`alter function public\\.${name}\\(${escapedArgs}\\) set schema private`));
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`select private\\.${name}\\(`));
    assert.match(rollback, new RegExp(`alter function private\\.${name}\\(${escapedArgs}\\) set schema public`));
  }

  assert.match(migration, /security invoker/);
  assert.match(migration, /function_record\.proconfig = array\['search_path=""'\]::text\[\]/);
  assert.match(migration, /left a PUBLIC execute grant on a country helper/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('country helper fingerprints and four stored call paths are fail-closed', () => {
  assert.match(migration, /c1ac4e343111eb3da49b465a2488a0c1/);
  assert.match(migration, /de306cd698ba706e93046b1186c55fcd/);
  assert.match(migration, /84f3038efb0ddac01eb0171a3ab2d824/);
  assert.match(migration, /expected exactly one country browsing caller/);
  assert.match(migration, /expected exactly two country publishing callers/);
  assert.match(migration, /expected exactly one listing currency caller/);
  assert.match(migration, /preserved only % of four public country helper call paths/);
  assert.match(rollback, /restored only % of four public country helper call paths/);
});

test('migration gates run the independent country helper matrix and boundary tip is locked', () => {
  assert.match(workflow, /v1_private_country_helper_implementations\.sql/);
  assert.match(sqlBoundary, /0089_private_country_helper_implementations\.sql/);
});

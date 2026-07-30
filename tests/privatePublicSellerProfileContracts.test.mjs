import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary] = await Promise.all([
  read('supabase/migrations/0090_private_public_seller_profile_implementation.sql'),
  read('supabase/rollback/0090_private_public_seller_profile_implementation.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
]);

test('public seller profile definer moves behind a private implementation and invoker wrapper', () => {
  assert.match(migration, /alter function public\.get_public_seller_profile\(text\) set schema private/);
  assert.match(migration, /create function public\.get_public_seller_profile\(seller_email text\)/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /select private\.get_public_seller_profile\(seller_email\)/);
  assert.match(migration, /left a PUBLIC execute grant on a seller-profile function/);
  assert.match(rollback, /alter function private\.get_public_seller_profile\(text\) set schema public/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('seller profile migration fails closed on the canonical implementation and caller boundary', () => {
  assert.match(migration, /082229bceba5a21b0ea13b80a41c7a7c/);
  assert.match(migration, /seller_email text/);
  assert.match(migration, /expected exactly one public seller-profile fingerprint/);
  assert.match(migration, /stored seller-profile callers exist/);
  assert.match(migration, /did not preserve required seller-profile execution grants/);
  assert.match(rollback, /did not restore the canonical public seller-profile implementation/);
});

test('migration gates run the seller profile matrix and SQL boundary is advanced to 0090', () => {
  assert.match(workflow, /v1_private_public_seller_profile_implementation\.sql/);
  assert.match(sqlBoundary, /0090_private_public_seller_profile_implementation\.sql/);
});

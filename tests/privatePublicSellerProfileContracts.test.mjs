import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, repository] = await Promise.all([
  read('supabase/migrations/0090_seller_profile_identifier_privacy.sql'),
  read('supabase/rollback/0090_seller_profile_identifier_privacy.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/repositories/sellerProfilesRepository.js'),
]);

test('public seller profiles use opaque UUIDs behind a private definer and public invoker wrapper', () => {
  assert.match(migration, /create function private\.get_public_seller_profile\(p_seller_id uuid\)/);
  assert.match(migration, /create function public\.get_public_seller_profile\(p_seller_id uuid\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /select private\.get_public_seller_profile\(p_seller_id\)/);
  assert.match(migration, /drop function public\.get_public_seller_profile\(text\)/);
  assert.match(migration, /seller\.id = p_seller_id/);
  assert.match(migration, /seller\.status = 'active'/);
  assert.match(migration, /listing\.status in \('available', 'under_offer'\)/);
  assert.match(migration, /listing\.content_suspended_at is null/);
  assert.match(migration, /private\.is_country_browsable/);
  assert.match(migration, /position\('seller\.email' in function_record\.prosrc\) = 0/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('seller profile privacy migration fails closed and rollback restores the exact legacy identity', () => {
  assert.match(migration, /082229bceba5a21b0ea13b80a41c7a7c/);
  assert.match(migration, /legacy seller profile function has a policy dependency/);
  assert.match(migration, /legacy seller profile function has a stored caller/);
  assert.match(migration, /UUID seller profile boundary already exists/);
  assert.match(migration, /left % legacy email seller profile functions/);
  assert.match(migration, /left a PUBLIC execute grant on the seller profile boundary/);
  assert.match(rollback, /create function public\.get_public_seller_profile\(seller_email text\)/);
  assert.match(rollback, /0090 rollback did not restore the legacy seller profile function/);
});

test('the active client calls the UUID RPC and never sends an email identifier', () => {
  assert.match(repository, /findPublicSellerProfile\(sellerId\)/);
  assert.match(repository, /\.rpc\('get_public_seller_profile', \{ p_seller_id: sellerId \}\)/);
  assert.doesNotMatch(repository, /seller_email/);
});

test('migration gates run the seller profile matrix and SQL boundary is advanced to the privacy migration', () => {
  assert.match(workflow, /v1_private_public_seller_profile_implementation\.sql/);
  assert.match(sqlBoundary, /0090_seller_profile_identifier_privacy\.sql/);
});

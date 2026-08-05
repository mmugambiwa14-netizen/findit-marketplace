import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  workflow,
  sqlBoundary,
  repository,
  service,
  contracts,
  app,
  sellerPage,
  sellerComponent,
  propertyDetail,
  carDetail,
  machineryDetail,
  serviceDetail,
] = await Promise.all([
  read('supabase/migrations/0090_seller_profile_identifier_privacy.sql'),
  read('supabase/rollback/0090_seller_profile_identifier_privacy.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/repositories/sellerProfilesRepository.js'),
  read('src/services/sellerProfilesService.js'),
  read('src/services/sellerProfileContracts.js'),
  read('src/App.jsx'),
  read('src/pages/SellerProfile.jsx'),
  read('src/components/listings/ListingDetailTabs.jsx'),
  read('src/pages/PropertyDetail.jsx'),
  read('src/pages/CarDetail.jsx'),
  read('src/pages/MachineryDetail.jsx'),
  read('src/pages/ServiceDetail.jsx'),
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

test('the active data path calls the UUID RPC and validates opaque identifiers', () => {
  assert.match(repository, /findPublicSellerProfile\(sellerId\)/);
  assert.match(repository, /\.rpc\('get_public_seller_profile', \{ p_seller_id: sellerId \}\)/);
  assert.doesNotMatch(repository, /seller_email/);
  assert.match(service, /normalizeSellerProfileId\(sellerId\)/);
  assert.doesNotMatch(service, /normalizeSellerProfileEmail|sellerEmail/);
  assert.match(contracts, /isSellerProfileId/);
  assert.match(contracts, /normalizeSellerProfileId/);
  assert.doesNotMatch(contracts, /Seller email|normalizeSellerProfileEmail/);
});

test('the routed seller surface never embeds or resolves account emails', () => {
  assert.match(app, /path="\/seller\/:sellerId"/);
  assert.doesNotMatch(app, /path="\/seller\/:email"/);
  assert.match(sellerPage, /const \{ sellerId = "" \} = useParams\(\)/);
  assert.match(sellerPage, /isSellerProfileId\(sellerId\)/);
  assert.match(sellerPage, /enabled: validSellerId/);
  assert.doesNotMatch(sellerPage, /normalizeSellerProfileEmail|seller_email|\{ email =/);
  assert.match(sellerComponent, /export function ListingSeller/);
  assert.match(sellerComponent, /`\/seller\/\$\{encodeURIComponent\(sellerId\)\}`/);
  assert.doesNotMatch(sellerComponent, /encodeURIComponent\(email\)|\{ name, email \}/);

  for (const detail of [propertyDetail, carDetail, machineryDetail, serviceDetail]) {
    assert.match(detail, /<ListingSeller\b/);
    assert.match(detail, /sellerId=\{/);
    assert.doesNotMatch(detail, /<ListingSeller[^>]+email=/);
  }
});

test('migration gates run the seller profile matrix and SQL boundary is advanced to the privacy migration', () => {
  assert.match(workflow, /v1_private_public_seller_profile_implementation\.sql/);
  assert.match(sqlBoundary, /0090_seller_profile_identifier_privacy\.sql/);
});

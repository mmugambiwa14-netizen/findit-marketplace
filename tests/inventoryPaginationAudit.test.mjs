import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createKeysetPage,
  normalizeKeysetCursor,
  normalizePageLimit,
} from '../src/services/keysetPagination.js';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const [
  servicesPage,
  savedPage,
  sellerPage,
  myListingsPage,
  myServicesPage,
  businessPage,
  serviceRepository,
  favouriteRepository,
  ownerRepository,
  listingRepository,
  businessRepository,
  migration,
  rollback,
] = await Promise.all([
  read('src/pages/Services.jsx'),
  read('src/pages/Saved.jsx'),
  read('src/pages/SellerProfile.jsx'),
  read('src/pages/MyListings.jsx'),
  read('src/pages/MyServices.jsx'),
  read('src/pages/PublicBusinessProfile.jsx'),
  read('src/repositories/servicesRepository.js'),
  read('src/repositories/favouritesRepository.js'),
  read('src/repositories/ownerListingsRepository.js'),
  read('src/repositories/publicListingsRepository.js'),
  read('src/repositories/businessProfilesRepository.js'),
  read('supabase/migrations/0043_v1_inventory_pagination_and_audit_hardening.sql'),
  read('supabase/rollback/0043_v1_inventory_pagination_and_audit_hardening.rollback.sql'),
]);

test('keyset cursors are opaque, bounded and deterministic', () => {
  assert.equal(normalizePageLimit(999, { fallback: 24, maximum: 48 }), 48);
  assert.equal(normalizePageLimit('bad', { fallback: 24, maximum: 48 }), 24);
  assert.deepEqual(normalizeKeysetCursor({
    createdAt: '2026-07-27T01:02:03Z',
    id: '11111111-1111-4111-8111-111111111111',
  }), {
    createdAt: '2026-07-27T01:02:03.000Z',
    id: '11111111-1111-4111-8111-111111111111',
  });
  assert.throws(() => normalizeKeysetCursor({ createdAt: 'bad', id: 'bad' }), /invalid/);
});

test('page construction returns exactly one stable continuation cursor', () => {
  const rows = [
    { id: '11111111-1111-4111-8111-111111111111', created_at: '2026-07-27T03:00:00Z' },
    { id: '22222222-2222-4222-8222-222222222222', created_at: '2026-07-27T02:00:00Z' },
    { id: '33333333-3333-4333-8333-333333333333', created_at: '2026-07-27T01:00:00Z' },
  ];
  assert.deepEqual(createKeysetPage(rows, 2), {
    items: rows.slice(0, 2),
    nextCursor: {
      createdAt: '2026-07-27T02:00:00Z',
      id: '22222222-2222-4222-8222-222222222222',
    },
  });
  assert.deepEqual(createKeysetPage(rows.slice(0, 2), 2).nextCursor, null);
});

test('every previously capped inventory page uses visible keyset continuation', () => {
  for (const [name, source] of Object.entries({
    Services: servicesPage,
    Saved: savedPage,
    SellerProfile: sellerPage,
    MyListings: myListingsPage,
    MyServices: myServicesPage,
    PublicBusinessProfile: businessPage,
  })) {
    assert.match(source, /useInfiniteQuery/, `${name} does not use an infinite keyset query`);
    assert.match(source, /getNextPageParam/, `${name} does not expose a continuation cursor`);
    assert.match(source, /fetchNextPage/, `${name} cannot load the next page`);
    assert.match(source, /Load more/i, `${name} hides additional records`);
  }
});

test('repositories apply descending cursor predicates and fetch one lookahead row', () => {
  for (const [name, source] of Object.entries({
    services: serviceRepository,
    favourites: favouriteRepository,
    ownerListings: ownerRepository,
    sellerListings: listingRepository,
    business: businessRepository,
  })) {
    assert.match(source, /applyDescendingCreatedAtCursor/, `${name} has no cursor predicate`);
    assert.match(source, /\.limit\(request\.limit \+ 1\)/, `${name} has no bounded lookahead`);
    assert.match(source, /order\('created_at', \{ ascending: false \}\)/, `${name} is not deterministically ordered`);
    assert.match(source, /order\('id', \{ ascending: false \}\)/, `${name} lacks an ID tiebreaker`);
  }
});

test('pagination indexes and rollback cover every high-volume inventory owner', () => {
  for (const index of [
    'idx_services_public_keyset',
    'idx_services_provider_keyset',
    'idx_saved_listings_user_keyset',
    'idx_listings_seller_keyset',
  ]) {
    assert.match(migration, new RegExp(index));
    assert.match(rollback, new RegExp(index));
  }
  assert.doesNotMatch(migration, /drop table|delete from|truncate/i);
});

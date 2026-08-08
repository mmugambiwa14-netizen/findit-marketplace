import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(url, 'The search-scale smoke test');
if (!anonKey || !secretKey) throw new Error('A Supabase publishable key and secret key are required.');

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const root = createClient(url, secretKey, options);
const publicClient = createClient(url, anonKey, options);
const stamp = Date.now();
const marker = `finditscale${stamp}`;
const email = `${marker}@example.test`;
const password = `FindIt!Scale${stamp}`;
const pageSize = 24;
const fixtureCount = Number(process.env.FINDIT_SEARCH_SCALE_FIXTURE_COUNT ?? 130);
let ownerId;

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function searchPage({ sort = 'newest', cursor = null, currency = '', minPrice = null, maxPrice = null, minBedrooms = null } = {}) {
  return success(await publicClient.rpc('public_listing_search_card_page_v1', {
    p_kind: 'property',
    p_country_code: 'ZW',
    p_currency: currency,
    p_query: marker,
    p_category: '',
    p_location_id: '',
    p_min_price: minPrice,
    p_max_price: maxPrice,
    p_min_bedrooms: minBedrooms,
    p_brand: '',
    p_condition: '',
    p_fuel_type: '',
    p_transmission: '',
    p_sort: sort,
    p_cursor_value: cursor?.value ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: pageSize,
  }), `public listing ${sort} card keyset page`);
}

async function traverse(options = {}) {
  const seen = new Set();
  const rows = [];
  let cursor = null;
  for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
    const result = await searchPage({ ...options, cursor });
    assert.ok(result.length <= pageSize + 1, 'database returns at most limit+1 rows');
    const page = result.slice(0, pageSize);
    for (const row of page) {
      assert.equal(seen.has(row.id), false, `keyset page ${pageNumber} must not repeat ${row.id}`);
      assert.equal(Object.hasOwn(row, 'description'), false, 'card search rows must not carry listing descriptions');
      assert.ok(Array.isArray(row.photos) && row.photos.length <= 1, 'card search rows carry at most one cover image');
      seen.add(row.id);
      rows.push(row);
    }
    if (result.length <= pageSize) return rows;
    const last = page.at(-1);
    cursor = { value: last.cursor_value, id: last.id };
  }
  throw new Error('Search keyset traversal exceeded the bounded smoke page limit.');
}

try {
  if (!Number.isInteger(fixtureCount) || fixtureCount < 100 || fixtureCount > 1000) {
    throw new Error('FINDIT_SEARCH_SCALE_FIXTURE_COUNT must be an integer from 100 to 1000.');
  }

  ownerId = success(await root.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Search Scale Smoke' },
  }), 'create search-scale owner').user.id;

  const baseTime = Date.UTC(2026, 0, 1);
  const listingRows = Array.from({ length: fixtureCount }, (_, index) => ({
    kind: 'property',
    seller_id: ownerId,
    seller_name: 'Search Scale Smoke',
    contact_email: email,
    title: `${marker} ${String(index).padStart(4, '0')}`,
    description: 'Disposable keyset search pagination fixture',
    price: 100000 + index,
    currency: 'USD',
    native_price: 100000 + index,
    native_currency: 'USD',
    country_code: 'ZW',
    category: index % 2 === 0 ? 'houses-for-sale' : 'apartments-for-sale',
    status: 'available',
    photos: [],
    views: index,
    created_at: new Date(baseTime + index * 1000).toISOString(),
  }));
  const inserted = success(await root.from('listings').insert(listingRows).select('id,title'), 'insert searchable listings');
  assert.equal(inserted.length, fixtureCount);

  const indexByTitle = new Map(inserted.map((row) => [row.title, Number(row.title.slice(-4))]));
  success(await root.from('property_details').insert(inserted.map((row) => {
    const index = indexByTitle.get(row.title);
    return {
      listing_id: row.id,
      property_type: index % 2 === 0 ? 'house' : 'apartment',
      bedrooms: index % 2 === 0 ? 4 : 2,
      bathrooms: 2,
    };
  })), 'insert property details');

  const newest = await traverse({ sort: 'newest' });
  assert.equal(newest.length, fixtureCount, 'newest keyset traversal reaches the complete fixture set');
  assert.deepEqual(
    newest.map((row) => Number(row.title.slice(-4))),
    Array.from({ length: fixtureCount }, (_, index) => fixtureCount - index - 1),
    'newest traversal is deterministic beyond the first 100 rows',
  );

  const priceAscending = await traverse({ sort: 'price_asc', currency: 'USD' });
  assert.equal(priceAscending.length, fixtureCount);
  assert.deepEqual(
    priceAscending.map((row) => Number(row.price)),
    Array.from({ length: fixtureCount }, (_, index) => 100000 + index),
    'ascending-price keysets preserve deterministic seller-native USD price and id ordering',
  );

  const bedroomFiltered = await traverse({ sort: 'newest', minBedrooms: 4 });
  assert.equal(bedroomFiltered.length, Math.ceil(fixtureCount / 2));
  assert.equal(bedroomFiltered.every((row) => Number(row.property_details?.bedrooms) >= 4), true);

  const priceFiltered = await traverse({ sort: 'price_desc', currency: 'USD', minPrice: 100050, maxPrice: 100059 });
  assert.deepEqual(priceFiltered.map((row) => Number(row.price)), [100059, 100058, 100057, 100056, 100055, 100054, 100053, 100052, 100051, 100050]);

  const rejectedCrossCurrencySort = await publicClient.rpc('public_listing_search_card_page_v1', {
    p_kind: 'property',
    p_country_code: 'ZW',
    p_currency: '',
    p_query: marker,
    p_sort: 'price_asc',
    p_limit: pageSize,
  });
  assert.match(rejectedCrossCurrencySort.error?.message || '', /invalid public listing card search page/i, 'price sorting without a currency must be rejected by the database');

  console.log(`Phase 7 ${smokeTarget.label} search-scale smoke passed.`);
  console.log(`Verified ${fixtureCount}-row thin-card keyset traversal, no duplicates/skips, one-cover payloads, seller-native USD price boundaries, all-currency browse, and no exact counts or offsets.`);
} finally {
  if (ownerId) {
    try { await root.from('listings').delete().eq('seller_id', ownerId).ilike('title', `${marker}%`); } catch { /* best effort */ }
    try { await root.auth.admin.deleteUser(ownerId); } catch { /* best effort */ }
  }
}

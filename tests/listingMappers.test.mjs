import assert from 'node:assert/strict';
import test from 'node:test';

import { mapPublicListing } from '../src/services/listingMappers.js';
import { normalizePublicSearchCursor, normalizePublicSearchPageRequest, normalizePublicSearchRequest } from '../src/services/searchContracts.js';

const sharedRow = {
  id: '9d720010-5d89-4cdc-a5b6-18dcd5034eb0',
  seller_id: '58ecb8bf-75e3-4837-90b7-f5764be4e6cc',
  seller_name: 'Munashe',
  contact_email: 'seller@example.com',
  title: 'Marketplace listing',
  price: 12500,
  accepts_offers: true,
  latitude: -17.8252,
  longitude: 31.0335,
  created_at: '2026-07-17T09:00:00Z',
  updated_at: '2026-07-17T10:00:00Z',
  location: { id: 'location-id', name: 'Harare', type: 'city' },
};

test('maps a normalized property to the existing card contract', () => {
  const listing = mapPublicListing({
    ...sharedRow,
    kind: 'property',
    property_details: [{ property_type: 'house', bedrooms: 3, bathrooms: 2 }],
  });

  assert.equal(listing.location_id, 'Harare');
  assert.equal(listing.location_ref_id, 'location-id');
  assert.equal(listing.city, 'Harare');
  assert.equal(listing.created_date, sharedRow.created_at);
  assert.equal(listing.negotiable, true);
  assert.equal(listing.bedrooms, 3);
  assert.deepEqual(listing.coordinates, { latitude: -17.8252, longitude: 31.0335 });
  assert.equal(listing.verified, false);
});

test('maps car brand to the legacy make field', () => {
  const listing = mapPublicListing({
    ...sharedRow,
    kind: 'car',
    car_details: { brand: 'Toyota', model: 'Hilux', mileage: 42000 },
  });

  assert.equal(listing.brand, 'Toyota');
  assert.equal(listing.make, 'Toyota');
  assert.equal(listing.model, 'Hilux');
});

test('maps machinery usage hours to the existing card field', () => {
  const listing = mapPublicListing({
    ...sharedRow,
    kind: 'machinery',
    machinery_details: { machinery_type: 'construction', usage_hours: 1800 },
  });

  assert.equal(listing.usage_hours, 1800);
  assert.equal(listing.equipment_hours, 1800);
});

test('rejects unknown listing kinds instead of returning a partial contract', () => {
  assert.throws(() => mapPublicListing({ ...sharedRow, kind: 'service' }), TypeError);
});

test('normalizes and bounds the public search contract', () => {
  const request = normalizePublicSearchRequest({
    kind: 'machinery',
    query: `  ${'x'.repeat(120)}  `,
    minPrice: '2500',
    maxPrice: '1000',
    cursor: 'not-a-valid-cursor',
    sort: 'unknown',
    minBedrooms: '3',
  });

  assert.equal(request.kind, 'machinery');
  assert.equal(request.query.length, 100);
  assert.equal(request.minPrice, 2500);
  assert.equal(request.maxPrice, 2500);
  assert.equal(request.cursor, null);
  assert.equal(request.pageSize, 24);
  assert.equal(request.sort, 'newest');
  assert.equal(request.minBedrooms, 3);
});

test('falls back to the approved property search defaults', () => {
  const request = normalizePublicSearchRequest({ kind: 'dealer' });
  const explicitNull = normalizePublicSearchRequest({ kind: 'car', maxPrice: null });

  assert.equal(request.kind, 'property');
  assert.equal(request.maxPrice, 500000);
  assert.equal(request.cursor, null);
  assert.equal(explicitNull.maxPrice, 500000);
});


test('normalizes paired keyset cursors for each supported sort', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(normalizePublicSearchPageRequest({ kind: 'property' }).cursor, null);
  assert.deepEqual(normalizePublicSearchCursor({ id, value: '2026-07-27T10:00:00Z' }, 'newest'), {
    id,
    value: '2026-07-27T10:00:00.000Z',
  });
  assert.deepEqual(normalizePublicSearchCursor({ id, value: '12500.50' }, 'price_desc'), {
    id,
    value: '12500.5',
  });
  assert.throws(() => normalizePublicSearchCursor({ id, value: '1.5' }, 'most_viewed'), /views are invalid/);
});

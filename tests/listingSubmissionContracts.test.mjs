import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTrustedListingImagePath,
  normalizeListingMediaReplacement,
  normalizeListingSubmission,
  normalizeOwnerListingAction,
} from '../src/services/listingSubmissionContracts.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const imageId = '22222222-2222-4222-8222-222222222222';
const base = {
  submissionKey: '33333333-3333-4333-8333-333333333333',
  kind: 'car',
  category: 'cars_sale',
  listingType: 'sale',
  title: 'Reliable Toyota Hilux for sale',
  description: 'A carefully maintained vehicle with a clear service history and no known mechanical faults.',
  price: '18000',
  locationId: '44444444-4444-4444-8444-444444444444',
  contactWhatsapp: '+263771234567',
  detail: {
    subtype: 'bakkie',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2022,
    mileage: 45000,
    fuel_type: 'diesel',
    transmission: 'manual',
    condition: 'good',
    service_history: 'full',
    accident_history: 'none',
  },
  media: [{ intentId: imageId, path: `${ownerId}/staging/${imageId}.jpg` }],
};

test('normalizes a schema-backed V2 product submission with native currency', () => {
  const result = normalizeListingSubmission(ownerId, { ...base, currency: 'ZAR', negotiable: true });
  assert.equal(result.listing.currency, 'ZAR');
  assert.equal(result.listing.price, 18000);
  assert.equal(result.listing.negotiable, true);
  assert.equal(result.detail.brand, 'Toyota');
  assert.equal(result.detail.fuel_type, 'diesel');
  assert.equal(result.attributes.version, 1);
  assert.equal(result.attributes.values.subtype, 'bakkie');
  assert.equal(result.attributes.values.service_history, 'full');
});

test('registry values richer than the legacy database enums survive normalization', () => {
  const result = normalizeListingSubmission(ownerId, {
    ...base,
    detail: { ...base.detail, fuel_type: 'plug_in_hybrid', transmission: 'cvt' },
  });
  assert.equal(result.detail.fuel_type, 'plug_in_hybrid');
  assert.equal(result.detail.transmission, 'cvt');
});

test('property transaction values come from the property registry', () => {
  const result = normalizeListingSubmission(ownerId, {
    ...base,
    kind: 'property',
    category: 'office',
    listingType: 'lease',
    title: 'Central Harare office space to lease',
    detail: { subtype: 'commercial', property_type: 'office' },
  });
  assert.equal(result.listing.listingType, 'lease');
  assert.deepEqual(result.detail, {
    property_type: 'office',
  });
  assert.equal(result.attributes.values.subtype, 'commercial');
});

test('rejects unsupported offers, category slugs and obsolete camelCase detail keys', () => {
  assert.throws(() => normalizeListingSubmission(ownerId, { ...base, listingType: 'auction' }), /Offer type/);
  assert.throws(() => normalizeListingSubmission(ownerId, { ...base, category: 'Premium Cars' }), /Category/);
  assert.throws(() => normalizeListingSubmission(ownerId, {
    ...base,
    detail: { ...base.detail, fuel_type: undefined, fuelType: 'diesel' },
  }), /Unsupported field|Fuel/);
});

test('requires one contact path and one validated owner-scoped image', () => {
  assert.throws(() => normalizeListingSubmission(ownerId, { ...base, contactWhatsapp: '', media: [] }), /contact method|listing images/);
  assert.throws(() => normalizeListingSubmission(ownerId, { ...base, media: [{ ...base.media[0], path: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/staging/${imageId}.jpg` }] }), /Image path/);
});

test('recognizes only generated listing-image storage paths', () => {
  assert.equal(isTrustedListingImagePath(`${ownerId}/staging/${imageId}.webp`), true);
  assert.equal(isTrustedListingImagePath('https://example.com/image.jpg'), false);
  assert.equal(isTrustedListingImagePath(`${ownerId}/../secret.jpg`), false);
});

test('owner state transitions expose only the V1 action vocabulary', () => {
  assert.deepEqual(normalizeOwnerListingAction(imageId, 'submit'), { listingId: imageId, action: 'submit' });
  assert.throws(() => normalizeOwnerListingAction(imageId, 'publish'), /Listing action/);
});

test('listing media replacement requires one to twenty unique trusted images', () => {
  const existingPath = `${ownerId}/staging/${imageId}.jpg`;
  const newIntent = '55555555-5555-4555-8555-555555555555';
  const newPath = `${ownerId}/staging/${newIntent}.webp`;
  assert.deepEqual(normalizeListingMediaReplacement(
    '66666666-6666-4666-8666-666666666666',
    [existingPath],
    [{ intentId: newIntent, path: newPath }],
  ), {
    listingId: '66666666-6666-4666-8666-666666666666',
    keepPaths: [existingPath],
    newMedia: [{ intentId: newIntent, path: newPath }],
  });
  assert.throws(() => normalizeListingMediaReplacement(ownerId, [], []), /between 1 and 20/);
  assert.throws(() => normalizeListingMediaReplacement(ownerId, [existingPath, existingPath], []), /unique/);
});

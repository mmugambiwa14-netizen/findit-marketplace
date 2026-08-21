import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVENTORY_BANDS,
  normalizeBusinessAccountRow,
  normalizeBusinessAccountSearch,
  normalizeBusinessListingPublication,
  normalizeBusinessOnboarding,
  normalizePublishingCategories,
} from '../src/services/adminBusinessOnboardingContracts.js';

const BUSINESS = '00000000-0000-4000-8000-000000000001';
const ADMIN = '00000000-0000-4000-8000-000000000002';
const REQUEST = '00000000-0000-4000-8000-000000000003';

function onboardingInput(overrides = {}) {
  return {
    userId: BUSINESS,
    categories: ['car'],
    businessName: 'Kombi Motors',
    contactName: 'Tendai M',
    businessEmail: 'Sales@Kombi.co.zw',
    businessPhone: '+263 77 123 4567',
    countryCode: 'zw',
    city: 'Harare',
    description: 'Family run dealership selling checked used vehicles across Harare.',
    expectedInventoryBand: '11-50',
    ...overrides,
  };
}

test('publishing categories are deduplicated and ordered, and unknown values are dropped', () => {
  assert.deepEqual(normalizePublishingCategories(['car', 'property', 'car']), ['property', 'car']);
  assert.deepEqual(normalizePublishingCategories(['legal', 'bogus']), []);
  assert.deepEqual(normalizePublishingCategories(null), []);
  // Order comes from the canonical list, not from the caller's array.
  assert.deepEqual(normalizePublishingCategories(['service', 'property']), ['property', 'service']);
});

test('account search demands a usable term and a bounded limit', () => {
  assert.deepEqual(normalizeBusinessAccountSearch('  dealer@example.com  '), {
    query: 'dealer@example.com',
    limit: 10,
  });
  assert.equal(normalizeBusinessAccountSearch('kombi', 25).limit, 25);
  assert.throws(() => normalizeBusinessAccountSearch('a'), /at least two characters/);
  assert.throws(() => normalizeBusinessAccountSearch('  '), /at least two characters/);
  assert.throws(() => normalizeBusinessAccountSearch('kombi', 26), /Result limit is invalid/);
  assert.throws(() => normalizeBusinessAccountSearch('kombi', 0), /Result limit is invalid/);
});

test('account rows expose publishing standing without leaking unknown categories', () => {
  const row = normalizeBusinessAccountRow({
    user_id: BUSINESS,
    email: 'dealer@example.com',
    full_name: 'Kombi Motors',
    account_status: 'active',
    application_id: REQUEST,
    application_status: 'approved',
    approved_categories: ['car', 'legal'],
    pending_categories: null,
  });
  assert.equal(row.userId, BUSINESS);
  assert.deepEqual(row.approvedCategories, ['car']);
  assert.deepEqual(row.pendingCategories, []);
  assert.equal(row.applicationStatus, 'approved');
});

test('a missing application status reads as not started rather than empty', () => {
  const row = normalizeBusinessAccountRow({ user_id: BUSINESS });
  assert.equal(row.applicationStatus, 'not_started');
  assert.equal(row.accountStatus, 'active');
  assert.deepEqual(row.approvedCategories, []);
});

test('onboarding a new business normalizes its details for the trusted boundary', () => {
  const request = normalizeBusinessOnboarding(onboardingInput({ note: '  Signed up in Harare  ' }));
  assert.equal(request.userId, BUSINESS);
  assert.deepEqual(request.categories, ['car']);
  assert.equal(request.note, 'Signed up in Harare');
  assert.equal(request.businessDetails.businessEmail, 'sales@kombi.co.zw');
  assert.equal(request.businessDetails.countryCode, 'ZW');
  assert.equal(request.businessDetails.websiteUrl, null);
});

test('onboarding an account that already applied sends no business details', () => {
  const request = normalizeBusinessOnboarding({
    userId: BUSINESS,
    categories: ['property'],
    hasExistingApplication: true,
  });
  assert.equal(request.businessDetails, null);
  assert.deepEqual(request.categories, ['property']);
  assert.equal(request.note, null);
});

test('onboarding refuses requests that would grant nothing or fail the database checks', () => {
  assert.throws(() => normalizeBusinessOnboarding(onboardingInput({ categories: [] })), /at least one publishing category/);
  assert.throws(() => normalizeBusinessOnboarding(onboardingInput({ userId: 'not-a-uuid' })), /Account is invalid/);
  assert.throws(() => normalizeBusinessOnboarding(onboardingInput({ description: 'too short' })), /Business description/);
  assert.throws(() => normalizeBusinessOnboarding(onboardingInput({ businessEmail: 'not-an-email' })), /valid business email/);
  assert.throws(() => normalizeBusinessOnboarding(onboardingInput({ countryCode: 'ZWE' })), /two-letter country code/);
  assert.throws(() => normalizeBusinessOnboarding(onboardingInput({ expectedInventoryBand: '5000+' })), /expected inventory band/);
});

test('every advertised inventory band survives normalization', () => {
  for (const band of INVENTORY_BANDS) {
    const request = normalizeBusinessOnboarding(onboardingInput({ expectedInventoryBand: band }));
    assert.equal(request.businessDetails.expectedInventoryBand, band);
  }
});

test('publication keeps the uploading admin and the owning business apart', () => {
  const publication = normalizeBusinessListingPublication({
    ownerUserId: BUSINESS,
    uploaderUserId: ADMIN,
    reason: '  Stock photographed at the branch  ',
    managedRequestId: REQUEST,
  });
  assert.equal(publication.ownerUserId, BUSINESS);
  assert.equal(publication.uploaderUserId, ADMIN);
  assert.equal(publication.reason, 'Stock photographed at the branch');
  assert.equal(publication.managedRequestId, REQUEST);
});

test('publication refuses to let an admin route their own listing through the admin path', () => {
  assert.throws(
    () => normalizeBusinessListingPublication({
      ownerUserId: ADMIN,
      uploaderUserId: ADMIN,
      reason: 'Publishing for myself',
    }),
    /normal listing flow/,
  );
});

test('publication requires a recorded reason and a valid business', () => {
  assert.throws(
    () => normalizeBusinessListingPublication({ ownerUserId: BUSINESS, uploaderUserId: ADMIN, reason: '  ' }),
    /Publication reason/,
  );
  assert.throws(
    () => normalizeBusinessListingPublication({ ownerUserId: '', uploaderUserId: ADMIN, reason: 'Valid reason' }),
    /Business account is invalid/,
  );
  assert.throws(
    () => normalizeBusinessListingPublication({
      ownerUserId: BUSINESS,
      uploaderUserId: ADMIN,
      reason: 'Valid reason',
      managedRequestId: 'not-a-uuid',
    }),
    /Managed listing request is invalid/,
  );
});

test('publication treats an absent managed request as no request at all', () => {
  const publication = normalizeBusinessListingPublication({
    ownerUserId: BUSINESS,
    uploaderUserId: ADMIN,
    reason: 'Onboarded dealer stock',
  });
  assert.equal(publication.managedRequestId, null);
});

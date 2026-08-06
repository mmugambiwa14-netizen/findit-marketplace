import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTrustedListingImagePath,
  normalizeListingMediaReplacement,
  normalizeListingSubmission,
  normalizeOwnerListingAction,
} from '../../src/services/listingSubmissionContracts.js';

const OWNER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const LOCATION_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const SUBMISSION_ID = 'c06fc3cc-0a95-4dc8-a4c7-615874f72c63';
const INTENT_ID = '2d571bb0-c497-43bd-9f48-279d7930d173';
const IMAGE_ID = 'd6f86f39-b8f5-4fce-a628-969c1c04f015';
const IMAGE_PATH = `${OWNER_ID}/staging/${IMAGE_ID}.jpg`;

function validProperty(overrides = {}) {
  return {
    submissionKey: SUBMISSION_ID,
    kind: 'property',
    category: 'residential_property',
    listingType: 'sale',
    title: 'Three-bedroom family home',
    description: 'A well maintained family home with secure parking and reliable utilities.',
    price: 125000,
    currency: 'USD',
    negotiable: true,
    locationId: LOCATION_ID,
    contactEmail: 'seller@example.com',
    detail: { propertyType: 'house', bedrooms: 3, bathrooms: 2, sizeSqm: 180 },
    media: [{ intentId: INTENT_ID, path: IMAGE_PATH }],
    ...overrides,
  };
}

test('a complete property submission is normalized into bounded server input', () => {
  const result = normalizeListingSubmission(OWNER_ID, validProperty());
  assert.equal(result.listing.kind, 'property');
  assert.equal(result.listing.currency, 'USD');
  assert.equal(result.listing.contactEmail, 'seller@example.com');
  assert.deepEqual(result.media, [{ intentId: INTENT_ID, path: IMAGE_PATH }]);
});

test('submission identifiers and category slugs reject injection-shaped input', () => {
  assert.throws(() => normalizeListingSubmission("' OR 1=1--", validProperty()), /Owner is invalid/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ submissionKey: 'not-a-uuid' })), /Submission key is invalid/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ category: 'Residential Property' })), /Category is invalid/);
});

test('listing text, price, currency and contact methods remain bounded', () => {
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ title: 'Too short' })), /Title is too short/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ description: 'x'.repeat(5001) })), /Description is too long/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ price: -1 })), /Price is invalid/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ currency: 'BTC' })), /Currency is invalid/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ contactEmail: '', contactPhone: '', contactWhatsapp: '' })), /contact method/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ contactEmail: 'not-an-email' })), /Contact email is invalid/);
});

test('media paths must belong to the owner staging namespace and be unique', () => {
  assert.equal(isTrustedListingImagePath(IMAGE_PATH), true);
  assert.equal(isTrustedListingImagePath('https://attacker.example/image.jpg'), false);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({ media: [] })), /between 1 and 20/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({
    media: [{ intentId: INTENT_ID, path: `${LOCATION_ID}/staging/${IMAGE_ID}.jpg` }],
  })), /Image path is invalid/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({
    media: [
      { intentId: INTENT_ID, path: IMAGE_PATH },
      { intentId: '4eedc28e-e4df-44b5-9aa8-dbcf56865dd0', path: IMAGE_PATH },
    ],
  })), /Duplicate listing image/);
});

test('category-specific numeric values and enums are validated', () => {
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({
    detail: { propertyType: 'castle', bedrooms: 3, bathrooms: 2 },
  })), /Property type is invalid/);
  assert.throws(() => normalizeListingSubmission(OWNER_ID, validProperty({
    detail: { propertyType: 'house', bedrooms: 1.5, bathrooms: 2 },
  })), /Bedrooms is invalid/);
});

test('owners cannot invoke invented or destructive listing actions', () => {
  assert.deepEqual(normalizeOwnerListingAction(LOCATION_ID, 'pause'), { listingId: LOCATION_ID, action: 'pause' });
  for (const action of ['delete', 'approve', 'publish', 'purge', 'all']) {
    assert.throws(() => normalizeOwnerListingAction(LOCATION_ID, action), /Listing action is invalid/);
  }
});

test('media replacement prevents path injection, duplicates and empty galleries', () => {
  assert.throws(() => normalizeListingMediaReplacement(LOCATION_ID, [], []), /between 1 and 20/);
  assert.throws(() => normalizeListingMediaReplacement(LOCATION_ID, [IMAGE_PATH, IMAGE_PATH], []), /unique/);
  assert.throws(() => normalizeListingMediaReplacement(LOCATION_ID, ['../secret.jpg'], []), /path is invalid/);
  assert.throws(() => normalizeListingMediaReplacement(LOCATION_ID, [IMAGE_PATH], [{ intentId: INTENT_ID, path: IMAGE_PATH }]), /unique/);
});

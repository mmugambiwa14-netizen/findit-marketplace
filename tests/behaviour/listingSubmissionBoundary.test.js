import { describe, expect, test } from 'vitest';
import {
  isTrustedListingImagePath,
  normalizeListingImageFile,
  normalizeListingMediaReplacement,
  normalizeListingSubmission,
  normalizeOwnerListingAction,
} from '@/services/listingSubmissionContracts';

// This is the last client-side gate before a listing submission reaches the
// database RPC. Every case below is executed against the real implementation:
// a regression that keeps the source text intact but breaks the check still
// fails here.

const OWNER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_OWNER = '9c858901-8a57-4791-81fe-4c455b099bc9';
const SUBMISSION_KEY = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const INTENT = '11111111-2222-4333-8444-555555555555';

const validSubmission = (overrides = {}) => ({
  submissionKey: SUBMISSION_KEY,
  kind: 'property',
  category: 'residential_house',
  listingType: 'sale',
  title: 'Three bedroom house in Borrowdale',
  description:
    'A well maintained three bedroom family house with a walled garden, solar backup and secure parking for two vehicles.',
  price: 120000,
  currency: 'USD',
  locationId: '7d793037-a076-4f11-a2a8-9c1b4a0e5b21',
  contactPhone: '+263771234567',
  detail: { propertyType: 'house', bedrooms: 3, bathrooms: 2 },
  media: [{ intentId: INTENT, path: `${OWNER}/staging/${INTENT}.jpg` }],
  ...overrides,
});

describe('listing submission ownership boundary', () => {
  test('accepts a well-formed submission and returns the normalised shape', () => {
    const result = normalizeListingSubmission(OWNER, validSubmission());

    expect(result.submissionKey).toBe(SUBMISSION_KEY);
    expect(result.listing.kind).toBe('property');
    expect(result.listing.currency).toBe('USD');
    expect(result.detail.propertyType).toBe('house');
    expect(result.media).toHaveLength(1);
  });

  test('rejects media staged under a different owner prefix', () => {
    // The storage path encodes ownership. Accepting another owner's prefix
    // would let a caller bind someone else's uploaded bytes to their listing.
    const submission = validSubmission({
      media: [{ intentId: INTENT, path: `${OTHER_OWNER}/staging/${INTENT}.jpg` }],
    });

    expect(() => normalizeListingSubmission(OWNER, submission)).toThrow(/Image path is invalid/);
  });

  test('rejects path traversal in the media path', () => {
    const submission = validSubmission({
      media: [{ intentId: INTENT, path: `${OWNER}/staging/../../${OTHER_OWNER}/live/x.jpg` }],
    });

    expect(() => normalizeListingSubmission(OWNER, submission)).toThrow(/Image path is invalid/);
  });

  test('rejects a duplicate image path within one submission', () => {
    const path = `${OWNER}/staging/${INTENT}.jpg`;
    const submission = validSubmission({
      media: [
        { intentId: INTENT, path },
        { intentId: INTENT, path },
      ],
    });

    expect(() => normalizeListingSubmission(OWNER, submission)).toThrow(/Duplicate listing image/);
  });

  test.each([
    ['no media', []],
    ['more than twenty images', Array.from({ length: 21 }, () => ({ intentId: INTENT, path: `${OWNER}/staging/${INTENT}.jpg` }))],
  ])('rejects %s', (_label, media) => {
    expect(() => normalizeListingSubmission(OWNER, validSubmission({ media })))
      .toThrow(/between 1 and 20 listing images/);
  });

  test('rejects an unsupported currency', () => {
    expect(() => normalizeListingSubmission(OWNER, validSubmission({ currency: 'BTC' })))
      .toThrow(/Currency is invalid/);
  });

  test('rejects a category that is not a slug', () => {
    expect(() => normalizeListingSubmission(OWNER, validSubmission({ category: 'Residential House' })))
      .toThrow(/Category is invalid/);
  });

  test('requires at least one contact method', () => {
    const submission = validSubmission({
      contactPhone: '',
      contactWhatsapp: '',
      contactEmail: '',
    });

    expect(() => normalizeListingSubmission(OWNER, submission))
      .toThrow(/Add at least one contact method/);
  });

  test('rejects a malformed contact email', () => {
    expect(() => normalizeListingSubmission(OWNER, validSubmission({ contactEmail: 'not-an-email' })))
      .toThrow(/Contact email is invalid/);
  });

  test('lowercases the contact email so lookups stay case-insensitive', () => {
    const result = normalizeListingSubmission(
      OWNER,
      validSubmission({ contactEmail: 'Seller@Example.COM' }),
    );

    expect(result.listing.contactEmail).toBe('seller@example.com');
  });

  test('rejects a title shorter than the enforced minimum', () => {
    expect(() => normalizeListingSubmission(OWNER, validSubmission({ title: 'Too short' })))
      .toThrow(/Title is too short/);
  });

  test('rejects a non-uuid owner', () => {
    expect(() => normalizeListingSubmission('not-a-uuid', validSubmission()))
      .toThrow(/Owner is invalid/);
  });

  test('rejects a price above the supported ceiling', () => {
    expect(() => normalizeListingSubmission(OWNER, validSubmission({ price: 1e15 })))
      .toThrow(/Price is invalid/);
  });
});

describe('category-specific detail validation', () => {
  test('a car listing requires fuel type and transmission from the allowed set', () => {
    const carSubmission = validSubmission({
      kind: 'car',
      category: 'sedan',
      detail: { brand: 'Toyota', model: 'Corolla', fuelType: 'nuclear', transmission: 'manual' },
    });

    expect(() => normalizeListingSubmission(OWNER, carSubmission)).toThrow(/Fuel type is invalid/);
  });

  test('a car listing rejects a year beyond next year', () => {
    const nextYearPlusTwo = new Date().getFullYear() + 2;
    const carSubmission = validSubmission({
      kind: 'car',
      category: 'sedan',
      detail: {
        brand: 'Toyota',
        model: 'Corolla',
        fuelType: 'petrol',
        transmission: 'manual',
        year: nextYearPlusTwo,
      },
    });

    expect(() => normalizeListingSubmission(OWNER, carSubmission)).toThrow(/Vehicle year is invalid/);
  });

  test('a machinery listing requires a condition from the allowed set', () => {
    const machinerySubmission = validSubmission({
      kind: 'machinery',
      category: 'excavator',
      detail: {
        machineryType: 'construction',
        brand: 'Caterpillar',
        model: '320D',
        condition: 'pristine',
      },
    });

    expect(() => normalizeListingSubmission(OWNER, machinerySubmission))
      .toThrow(/Machinery condition is invalid/);
  });

  test('a property listing coerces optional numerics to null rather than NaN', () => {
    const result = normalizeListingSubmission(
      OWNER,
      validSubmission({ detail: { propertyType: 'land', bedrooms: '', bathrooms: '' } }),
    );

    expect(result.detail.bedrooms).toBeNull();
    expect(result.detail.bathrooms).toBeNull();
  });
});

describe('listing image file validation', () => {
  const imageFile = (name, type, size) => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  test('accepts a JPEG under the size ceiling', () => {
    const file = imageFile('photo.jpg', 'image/jpeg', 1024);
    expect(normalizeListingImageFile(file)).toBe(file);
  });

  test('rejects a non-image mime type', () => {
    expect(() => normalizeListingImageFile(imageFile('payload.svg', 'image/svg+xml', 1024)))
      .toThrow(/JPG, PNG, or WebP/);
  });

  test('rejects a file over 5 MB', () => {
    expect(() => normalizeListingImageFile(imageFile('huge.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)))
      .toThrow(/5 MB or smaller/);
  });

  test('rejects an empty file', () => {
    expect(() => normalizeListingImageFile(imageFile('empty.jpg', 'image/jpeg', 0)))
      .toThrow(/5 MB or smaller/);
  });

  test('rejects something that is not a File at all', () => {
    expect(() => normalizeListingImageFile({ type: 'image/jpeg', size: 10 }))
      .toThrow(/Choose an image/);
  });
});

describe('trusted image path recognition', () => {
  test.each([
    [`${OWNER}/staging/${INTENT}.jpg`, true],
    [`${OWNER}/staging/${INTENT}.webp`, true],
    [`${OWNER}/live/${INTENT}.jpg`, false],
    [`../${OWNER}/staging/${INTENT}.jpg`, false],
    [`${OWNER}/staging/${INTENT}.svg`, false],
    ['', false],
    [null, false],
  ])('%s -> %s', (value, expected) => {
    expect(isTrustedListingImagePath(value)).toBe(expected);
  });
});

describe('owner listing actions', () => {
  test.each(['submit', 'pause', 'resume', 'unavailable'])('allows %s', (action) => {
    const listingId = '5a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d';
    expect(normalizeOwnerListingAction(listingId, action)).toEqual({ listingId, action });
  });

  test('rejects an action outside the allowed set', () => {
    expect(() => normalizeOwnerListingAction('5a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d', 'delete'))
      .toThrow(/Listing action is invalid/);
  });
});

describe('listing media replacement', () => {
  test('rejects a replacement that would leave the listing with no images', () => {
    expect(() => normalizeListingMediaReplacement(
      '5a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d',
      [],
      [],
    )).toThrow(/between 1 and 20 images/);
  });

  test('rejects duplicate retained paths', () => {
    const path = `${OWNER}/staging/${INTENT}.jpg`;
    expect(() => normalizeListingMediaReplacement(
      '5a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d',
      [path, path],
      [],
    )).toThrow(/must be unique/);
  });

  test('rejects an untrusted retained path', () => {
    expect(() => normalizeListingMediaReplacement(
      '5a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d',
      ['/etc/passwd'],
      [],
    )).toThrow(/Existing listing image path is invalid/);
  });
});

import { describe, expect, test } from 'vitest';
import { normalizeProfileUpdate } from '@/services/profileContracts';
import { normalizeSupportRequest } from '@/services/contactSupportContracts';
import { normalizeBusinessProfileInput } from '@/services/businessProfileContracts';
import { normalizeListingSubmission } from '@/services/listingSubmissionContracts';

// Every free-text contract must strip the characters that corrupt stored data or
// spoof how it renders, before the value reaches the database. React escapes HTML
// (no XSS) and the RPCs are parameterised (no SQL injection); the residual vectors
// are null bytes (otherwise a Postgres 500), zero-width characters (defeat
// uniqueness / moderation) and bidi overrides (display spoofing). These drive the
// real contracts and assert the hostile characters are gone.
//
// Hostile characters are written as escapes so the test file itself stays clean
// ASCII (the repository hygiene gate rejects raw control/pictographic bytes).

const NULL = '\u0000';
const BACKSPACE = '\u0008';
const ZERO_WIDTH = '\u200B';
const BIDI_OVERRIDE = '\u202E';
const BOM = '\uFEFF';
const HOSTILE = `A${NULL}B${ZERO_WIDTH}C${BIDI_OVERRIDE}D${BOM}`;
const CLEAN = 'ABCD';

const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function assertClean(value) {
  expect(value).not.toMatch(CONTROL_RE);
  expect(value).not.toContain(ZERO_WIDTH);
  expect(value).not.toContain(BIDI_OVERRIDE);
  expect(value).not.toContain(BOM);
}

describe('profile fields', () => {
  test('full name is stripped of control, zero-width and bidi characters', () => {
    const result = normalizeProfileUpdate({ full_name: HOSTILE });
    expect(result.full_name).toBe(CLEAN);
    assertClean(result.full_name);
  });

  test('bio is stripped but ordinary text and emoji survive', () => {
    const result = normalizeProfileUpdate({ bio: `Great seller ${ZERO_WIDTH}\u{1F44D}${BACKSPACE}` });
    assertClean(result.bio);
    expect(result.bio).toContain('\u{1F44D}');
    expect(result.bio).toContain('Great seller');
  });
});

describe('support request', () => {
  test('a message laced with control and zero-width characters is cleaned', () => {
    const message = `I need help with my account${ZERO_WIDTH} please respond${NULL} soon enough now`;
    const result = normalizeSupportRequest({
      category: 'account',
      contactEmail: 'real@gmail.com',
      message,
    });
    assertClean(result.message);
    expect(result.message).toContain('I need help');
  });
});

describe('business profile', () => {
  test('company name is cleaned of hostile characters', () => {
    const result = normalizeBusinessProfileInput({
      company_name: `Apex${BIDI_OVERRIDE} Motors${ZERO_WIDTH}`,
      business_type: 'car_dealership',
      phone: '+263771234567',
    });
    assertClean(result.company_name);
    expect(result.company_name).toContain('Apex');
  });
});

describe('listing submission', () => {
  const OWNER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const INTENT = '11111111-2222-4333-8444-555555555555';

  const submission = (overrides = {}) => ({
    submissionKey: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    kind: 'property',
    category: 'residential_house',
    listingType: 'sale',
    title: 'Three bedroom house in Borrowdale',
    description:
      'A well maintained family house with a walled garden, solar backup and secure parking for two vehicles.',
    price: 120000,
    currency: 'USD',
    locationId: '7d793037-a076-4f11-a2a8-9c1b4a0e5b21',
    contactPhone: '+263771234567',
    detail: { propertyType: 'house' },
    media: [{ intentId: INTENT, path: `${OWNER}/staging/${INTENT}.jpg` }],
    ...overrides,
  });

  test('title and description are cleaned before submission', () => {
    const result = normalizeListingSubmission(OWNER, submission({
      title: `Three bedroom house${ZERO_WIDTH} in Borrowdale${BIDI_OVERRIDE}`,
      description: `A well maintained family house with a garden${NULL} and solar backup for the whole home now.`,
    }));

    assertClean(result.listing.title);
    assertClean(result.listing.description);
    expect(result.listing.title).toContain('Three bedroom house');
    expect(result.listing.description).toContain('family house');
  });

  test('a title of only hostile characters collapses to empty and is rejected as too short', () => {
    expect(() => normalizeListingSubmission(OWNER, submission({
      title: `${NULL}${ZERO_WIDTH}${BIDI_OVERRIDE}${BOM}`,
    }))).toThrow(/Title is too short/);
  });
});

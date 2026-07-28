import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBusinessOwnerId,
  normalizeBusinessProfileId,
  normalizeBusinessProfileInput,
  normalizeDealerInventoryQuery,
} from '../src/services/businessProfileContracts.js';

const ID = '00000000-0000-4000-8000-000000000001';

test('business profile IDs are opaque UUIDs', () => {
  assert.equal(normalizeBusinessProfileId(ID.toUpperCase()), ID);
  assert.equal(normalizeBusinessOwnerId(ID), ID);
  assert.throws(() => normalizeBusinessProfileId('public-name'), /ID is invalid/);
});

test('V1 profile input keeps only lightweight public identity fields', () => {
  const result = normalizeBusinessProfileInput({
    company_name: '  Mbare Motors  ',
    business_type: 'car_dealership',
    phone: '+263 77 123 4567',
    email: ' SALES@EXAMPLE.CO.ZW ',
    website: 'https://example.co.zw',
    social_links: { instagram: 'https://instagram.com/example' },
    city: ' Harare ',
    address: '',
    description: ' Reliable vehicles ',
    verified: true,
    registration_number: 'must-not-pass-through',
  });

  assert.deepEqual(result, {
    company_name: 'Mbare Motors',
    business_type: 'car_dealership',
    phone: '+263 77 123 4567',
    email: 'sales@example.co.zw',
    website: 'https://example.co.zw/',
    social_links: { instagram: 'https://instagram.com/example' },
    city: 'Harare',
    address: null,
    description: 'Reliable vehicles',
  });
  assert.equal('verified' in result, false);
  assert.equal('registration_number' in result, false);
});

test('legal firms and dormant role concepts cannot enter the V1 contract', () => {
  assert.throws(() => normalizeBusinessProfileInput({ company_name: 'Legal Co', business_type: 'legal_firm', phone: '1' }), /type is invalid/);
  assert.throws(() => normalizeBusinessProfileInput({ company_name: 'Premium Co', business_type: 'premium_dealer', phone: '1' }), /type is invalid/);
});

test('a profile requires a usable contact method', () => {
  assert.throws(() => normalizeBusinessProfileInput({ company_name: 'No Contact', business_type: 'other' }), /phone number or email/);
  assert.throws(() => normalizeBusinessProfileInput({ company_name: 'Bad Email', business_type: 'other', email: 'invalid' }), /Email is invalid/);
});

test('website and social URLs reject executable protocols', () => {
  const base = { company_name: 'Safe Links', business_type: 'other', phone: '123' };
  assert.throws(() => normalizeBusinessProfileInput({ ...base, website: 'javascript:alert(1)' }), /http or https/);
  assert.throws(() => normalizeBusinessProfileInput({ ...base, social_links: { facebook: 'data:text/html,bad' } }), /http or https/);
  assert.throws(() => normalizeBusinessProfileInput({ ...base, social_links: { tiktok: 'https://tiktok.com/example' } }), /not supported/);
});

test('dealer inventory search is compact and bounded', () => {
  assert.equal(normalizeDealerInventoryQuery('  Toyota    Hilux  '), 'Toyota Hilux');
  assert.equal(normalizeDealerInventoryQuery('a'.repeat(150)).length, 100);
});

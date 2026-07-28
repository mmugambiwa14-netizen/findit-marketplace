import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeOwnerListingIdentity,
  normalizeOwnerListingLimit,
  normalizeOwnerListingUpdate,
  normalizeOwnerId,
} from '../src/services/ownerListingContracts.js';

test('normalizes the bounded owner listing edit contract', () => {
  assert.deepEqual(
    normalizeOwnerListingUpdate({
      title: '  Family home  ',
      description: '  Quiet neighbourhood  ',
      price: '125000.50',
      contact_email: ' SELLER@EXAMPLE.COM ',
      contact_phone: '',
      location_id: ' location-id ',
    }),
    {
      title: 'Family home',
      description: 'Quiet neighbourhood',
      price: 125000.5,
      contact_email: 'seller@example.com',
      contact_phone: null,
      location_id: 'location-id',
    },
  );
});

test('rejects unsupported owner listing fields and invalid values', () => {
  assert.throws(() => normalizeOwnerListingUpdate({ verified: true }), /No supported/);
  assert.throws(() => normalizeOwnerListingUpdate({ title: '   ' }), /required/);
  assert.throws(() => normalizeOwnerListingUpdate({ price: -1 }), /non-negative/);
  assert.throws(() => normalizeOwnerListingUpdate({ contact_email: 'not-an-email' }), /invalid/);
  assert.throws(() => normalizeOwnerListingUpdate({ status: 'available' }), /No supported/);
});

test('validates owner listing identity and result limit', () => {
  assert.deepEqual(
    normalizeOwnerListingIdentity(' owner-id ', 'car', ' listing-id '),
    { ownerId: 'owner-id', kind: 'car', listingId: 'listing-id' },
  );
  assert.equal(normalizeOwnerListingLimit('50'), 50);
  assert.equal(normalizeOwnerId(' owner-id '), 'owner-id');
  assert.throws(() => normalizeOwnerListingIdentity('owner', 'service', 'listing'), /Unsupported/);
  assert.throws(() => normalizeOwnerListingLimit(201), /between 1 and 200/);
});

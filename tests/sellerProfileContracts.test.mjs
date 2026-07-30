import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSellerProfileId,
  normalizeSellerListingsPageRequest,
  normalizeSellerProfileId,
} from '../src/services/sellerProfileContracts.js';

const SELLER_ID = '90000000-0000-4000-8000-000000000001';

test('normalizes an opaque seller profile UUID route identity', () => {
  assert.equal(isSellerProfileId(` ${SELLER_ID.toUpperCase()} `), true);
  assert.equal(normalizeSellerProfileId(` ${SELLER_ID.toUpperCase()} `), SELLER_ID);
});

test('rejects email, empty and malformed seller profile route identities', () => {
  for (const value of ['', 'seller@example.com', 'not-a-uuid', '00000000-0000-0000-0000-000000000000']) {
    assert.equal(isSellerProfileId(value), false);
    assert.throws(() => normalizeSellerProfileId(value), /Seller ID is invalid/);
  }
});

test('normalizes bounded seller listing pages around the same opaque identity', () => {
  assert.deepEqual(normalizeSellerListingsPageRequest(SELLER_ID, { limit: 12 }), {
    sellerId: SELLER_ID,
    limit: 12,
    cursor: null,
  });
  assert.equal(normalizeSellerListingsPageRequest(SELLER_ID, { limit: 500 }).limit, 48);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSellerProfileEmail } from '../src/services/sellerProfileContracts.js';

test('normalizes a seller profile route identity', () => {
  assert.equal(normalizeSellerProfileEmail(' Seller@Example.COM '), 'seller@example.com');
});

test('rejects invalid seller profile route identities', () => {
  assert.throws(() => normalizeSellerProfileEmail(''), /invalid/);
  assert.throws(() => normalizeSellerProfileEmail('not-an-email'), /invalid/);
  assert.throws(() => normalizeSellerProfileEmail('x'.repeat(255)), /invalid/);
});

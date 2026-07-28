import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSupportRequest } from '../src/services/contactSupportContracts.js';

test('support requests normalize the bounded V1 fields', () => {
  assert.deepEqual(normalizeSupportRequest({
    category: 'safety',
    contactEmail: ' Founder@Example.com ',
    message: '  This listing may put a buyer at risk.  ',
    relatedReference: ' listing-123 ',
  }), {
    category: 'safety',
    contactEmail: 'founder@example.com',
    message: 'This listing may put a buyer at risk.',
    relatedReference: 'listing-123',
  });
});

test('support requests reject invalid or over-broad input', () => {
  assert.throws(() => normalizeSupportRequest({
    category: 'payments', contactEmail: 'a@example.com', message: 'A sufficiently detailed support message.',
  }), /category is invalid/);
  assert.throws(() => normalizeSupportRequest({
    category: 'other', contactEmail: 'not-an-email', message: 'A sufficiently detailed support message.',
  }), /valid contact email/);
  assert.throws(() => normalizeSupportRequest({
    category: 'other', contactEmail: 'a@example.com', message: 'Too short',
  }), /between 20 and 4000/);
});

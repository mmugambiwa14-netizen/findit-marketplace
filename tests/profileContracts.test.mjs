import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeProfileIdentity, normalizeProfileUpdate } from '../src/services/profileContracts.js';

test('normalizes the editable V1 profile contract', () => {
  assert.equal(normalizeProfileIdentity(' user-id '), 'user-id');
  assert.deepEqual(
    normalizeProfileUpdate({ full_name: '  Tariro Moyo  ', bio: '  Trusted local seller  ' }),
    { full_name: 'Tariro Moyo', bio: 'Trusted local seller' },
  );
  assert.deepEqual(normalizeProfileUpdate({ bio: '   ' }), { bio: null });
  assert.deepEqual(
    normalizeProfileUpdate({
      display_name: '  Moyo Properties  ',
      public_address: '  Harare CBD  ',
      website_url: 'https://example.co.zw/',
    }),
    {
      display_name: 'Moyo Properties',
      public_address: 'Harare CBD',
      website_url: 'https://example.co.zw/',
    },
  );
});

test('rejects privileged or invalid profile updates', () => {
  assert.throws(() => normalizeProfileUpdate({ role: 'admin' }), /No supported/);
  assert.throws(() => normalizeProfileUpdate({ full_name: '   ' }), /required/);
  assert.throws(() => normalizeProfileUpdate({ bio: 'x'.repeat(501) }), /too long/);
  assert.throws(() => normalizeProfileUpdate({ website_url: 'javascript:alert(1)' }), /http or https/);
  assert.throws(() => normalizeProfileUpdate({ public_address: 'x'.repeat(301) }), /too long/);
});

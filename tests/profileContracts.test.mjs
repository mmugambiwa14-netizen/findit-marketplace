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
});

test('rejects privileged or invalid profile updates', () => {
  assert.throws(() => normalizeProfileUpdate({ role: 'admin' }), /No supported/);
  assert.throws(() => normalizeProfileUpdate({ full_name: '   ' }), /required/);
  assert.throws(() => normalizeProfileUpdate({ bio: 'x'.repeat(501) }), /too long/);
});

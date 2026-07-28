import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [intent, complete, runtime, repository, contracts] = await Promise.all([
  readFile(new URL('../supabase/functions/tour-upload-intent/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/tour-upload-complete/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/_shared/tour-runtime.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/repositories/listingToursRepository.js', import.meta.url), 'utf8'),
  import('../src/services/listingTourContracts.js'),
]);

test('large Tour bytes upload directly to signed Storage, not through the Edge request body', () => {
  assert.match(intent, /createSignedUploadUrl/);
  assert.doesNotMatch(intent, /formData\(|arrayBuffer\(|\.upload\(/);
  assert.match(repository, /uploadToSignedUrl/);
  assert.match(repository, /tour-sources/);
});

test('upload intent authenticates the user and delegates ownership to a service-only RPC', () => {
  assert.match(intent, /user\.auth\.getUser\(\)/);
  assert.match(intent, /rpc\("authorize_tour_upload"/);
  assert.match(complete, /rpc\("complete_tour_upload"/);
  assert.match(complete, /userData\.user\.id/);
});

test('client and server contracts agree on the two-minute and 250 MB limits', () => {
  assert.equal(contracts.TOUR_MAX_DURATION_SECONDS, 120);
  assert.equal(contracts.TOUR_MAX_SOURCE_BYTES, 250 * 1024 * 1024);
  assert.deepEqual(contracts.TOUR_ALLOWED_MIME_TYPES, ['video/mp4', 'video/quicktime', 'video/webm']);
  assert.match(runtime, /maxDurationSeconds: 120/);
  assert.match(runtime, /maxSourceBytes: 262_144_000/);
  assert.match(intent, /2 minutes or shorter/);
});

test('upload paths are server generated, owner scoped and idempotent', () => {
  assert.match(intent, /const tourId = crypto\.randomUUID\(\)/);
  assert.match(intent, /const objectId = crypto\.randomUUID\(\)/);
  assert.match(intent, /sourcePath = `\$\{userData\.user\.id\}\/\$\{tourId\}\/source\/\$\{objectId\}/);
  assert.match(intent, /p_idempotency_key: idempotencyKey/);
  assert.doesNotMatch(intent, /payload\.path|payload\.tourId/);
});

test('temporary signed-url failure leaves the bounded intent retryable', () => {
  const signedFailure = intent.slice(intent.indexOf('if (signedError'));
  assert.match(signedFailure, /same idempotency key can be[\s\S]*retried/);
  assert.doesNotMatch(signedFailure.slice(0, signedFailure.indexOf('return json(req, 201')), /update\(\{ state: "rejected" \}\)/);
});

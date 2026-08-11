import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workerPath = new URL('../supabase/functions/media-lifecycle-cleanup/index.ts', import.meta.url);
const configPath = new URL('../supabase/config.toml', import.meta.url);

test('media cleanup is an internal service-credential boundary', async () => {
  const [worker, config] = await Promise.all([
    readFile(workerPath, 'utf8'),
    readFile(configPath, 'utf8'),
  ]);
  assert.match(config, /\[functions\.media-lifecycle-cleanup\][\s\S]*?verify_jwt = false/);
  assert.match(worker, /FINDIT_MEDIA_CLEANUP_WORKER_SECRET/);
  assert.match(worker, /Missing FINDIT_MEDIA_CLEANUP_WORKER_SECRET/);
  assert.doesNotMatch(worker, /configuredWorkerSecret\(adminKey\)|\?\? adminKey/);
  assert.match(worker, /constantTimeEqual\(suppliedAuthorization, `Bearer \$\{workerSecret\}`\)/);
  assert.match(worker, /createClient\(supabaseUrl, adminKey/);
  assert.doesNotMatch(worker, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(worker, /SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY/);
});

test('media cleanup uses the database claim and finalize protocol', async () => {
  const worker = await readFile(workerPath, 'utf8');
  assert.match(worker, /rpc\("claim_expired_image_uploads"/);
  assert.match(worker, /rpc\(\s*"finalize_image_upload_cleanup"/);
  assert.match(worker, /requestedBatchSize < 1 \|\| requestedBatchSize > 100/);
  assert.match(worker, /\.remove\(\[candidate\.storage_path\]\)/);
});

test('media cleanup responses expose counts and correlation, not object paths', async () => {
  const worker = await readFile(workerPath, 'utf8');
  assert.match(worker, /correlationId,[\s\S]*claimed: candidates\.length,[\s\S]*cleaned,[\s\S]*retryScheduled,[\s\S]*finalizeFailures/);
  const successBody = worker.slice(worker.indexOf('return json(finalizeFailures'));
  assert.doesNotMatch(successBody.slice(0, successBody.indexOf('} catch')), /storage_path|storagePath|candidate\.bucket_id/);
});

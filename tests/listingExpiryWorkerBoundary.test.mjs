import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, config] = await Promise.all([
  readFile(new URL('../supabase/functions/listing-expiry-worker/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8'),
]);

test('listing expiry worker is an internal service-credential boundary', () => {
  assert.match(config, /\[functions\.listing-expiry-worker\][\s\S]*?verify_jwt = false/);
  assert.match(worker, /constantTimeEqual/);
  assert.match(worker, /FINDIT_LISTING_EXPIRY_WORKER_SECRET/);
  assert.match(worker, /Missing FINDIT_LISTING_EXPIRY_WORKER_SECRET/);
  assert.doesNotMatch(worker, /configuredWorkerSecret\(adminKey\)|\?\? adminKey/);
  assert.match(worker, /constantTimeEqual\(suppliedAuthorization, `Bearer \$\{workerSecret\}`\)/);
  assert.match(worker, /createClient\(supabaseUrl, adminKey/);
  assert.match(worker, /A trusted scheduler credential is required/);
  assert.match(worker, /process_listing_expiry_notifications/);
});

test('listing expiry worker exposes only bounded counts and correlation', () => {
  assert.match(worker, /"Cache-Control": "no-store"/);
  assert.match(worker, /"X-Content-Type-Options": "nosniff"/);
  assert.match(worker, /noticesCreated/);
  assert.match(worker, /listingsExpired/);
  assert.doesNotMatch(worker, /select\(|listing_id|seller_id|storage_path/);
});

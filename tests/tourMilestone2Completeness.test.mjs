import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [upload, processing, moderation, lifecycle, rollback, processingRollback, moderationRollback, packageJson] = await Promise.all([
  read('supabase/migrations/0032_v1_tour_storage_and_upload.sql'),
  read('supabase/migrations/0033_v1_tour_processing_and_publication.sql'),
  read('supabase/migrations/0034_v1_tour_moderation_and_reports.sql'),
  read('supabase/migrations/0035_v1_tour_cleanup_and_indexes.sql'),
  read('supabase/rollback/0035_v1_tour_cleanup_and_indexes.rollback.sql'),
  read('supabase/rollback/0033_v1_tour_processing_and_publication.rollback.sql'),
  read('supabase/rollback/0034_v1_tour_moderation_and_reports.rollback.sql'),
  read('package.json'),
]);

test('terminal failed replacements cannot strand media or block a new replacement', () => {
  assert.match(upload, /failed_tour_replaced/);
  assert.match(upload, /set status = 'removed'/);
  assert.match(upload, /processing_retry_at = null/);
});

test('owner retries use the same bounded backend processing configuration', () => {
  assert.match(moderation, /tour_processing_max_attempts/);
  assert.match(moderation, /processing_attempts >= max_attempts/);
});

test('all public Tour state changes and deletions emit invalidations', () => {
  assert.match(lifecycle, /trg_listing_tours_state_invalidation/);
  assert.match(lifecycle, /moderation_status, published_at/);
  assert.match(lifecycle, /trg_listing_tours_delete_invalidation/);
  assert.match(lifecycle, /'tour_state_changed'/);
  assert.match(lifecycle, /'tour_deleted'/);
});

test('cleanup and cache workers stop retry storms in dead-letter state', () => {
  assert.match(lifecycle, /'dead_lettered'/);
  assert.match(lifecycle, /dead_lettered_at/);
  assert.match(lifecycle, /attempts < 20/);
});

test('rollback removes every Tour invalidation trigger and helper', () => {
  assert.match(rollback, /trg_listing_tours_state_invalidation/);
  assert.match(rollback, /trg_listing_tours_delete_invalidation/);
  assert.match(rollback, /emit_tour_state_invalidation/);
  assert.match(rollback, /emit_tour_delete_invalidation/);
});


test('upload completion stays idempotent after processing completes', () => {
  assert.match(upload, /intent\.state in \('uploaded', 'processing', 'completed'\)/);
  assert.match(processing, /intent\.state in \('uploaded', 'processing', 'completed'\)/);
});

test('cleanup retry state remains constraint-valid and terminal failures are explicit', () => {
  assert.match(lifecycle, /then 'cleanup_failed'/);
  assert.match(lifecycle, /else coalesce\(cleanup_claimed_at, p_now\)/);
  assert.doesNotMatch(lifecycle, /when state = 'cleanup_pending' then 'authorized'/);
});

test('targeted rollbacks restore pre-milestone function and report privileges', () => {
  assert.match(processingRollback, /Restore the 0032 upload completion boundary/);
  assert.match(processingRollback, /create or replace function public\.complete_tour_upload/);
  assert.match(moderationRollback, /grant insert on table public\.reports to authenticated/);
});

test('package commands point to executable upload, processing and lifecycle smoke harnesses', async () => {
  const pkg = JSON.parse(packageJson);
  for (const [name, path] of [
    ['test:tours-upload-local', '../scripts/tours-upload-smoke-local.mjs'],
    ['test:tours-processing-local', '../scripts/tours-processing-smoke-local.mjs'],
    ['test:tours-lifecycle-local', '../scripts/tours-lifecycle-smoke-local.mjs'],
  ]) {
    assert.ok(pkg.scripts[name], `${name} is configured`);
    await access(new URL(path, import.meta.url));
  }
});

test('Tour scheduler jobs are dormant behind an explicit repository variable', async () => {
  const workflow = await read('.github/workflows/maintenance-workers.yml');
  assert.match(workflow, /FINDIT_TOURS_WORKERS_ENABLED == 'true'/);
  assert.match(workflow, /tour-processing-worker/);
  assert.match(workflow, /tour-lifecycle-cleanup/);
  assert.match(workflow, /tour-cache-invalidation/);
});

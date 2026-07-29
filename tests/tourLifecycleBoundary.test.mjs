import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [cleanupWorker, cacheWorker, playback, cleanupSql, cleanupFix, cleanupRollback, moderationSql, config] = await Promise.all([
  read('supabase/functions/tour-lifecycle-cleanup/index.ts'),
  read('supabase/functions/tour-cache-invalidation/index.ts'),
  read('supabase/functions/tour-playback-access/index.ts'),
  read('supabase/migrations/0035_v1_tour_cleanup_and_indexes.sql'),
  read('supabase/migrations/0076_tour_cleanup_claim_output_disambiguation.sql'),
  read('supabase/rollback/0076_tour_cleanup_claim_output_disambiguation.rollback.sql'),
  read('supabase/migrations/0034_v1_tour_moderation_and_reports.sql'),
  read('supabase/config.toml'),
]);

test('cleanup is service-only, idempotent and covers all three private buckets', () => {
  assert.match(cleanupWorker, /FINDIT_TOUR_CLEANUP_WORKER_SECRET/);
  assert.match(cleanupWorker, /rpc\("claim_tour_cleanup_jobs"/);
  assert.match(cleanupWorker, /rpc\("finalize_tour_cleanup_job"/);
  for (const bucket of ['tour-sources', 'tour-playback', 'tour-thumbnails']) {
    assert.match(cleanupWorker, new RegExp(bucket));
  }
  assert.match(cleanupWorker, /not.?found|does not exist|no such object/i);
  assert.match(config, /\[functions\.tour-lifecycle-cleanup\][\s\S]*?verify_jwt = false/);
});

test('cleanup claims disambiguate hosted output variables and retain a fail-closed rollback', () => {
  assert.match(cleanupFix, /#variable_conflict use_column/);
  assert.match(cleanupFix, /on conflict \(tour_id, reason\) where tour_id is not null/);
  assert.match(cleanupFix, /grant execute on function public\.claim_tour_cleanup_jobs\(integer, timestamptz\)[\s\S]*to service_role/);
  assert.doesNotMatch(cleanupFix, /grant execute[\s\S]*to anon|grant execute[\s\S]*to authenticated/);
  assert.match(cleanupRollback, /set enabled = false/);
  assert.doesNotMatch(cleanupRollback, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
});

test('parent availability and Tour replacement emit cache invalidations', () => {
  assert.match(cleanupSql, /trg_listings_tour_invalidation/);
  assert.match(cleanupSql, /trg_services_tour_invalidation/);
  assert.match(cleanupSql, /trg_tour_slots_invalidation/);
  assert.match(cleanupSql, /tour_cache_invalidations/);
  assert.match(cacheWorker, /claim_tour_cache_invalidations/);
  assert.match(cacheWorker, /finalize_tour_cache_invalidation/);
});

test('public playback signs only service-validated eligible derived assets', () => {
  assert.match(playback, /rpc\("public_tour_metadata"/);
  assert.match(playback, /tour-playback/);
  assert.match(playback, /tour-thumbnails/);
  assert.doesNotMatch(playback, /tour-sources/);
  assert.match(playback, /signedPlaybackLifetimeSeconds/);
  assert.match(config, /\[functions\.tour-playback-access\][\s\S]*?verify_jwt = false/);
});

test('reported Tours leave public eligibility and can be safely restored or rejected', () => {
  assert.match(moderationSql, /set moderation_status = 'reported', published_at = null/);
  assert.match(moderationSql, /tour_republished/);
  assert.match(moderationSql, /admin_reject_tour/);
  assert.match(moderationSql, /current_tour_id = case when current_tour_id = tour\.id then null/);
});

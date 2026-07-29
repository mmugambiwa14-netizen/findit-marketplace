import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [worker, callback, provider, runner, mediaProcessor, processingSmoke, maintenance, processingSql, config] = await Promise.all([
  read('supabase/functions/tour-processing-worker/index.ts'),
  read('supabase/functions/tour-processing-callback/index.ts'),
  read('supabase/functions/_shared/tour-provider.ts'),
  read('scripts/tour-processing-runner.mjs'),
  read('scripts/lib/tour-media-processor.mjs'),
  read('scripts/tours-processing-smoke-local.mjs'),
  read('.github/workflows/maintenance-workers.yml'),
  read('supabase/migrations/0033_v1_tour_processing_and_publication.sql'),
  read('supabase/config.toml'),
]);

test('processing is an external provider dispatch, not an Edge transcode', () => {
  assert.match(worker, /dispatchTourProcessing/);
  assert.match(worker, /createSignedUrl/);
  assert.match(worker, /createSignedUploadUrl/);
  assert.doesNotMatch(worker, /ffmpeg|spawn|Deno\.Command/i);
  assert.match(provider, /TOUR_PROCESSOR_URL/);
  assert.match(provider, /AbortSignal\.timeout\(15_000\)/);
});

test('first-party processor performs bounded FFmpeg transcoding and validated uploads', () => {
  assert.match(runner, /FINDIT_EXPECTED_PROJECT_REF/);
  assert.match(runner, /p_batch_size: batchSize\(\)/);
  assert.match(runner, /processClaimedTour/);
  assert.match(runner, /fail_tour_processing/);
  assert.match(mediaProcessor, /MAX_SOURCE_BYTES = 262_144_000/);
  assert.match(mediaProcessor, /AbortSignal\.timeout\(60_000\)/);
  assert.match(mediaProcessor, /'-c:v', 'libx264'/);
  assert.match(mediaProcessor, /'-c:a', 'aac'/);
  assert.match(mediaProcessor, /'-c:v', 'libwebp'/);
  assert.match(mediaProcessor, /probeMedia\(playbackPath\)/);
  assert.match(mediaProcessor, /finalize_tour_processing/);
  assert.match(mediaProcessor, /openAsBlob/);
  assert.doesNotMatch(mediaProcessor, /readFile\(playbackPath\)/);
  assert.match(maintenance, /npm run run:tours-processor -- --batch-size 5/);
});

test('hosted processing acceptance transcodes a real generated video', () => {
  assert.match(processingSmoke, /createSyntheticTourSource/);
  assert.match(processingSmoke, /processClaimedTour/);
  assert.match(processingSmoke, /sha256/);
  assert.doesNotMatch(processingSmoke, /finalizeTourProcessing/);
});

test('processing uses bounded database leases and idempotent finalization', () => {
  assert.match(processingSql, /for update of t skip locked/);
  assert.match(processingSql, /processing_lease_token/);
  assert.match(processingSql, /tour_processing_max_attempts\(\)/);
  assert.match(processingSql, /processing_attempts < max_attempts/);
  assert.match(processingSql, /authorize_tour_processing_callback/);
  assert.match(processingSql, /processor_job_id = coalesce/);
  assert.match(processingSql, /heartbeat_tour_processing/);
  assert.match(processingSql, /finalize_tour_processing/);
  assert.match(processingSql, /fail_tour_processing/);
  assert.match(worker, /rpc\("claim_tour_processing_jobs"/);
  assert.match(worker, /rpc\("mark_tour_processing_dispatched"/);
});

test('processor callbacks require timestamped HMAC and reject stale requests', () => {
  assert.match(callback, /x-findit-timestamp/);
  assert.match(callback, /x-findit-signature/);
  assert.match(callback, /Math\.abs\([\s\S]*\) > 300/);
  assert.match(callback, /hmacSha256Hex/);
  assert.match(callback, /constantTimeEqual/);
  assert.match(callback, /processorJobId/);
  assert.match(callback, /rpc\(\s*"authorize_tour_processing_callback"/);
  assert.match(provider, /hmacSha256Hex\(secret, `\$\{timestamp\}\.\$\{body\}`\)/);
});

test('derived outputs are independently verified before ready state', () => {
  assert.match(processingSql, /storage\.objects[\s\S]*bucket_id = 'tour-playback'/);
  assert.match(processingSql, /bucket_id = 'tour-thumbnails'/);
  assert.match(processingSql, /p_duration_seconds not between 0\.001 and 120/);
  assert.match(processingSql, /status = 'ready'/);
  assert.match(processingSql, /published_at is not null/);
  assert.match(callback, /output_validation_failed/);
});

test('worker and callback JWT settings match their custom credential boundaries', () => {
  assert.match(config, /\[functions\.tour-processing-worker\][\s\S]*?verify_jwt = false/);
  assert.match(config, /\[functions\.tour-processing-callback\][\s\S]*?verify_jwt = false/);
  assert.match(worker, /FINDIT_TOUR_PROCESSING_WORKER_SECRET/);
});

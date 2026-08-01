import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [validator, envExample, flags, config, runtime] = await Promise.all([
  readFile(new URL('../scripts/validate-env.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/featureFlags.js', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/_shared/tour-runtime.ts', import.meta.url), 'utf8'),
]);

test('browser and backend Tour switches are separate and production-default closed', () => {
  assert.match(flags, /const STAGING_BRANCH = 'feature\/listing-intelligence-foundation'/);
  assert.match(flags, /tours: flag\('VITE_FEATURE_TOURS', isStagingBranch\)/);
  assert.match(envExample, /VITE_FEATURE_TOURS=false/);
  assert.match(envExample, /TOURS_BACKEND_ENABLED=false/);
  assert.match(validator, /Tour browser or preview access cannot be enabled unless TOURS_BACKEND_ENABLED is true/);
});

test('enabling the backend requires an explicit processor mode and operational workers', () => {
  for (const name of [
    'FINDIT_TOUR_PROCESSOR_MODE',
    'FINDIT_TOUR_CLEANUP_WORKER_SECRET',
    'FINDIT_TOUR_CACHE_WORKER_SECRET',
  ]) {
    assert.match(validator, new RegExp(name));
    assert.match(envExample, new RegExp(name));
  }
  assert.match(validator, /\['github-actions', 'external'\]\.includes\(tourProcessorMode\)/);
  assert.match(validator, /FINDIT_TOURS_WORKERS_ENABLED must be true when TOURS_BACKEND_ENABLED=true/);
});

test('external processing configuration is required only for external mode', () => {
  for (const name of [
    'TOUR_PROCESSOR_URL',
    'TOUR_PROCESSOR_SECRET',
    'TOUR_PROCESSING_CALLBACK_URL',
    'FINDIT_TOUR_PROCESSING_WORKER_SECRET',
  ]) {
    assert.match(validator, new RegExp(name));
    assert.match(envExample, new RegExp(name));
  }
  assert.match(validator, /tourProcessorMode === 'external'/);
});

test('all Tour Edge functions have an explicit JWT policy', () => {
  for (const name of [
    'tour-upload-intent',
    'tour-upload-complete',
    'tour-processing-worker',
    'tour-processing-callback',
    'tour-lifecycle-cleanup',
    'tour-cache-invalidation',
    'tour-playback-access',
  ]) {
    assert.match(config, new RegExp(`\\[functions\\.${name}\\][\\s\\S]*?verify_jwt = (?:true|false)`));
  }
});


test('Tour endpoints reject non-JSON bodies at the shared boundary', () => {
  assert.match(runtime, /contentType !== \"application\/json\"/);
  assert.match(runtime, /unsupported_media_type/);
});

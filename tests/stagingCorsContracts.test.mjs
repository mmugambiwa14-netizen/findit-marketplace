import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sharedRuntime = await readFile('supabase/functions/_shared/tour-runtime.ts', 'utf8');
const recommendationRuntime = await readFile('supabase/functions/_shared/recommendation-service.ts', 'utf8');
const contextualRuntime = await readFile('supabase/functions/contextual-ecosystem/index.ts', 'utf8');
const stagingScript = await readFile('scripts/configure-staging.ps1', 'utf8');

test('canonical staging origins share one browser CORS boundary', () => {
  assert.match(sharedRuntime, /https:\/\/staging\.peekalisting\.pages\.dev/);
  assert.doesNotMatch(sharedRuntime, /vercel\.app|github\.io/);
  assert.match(recommendationRuntime, /allowedRequestOrigin/);
  assert.match(contextualRuntime, /allowedRequestOrigin/);
  assert.match(stagingScript, /\$PagesOrigin/);
  assert.doesNotMatch(stagingScript, /VercelOrigin/);
});

test('unknown browser origins still fail closed', () => {
  assert.match(sharedRuntime, /requestOriginAllowed/);
  assert.match(recommendationRuntime, /origin_not_allowed/);
  assert.match(contextualRuntime, /origin_not_allowed/);
});

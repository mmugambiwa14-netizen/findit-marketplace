import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('heavy Peek processing is isolated in a container worker', async () => {
  const dockerfile = await source('workers/media/Dockerfile');
  assert.match(dockerfile, /ffmpeg/);
  assert.match(dockerfile, /tour-processing-runner\.mjs/);
  assert.match(dockerfile, /USER node/);
  assert.doesNotMatch(dockerfile, /SUPABASE_SERVICE_ROLE_KEY\s*=/);
});

test('Cloudflare queue transport has retries, dead letters, R2 and consistent state', async () => {
  const wrangler = await source('infrastructure/cloudflare/wrangler.toml.example');
  assert.match(wrangler, /\[\[queues\.consumers\]\]/);
  assert.match(wrangler, /max_retries\s*=\s*5/);
  assert.match(wrangler, /dead_letter_queue/);
  assert.match(wrangler, /PEEK_SOURCE_MEDIA/);
  assert.match(wrangler, /PEEK_DERIVATIVE_MEDIA/);
  assert.match(wrangler, /LISTING_MEDIA/);
  assert.match(wrangler, /RateLimitCoordinator/);
});

test('Cloudflare validation pins the proven Wrangler release', async () => {
  const workflow = await source('.github/workflows/cloudflare-provisioning-gates.yml');
  assert.match(workflow, /^\s*npx --yes wrangler@4\.119\.0 deploy --dry-run/m);
  assert.doesNotMatch(workflow, /^\s*npx --yes wrangler@4(?:\s|$)/m);
});

test('queue jobs carry immutable identity and distributed trace context', async () => {
  const worker = await source('workers/edge/src/index.ts');
  assert.match(worker, /jobId/);
  assert.match(worker, /traceId/);
  assert.match(worker, /createdAt/);
  assert.match(worker, /message\.ack\(\)/);
  assert.match(worker, /message\.retry\(\)/);
});

test('Turnstile is fail-closed for origin, hostname, action and missing configuration', async () => {
  const turnstile = await source('supabase/functions/verify-turnstile/index.ts');
  assert.match(turnstile, /TURNSTILE_ALLOWED_ORIGINS/);
  assert.match(turnstile, /TURNSTILE_ALLOWED_HOSTNAMES/);
  assert.match(turnstile, /origin_not_allowed/);
  assert.match(turnstile, /hostnameMatches/);
  assert.match(turnstile, /actionMatches/);
  assert.match(turnstile, /turnstile_not_configured/);
  assert.doesNotMatch(turnstile, /access-control-allow-origin['"]:\s*['"]\*['"]/);
});

test('rollout contract preserves staged activation and rollback', async () => {
  const rollout = await source('docs/CRITICAL_HIGH_INFRASTRUCTURE_ROLLOUT.md');
  assert.match(rollout, /Nothing in this document authorizes enabling an external service/);
  assert.match(rollout, /Preview environment contract/);
  assert.match(rollout, /dead-letter behavior/);
  assert.match(rollout, /rollback/i);
});

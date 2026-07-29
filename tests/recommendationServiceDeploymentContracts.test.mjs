import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const health = await readFile('supabase/functions/recommendation-service-health/index.ts', 'utf8');
const smoke = await readFile('scripts/recommendation-services-smoke.mjs', 'utf8');
const config = await readFile('supabase/config.toml', 'utf8');

const publicFunctions = [
  'similar-listings',
  'seller-recommendations',
  'related-services',
  'related-products',
  'nearby-listings',
  'recently-listed',
  'personalized-recommendations',
];

test('health endpoint is protected by a dedicated constant-time compared secret', () => {
  assert.match(health, /FINDIT_RECOMMENDATION_HEALTH_SECRET/);
  assert.match(health, /constantTimeEqual/);
  assert.match(health, /recommendation_services_health_v1/);
  assert.match(health, /Cache-Control": "no-store/);
  assert.doesNotMatch(health, /Access-Control-Allow-Origin/);
});

test('health output contains service readiness without behavioural identities', () => {
  assert.match(health, /serviceCount/);
  assert.match(health, /enabledServices/);
  assert.match(health, /expiredCacheEntries/);
  assert.doesNotMatch(health, /actor_id|anonymous_session_id|viewerId|email|phone/i);
});

test('hosted smoke harness enforces fail-soft public services and protected personalization', () => {
  for (const functionName of publicFunctions) assert.match(smoke, new RegExp(functionName));
  assert.match(smoke, /response\.status, 200/);
  assert.match(smoke, /personalizedResponse\.status, 401/);
  assert.match(smoke, /AbortController/);
  assert.doesNotMatch(smoke, /service_role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
});

test('Supabase deployment configuration explicitly defines every recommendation function', () => {
  for (const functionName of [...publicFunctions, 'recommendation-service-health']) {
    assert.match(config, new RegExp(`\\[functions\\.${functionName}\\]`));
  }
  assert.match(config, /\[functions\.personalized-recommendations\][\s\S]*?verify_jwt = false/);
  assert.match(config, /\[functions\.recommendation-service-health\][\s\S]*?verify_jwt = false/);
});

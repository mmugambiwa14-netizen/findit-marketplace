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

test('anonymous browser recommendation functions accept opaque publishable keys at the gateway', () => {
  for (const functionName of publicFunctions.filter((name) => name !== 'personalized-recommendations')) {
    assert.match(
      config,
      new RegExp(`\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt = false`),
      `${functionName} must not require a JWT-format anon key at the gateway`,
    );
  }
  assert.match(config, /\[functions\.contextual-ecosystem\][\s\S]*?verify_jwt = false/);
});

test('personalized recommendations still require authenticated gateway access', () => {
  assert.match(
    config,
    /\[functions\.personalized-recommendations\][\s\S]*?verify_jwt = true/,
    'personalized recommendations must still require a valid Supabase session JWT',
  );
});

test('internal recommendation worker and health endpoints stay off gateway JWT verification', () => {
  for (const functionName of [
    'recommendation-maintenance',
    'recommendation-service-health',
    'contextual-ecosystem-health',
  ]) {
    assert.match(
      config,
      new RegExp(`\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt = false`),
      `${functionName} authenticates with its own worker secret, not a Supabase JWT`,
    );
  }
});

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
  assert.match(smoke, /contextual-ecosystem/);
  assert.match(smoke, /method: 'OPTIONS'/);
  assert.match(smoke, /Origin/);
  assert.match(smoke, /x-client-info/);
  assert.match(smoke, /supabase\.functions\.invoke/);
  assert.match(smoke, /error, null/);
  assert.match(smoke, /\[401, 403\]\.includes\(personalizedResponse\.status\)/);
  assert.match(smoke, /AbortController/);
  assert.doesNotMatch(smoke, /service_role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
});

test('smoke harness requires an explicit hosted target and dedicated health credential', () => {
  assert.match(smoke, /FINDIT_RECOMMENDATION_SMOKE_URL/);
  assert.match(smoke, /FINDIT_SUPABASE_ANON_KEY/);
  assert.match(smoke, /FINDIT_RECOMMENDATION_HEALTH_SECRET/);
  assert.match(smoke, /process\.exit\(2\)/);
});

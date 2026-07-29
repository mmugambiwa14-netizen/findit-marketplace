import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const certification = await readFile(
  new URL('../scripts/recommendation-phase7-staging-certification.mjs', import.meta.url),
  'utf8',
);

test('Phase 7 hosted certification is exact-target guarded and reversible', () => {
  assert.match(certification, /assertSmokeTarget/);
  assert.match(certification, /hosted staging/);
  assert.match(certification, /FINDIT_EXPECTED_PROJECT_REF/);
  assert.match(certification, /FINDIT_ALLOW_STAGING_FOUNDER_SESSION/);
  assert.match(certification, /initialPolicies/);
  assert.match(certification, /updatePolicy\(policy, policy\.enabled, policy\.configuration\)/);
  assert.match(certification, /recommendation_request_budget/);
  assert.match(certification, /delete from public\.recommendation_events/);
  assert.match(certification, /deleteUser\(ownerId\)/);
});

test('Phase 7 certifies every remaining transport through browser and PostgREST boundaries', () => {
  for (const path of [
    'similar-listings',
    'seller-recommendations',
    'related-services',
    'related-products',
    'nearby-listings',
  ]) {
    assert.match(certification, new RegExp(`path: '${path}'`));
  }
  assert.match(certification, /preflight\(definition\.path\)/);
  assert.match(certification, /anonymous[\s\S]*\.from\('services'\)/);
  assert.match(certification, /anonymous[\s\S]*\.from\('listings'\)/);
  assert.match(certification, /request_budget_exhausted/);
  assert.match(certification, /record_recommended_service_event_v1/);
  assert.match(certification, /record_recommendation_event/);
});

test('Phase 7 certifies consent and aggregate-only analytics without exposing identities', () => {
  assert.match(certification, /personalization_not_enabled/);
  assert.match(certification, /set_my_recommendation_personalization_v1/);
  assert.match(certification, /clear_my_recommendation_personalization_data_v1/);
  assert.match(certification, /admin_recommendation_analytics_v1/);
  assert.match(certification, /actor_id\|anonymous_session_id\|listing_id\|seller_id\|recommendation_request_id/);
  assert.match(certification, /canonical listing/);
});

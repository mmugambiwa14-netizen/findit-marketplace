import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const foundation = await readFile('supabase/migrations/0063_contextual_ecosystem_intelligence.sql', 'utf8');
const hardening = await readFile('supabase/migrations/0064_contextual_rule_identity_and_admin.sql', 'utf8');
const edge = await readFile('supabase/functions/contextual-ecosystem/index.ts', 'utf8');
const sharedRuntime = await readFile('supabase/functions/_shared/tour-runtime.ts', 'utf8');
const client = await readFile('src/services/contextualEcosystemService.js', 'utf8');

test('contextual intelligence orchestrates existing services without executing them', () => {
  assert.match(foundation, /contextual_ecosystem_plan_v1/);
  assert.match(foundation, /orchestration_executes_services', false/);
  assert.doesNotMatch(foundation, /personalized_recommendation_service/);
  assert.doesNotMatch(foundation, /perform public\.(similar|seller|related|nearby|recently)/i);
});

test('context rules are deterministic, explainable and null-safe', () => {
  assert.match(foundation, /reason_code text not null/);
  assert.match(foundation, /order by context_priority, rule_priority, service_name/);
  assert.match(hardening, /nulls not distinct/);
  assert.match(hardening, /is not distinct from p_source_node_id/);
});

test('context-rule administration is audited and admin-only', () => {
  assert.match(hardening, /if not public\.is_admin\(\)/);
  assert.match(hardening, /recommendation_configuration_audit/);
  assert.match(hardening, /write_audit_log/);
  assert.match(hardening, /octet_length\(coalesce\(p_conditions/);
});

test('edge service validates bounded public input and fails softly', () => {
  assert.match(edge, /REQUEST_TIMEOUT_MS = 900/);
  assert.match(edge, /maxSections < 1 \|\| maxSections > 12/);
  assert.match(edge, /invalid_journey_stage/);
  assert.match(edge, /return json\(request, 200, degraded/);
  assert.match(edge, /contractVersion: 2/);
  assert.match(edge, /subjectListingId/);
  assert.match(edge, /\.abortSignal\(controller\.signal\)/);
  assert.doesNotMatch(edge, /\}, \{ signal: controller\.signal \}/);
});

test('contextual browser CORS accepts Supabase client headers and opaque publishable keys', async () => {
  const config = await readFile('supabase/config.toml', 'utf8');
  const corsBoundary = `${edge}\n${sharedRuntime}`;
  assert.match(corsBoundary, /authorization, apikey, content-type, x-client-info/);
  assert.match(corsBoundary, /Access-Control-Allow-Methods": "POST, OPTIONS"/);
  assert.match(corsBoundary, /Vary": "Origin"/);
  assert.match(config, /\[functions\.contextual-ecosystem\][\s\S]*?verify_jwt = false/);
});

test('frontend adapter never throws into listing delivery', () => {
  assert.match(client, /emptyResult/);
  assert.match(client, /catch \{/);
  assert.match(client, /sections: \[\]/);
  assert.match(client, /AbortController/);
  assert.doesNotMatch(client, /throw new Error/);
});

test('Phase 3 selects on listing state, service availability and taxonomy precedence', async () => {
  const completion = await readFile('supabase/migrations/0068_contextual_ecosystem_completion.sql', 'utf8');
  const statusTypeSafety = await readFile('supabase/migrations/0070_contextual_listing_status_type_safety.sql', 'utf8');

  // A disabled service can only answer empty, so it is never contextually relevant.
  assert.match(completion, /join public\.recommendation_service_policies policy/);
  assert.match(completion, /and policy\.enabled/);

  // Listing-state gates test presence only; no coordinate, price or seller value
  // leaves the orchestrator.
  assert.match(completion, /subject_has_location/);
  assert.match(completion, /subject_has_price/);
  assert.match(completion, /subject_has_seller_inventory/);
  assert.match(completion, /requires_location/);

  // Specificity is explicit: subcategory beats category beats global, and every
  // remaining tie is broken deterministically.
  assert.match(completion, /when node\.node_type = 'subcategory'/);
  assert.match(completion, /order by candidate\.service_name, candidate\.specificity, candidate\.rule_priority/);
  assert.match(completion, /'precedence'/);

  assert.match(completion, /'contractVersion', 2/);
  assert.doesNotMatch(completion, /personalized_recommendation_service/);
  assert.match(statusTypeSafety, /subject_row\.listing_status::text in/);
  assert.doesNotMatch(statusTypeSafety, /subject_row\.listing_status in/);
});

test('contextual rule conditions are validated against a closed vocabulary', async () => {
  const completion = await readFile('supabase/migrations/0068_contextual_ecosystem_completion.sql', 'utf8');
  assert.match(completion, /contextual_condition_keys_v1/);
  assert.match(completion, /contextual_conditions_valid_v1/);
  assert.match(completion, /recommendation_context_rules_conditions_vocabulary/);
});

test('contextual health is internal, counts only, and never a browser API', async () => {
  const completion = await readFile('supabase/migrations/0068_contextual_ecosystem_completion.sql', 'utf8');
  const healthEdge = await readFile('supabase/functions/contextual-ecosystem-health/index.ts', 'utf8');
  const config = await readFile('supabase/config.toml', 'utf8');

  assert.match(completion, /contextual_ecosystem_health_v1/);
  assert.match(completion, /revoke all on function public\.contextual_ecosystem_health_v1\(\) from public, anon, authenticated;/);

  const healthBody = completion.slice(completion.indexOf('contextual_ecosystem_health_v1()'));
  assert.doesNotMatch(healthBody.slice(0, healthBody.indexOf('$$;')), /seller_id|actor_id|email/);

  assert.match(healthEdge, /FINDIT_CONTEXTUAL_HEALTH_SECRET/);
  assert.match(healthEdge, /constantTimeEqual/);
  assert.match(healthEdge, /"Cache-Control": "no-store"/);
  assert.match(config, /\[functions\.contextual-ecosystem-health\][\s\S]*?verify_jwt = false/);
});

test('the contextual plan is only cached when it is complete', async () => {
  assert.match(edge, /CACHEABLE_PLAN/);
  assert.match(edge, /function headers\(request: Request, cacheControl: string = "no-store"\)/);
  // A rejected request and a fail-soft empty plan must not be retained by a shared
  // cache, or a transient outage outlives the recovery.
  assert.match(edge, /return json\(request, 200, degraded\(correlationId, "service_unavailable", body\.subjectListingId\)\);/);
});

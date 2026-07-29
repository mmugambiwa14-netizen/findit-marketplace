import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const foundation = await readFile('supabase/migrations/0063_contextual_ecosystem_intelligence.sql', 'utf8');
const hardening = await readFile('supabase/migrations/0064_contextual_rule_identity_and_admin.sql', 'utf8');
const edge = await readFile('supabase/functions/contextual-ecosystem/index.ts', 'utf8');
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
  assert.match(edge, /subjectListingId/);
});

test('frontend adapter never throws into listing delivery', () => {
  assert.match(client, /emptyResult/);
  assert.match(client, /catch \{/);
  assert.match(client, /sections: \[\]/);
  assert.match(client, /AbortController/);
  assert.doesNotMatch(client, /throw new Error/);
});

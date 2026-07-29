import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, config, workflow, envExample, validator] = await Promise.all([
  readFile(new URL('../supabase/functions/recommendation-maintenance/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/maintenance-workers.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/validate-env.mjs', import.meta.url), 'utf8'),
]);

test('recommendation maintenance is an explicitly internal endpoint', () => {
  assert.match(config, /\[functions\.recommendation-maintenance\][\s\S]*?verify_jwt = false/);
  assert.match(worker, /FINDIT_RECOMMENDATION_WORKER_SECRET/);
  assert.match(worker, /constantTimeEqual/);
  assert.match(worker, /contentType !== "application\/json"/);
  assert.match(worker, /contentLength > 4096/);
  assert.doesNotMatch(worker, /error\.message|String\(error\)/);
});

test('projection and maintenance operations are separately bounded', () => {
  assert.match(worker, /type MaintenanceMode = "projection" \| "maintenance" \| "all"/);
  assert.match(worker, /boundedInteger\(body\.projectionLimit, 200, 1, 500\)/);
  assert.match(worker, /boundedInteger\(body\.projectionMaxAttempts, 8, 1, 20\)/);
  assert.match(worker, /boundedInteger\(body\.retentionLimit, 5000, 1, 50_000\)/);
  assert.match(worker, /process_listing_recommendation_projection_jobs/);
  assert.match(worker, /ensure_recommendation_event_partition/);
  assert.match(worker, /refresh_recommendation_popularity_daily/);
  assert.match(worker, /purge_expired_recommendation_data/);
  assert.match(worker, /recommendation_foundation_health/);
  assert.doesNotMatch(worker, /recommendation_events.*select|actor_id|anonymous_session_id|context:/);
});

test('scheduler remains opt-in and separates fast projection from daily maintenance', () => {
  assert.match(workflow, /FINDIT_RECOMMENDATION_WORKERS_ENABLED == 'true'/);
  assert.match(workflow, /secrets\.FINDIT_RECOMMENDATION_WORKER_SECRET/);
  assert.match(workflow, /"\*\/5 \* \* \* \*"/);
  assert.match(workflow, /"11 3 \* \* \*"/);
  assert.match(workflow, /"mode":"projection"/);
  assert.match(workflow, /"mode":"maintenance"/);
  assert.match(envExample, /FINDIT_RECOMMENDATION_WORKERS_ENABLED=false/);
  assert.match(envExample, /FINDIT_RECOMMENDATION_WORKER_SECRET=replace-with-random-secret/);
  assert.match(validator, /FINDIT_RECOMMENDATION_WORKER_SECRET is required when recommendation workers are enabled/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [worker, migration, rollback, config, stagingWorkflow, productionWorkflow, envExample, validator] = await Promise.all([
  read('supabase/functions/platform-maintenance/index.ts'),
  read('supabase/migrations/20260819150000_schedule_platform_maintenance.sql'),
  read('supabase/rollback/20260819150000_schedule_platform_maintenance.rollback.sql'),
  read('supabase/config.toml'),
  read('.github/workflows/maintenance-workers.yml'),
  read('.github/workflows/maintenance-workers-production.yml'),
  read('.env.example'),
  read('scripts/validate-env.mjs'),
]);

test('platform maintenance is a trusted bounded worker', () => {
  assert.match(config, /\[functions\.platform-maintenance\][\s\S]*?verify_jwt = false/);
  assert.match(worker, /FINDIT_PLATFORM_MAINTENANCE_WORKER_SECRET/);
  assert.match(worker, /authorizeWorker/);
  assert.match(worker, /MAX_LIMIT = 500/);
  assert.match(worker, /admin\.rpc\(name, args\)/);
  assert.doesNotMatch(worker, /error\.message|String\(error\)/);
});

test('platform maintenance invokes every previously unscheduled bounded operation', () => {
  for (const name of [
    'expire_stale_peek_request_fulfilments',
    'prune_abuse_rate_limit_buckets',
    'purge_recommendation_request_budget_v1',
    'retry_recommendation_projection_dead_letters',
    'recommendation_analytics_health_v1',
  ]) assert.match(worker, new RegExp(name));
  assert.match(migration, /retry_recommendation_projection_dead_letters/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /grant execute on function public\.retry_recommendation_projection_dead_letters\(integer\)[\s\S]*to service_role/);
  assert.match(rollback, /drop function if exists public\.retry_recommendation_projection_dead_letters\(integer\)/);
  assert.doesNotMatch(rollback, /drop table|delete from/i);
});

test('staging and production schedules carry the platform maintenance secret boundary', () => {
  assert.match(stagingWorkflow, /platform-maintenance/);
  assert.match(stagingWorkflow, /secrets\.FINDIT_PLATFORM_MAINTENANCE_WORKER_SECRET/);
  assert.match(productionWorkflow, /PLATFORM_MAINTENANCE_SECRET/);
  assert.match(productionWorkflow, /FINDIT_PLATFORM_MAINTENANCE_WORKERS_ENABLED/);
  assert.match(envExample, /FINDIT_PLATFORM_MAINTENANCE_WORKERS_ENABLED=false/);
  assert.match(envExample, /FINDIT_PLATFORM_MAINTENANCE_WORKER_SECRET=replace-with-random-secret/);
  assert.match(validator, /FINDIT_PLATFORM_MAINTENANCE_WORKER_SECRET is required/);
});

test('the disposable email hook is enabled in local Auth configuration', () => {
  assert.match(config, /\[auth\.hook\.before_user_created\][\s\S]*?enabled = true[\s\S]*?pg-functions:\/\/postgres\/public\/before_user_created_hook/);
});

import assert from 'node:assert/strict';
import {
  createSmokeUser,
  invokeFunction,
  root,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';

const workerSecret = process.env.FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET;
if (!workerSecret) throw new Error('FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET is required for the observability smoke test.');

let admin;
let user;
const dimension = 'release-smoke';

try {
  admin = await createSmokeUser('tour-health-admin', 'admin');
  user = await createSmokeUser('tour-health-user');

  const directUserRead = await user.browser.from('operational_metric_buckets').select('*').limit(1);
  assert.ok(directUserRead.error, 'ordinary authenticated users cannot read raw operational buckets');

  for (let index = 0; index < 5; index += 1) {
    success(await root.rpc('record_operational_metric', {
      p_metric_name: 'feed_failed',
      p_value: 1,
      p_dimension: dimension,
      p_sample_count: 1,
      p_metadata: { code: 'release_smoke' },
      p_occurred_at: new Date().toISOString(),
    }), `record feed failure metric ${index + 1}`);
  }
  success(await root.rpc('record_operational_metric', {
    p_metric_name: 'feed_latency_ms',
    p_value: 2501,
    p_dimension: dimension,
    p_sample_count: 1,
    p_metadata: {},
    p_occurred_at: new Date().toISOString(),
  }), 'record feed latency metric');

  const unauthorized = await invokeFunction('tour-observability-monitor', {
    authorization: 'Bearer invalid-observability-secret',
  });
  assert.equal(unauthorized.response.status, 401, 'observability worker rejects an invalid scheduler credential');

  const evaluated = await invokeFunction('tour-observability-monitor', {
    authorization: `Bearer ${workerSecret}`,
  });
  assert.equal(evaluated.response.status, 200, `observability evaluation failed: ${JSON.stringify(evaluated.body)}`);
  assert.equal(evaluated.body.evaluated, true);

  const nonAdminHealth = await user.browser.rpc('admin_operational_health', { p_hours: 24 });
  assert.ok(nonAdminHealth.error, 'non-admin users cannot read the founder operational health snapshot');

  const health = success(await admin.browser.rpc('admin_operational_health', { p_hours: 24 }), 'read founder operational health');
  assert.ok(Array.isArray(health.open_alerts), 'health snapshot includes open alerts');
  assert.ok(health.open_alerts.some((alert) => alert.key === 'tour_feed_failures'), 'deterministic feed failure alert opens at threshold');
  assert.ok(Number(health.metrics?.feed_latency_ms?.maximum ?? 0) >= 2501, 'health snapshot aggregates feed latency');
  assert.ok(health.queues && health.storage, 'health snapshot includes worker queues and retained storage');

  console.log(`Tours ${smokeTarget.label} observability smoke passed: private hourly metrics, worker authentication, deterministic alerts, admin-only health and bounded retention.`);
} finally {
  try {
    await root.from('operational_metric_buckets').delete().eq('dimension', dimension);
    await root.rpc('evaluate_operational_alerts', { p_now: new Date().toISOString() });
  } catch { /* best effort */ }
  for (const principal of [admin, user].filter(Boolean)) {
    try { await principal.browser.auth.signOut(); } catch { /* best effort */ }
    try { await root.auth.admin.deleteUser(principal.userId); } catch { /* best effort */ }
  }
}

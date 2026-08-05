import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const [migration, recommendation, migrationWorkflow, recommendationWorkflow] = await Promise.all([
  readFile(new URL('../scripts/run-migration-database-certification.sh', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/run-recommendation-database-certification.sh', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/migration-gates.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/recommendation-database-gates.yml', import.meta.url), 'utf8'),
]);

const suitesOnDisk = (await readdir(new URL('../supabase/tests/', import.meta.url)))
  .filter((name) => name.endsWith('.sql'))
  .sort();

function certifiedSuites(source) {
  const block = source.match(/TEST_FILES=\(\r?\n([\s\S]*?)\r?\n\)/)?.[1] || '';
  return block
    .split('\n')
    .map((line) => line.trim().match(/^supabase\/tests\/(.+\.sql)$/)?.[1])
    .filter(Boolean);
}

test('migration certification is pinned and self-cleaning', () => {
  assert.match(migration, /SUPABASE_CLI_VERSION="2\.84\.2"/);
  assert.match(migration, /trap cleanup EXIT/);
  assert.match(migration, /db lint --local --level error/);
  assert.match(migrationWorkflow, /bash \.\/scripts\/run-migration-database-certification\.sh/);
  assert.doesNotMatch(migrationWorkflow, /test db supabase\/tests\//);
});

// This replaces a hardcoded suite count. The count was a proxy for "the
// certification runs every pgTAP suite", but it could only ever detect that the
// number had changed -- not which suites were missing. It drifted, and while it
// was drifting eleven suites (including v1_rls_matrix.sql and
// v1_function_privilege_matrix.sql) existed on disk and were run by nothing.
// Comparing against the directory states the real requirement and names any gap.
test('migration certification runs every pgTAP suite in supabase/tests', () => {
  const certified = certifiedSuites(migration);
  const uncertified = suitesOnDisk.filter((name) => !certified.includes(name));

  assert.deepEqual(
    uncertified,
    [],
    `pgTAP suites exist but are never executed: ${uncertified.join(', ')}`,
  );
});

test('migration certification does not reference a suite that no longer exists', () => {
  const certified = certifiedSuites(migration);
  const orphaned = certified.filter((name) => !suitesOnDisk.includes(name));

  assert.deepEqual(
    orphaned,
    [],
    `certification references missing suites: ${orphaned.join(', ')}`,
  );
});

test('security-critical suites are named explicitly in the certification', () => {
  // Losing any of these silently would remove the database half of the
  // authorization boundary from CI, so they are asserted by name as well as by
  // the exhaustiveness check above.
  for (const suite of [
    'v1_rls_matrix.sql',
    'v1_function_privilege_matrix.sql',
    'database_auth_rls_smoke.sql',
    'v1_private_authenticated_rpc_implementations.sql',
    'v1_security_advisor_baseline.sql',
    'mvp_listing_location_privacy.sql',
  ]) {
    assert.ok(
      certifiedSuites(migration).includes(suite),
      `${suite} must be part of the migration certification`,
    );
  }
});

test('recommendation certification uses the same clean database contract', () => {
  assert.match(recommendation, /SUPABASE_CLI_VERSION="2\.84\.2"/);
  assert.match(recommendation, /trap cleanup EXIT/);
  assert.match(recommendation, /db lint --local --level error/);
  assert.match(recommendation, /v1_private_authenticated_rpc_implementations\.sql/);
  assert.match(recommendation, /v1_security_advisor_baseline\.sql/);
  assert.match(recommendation, /v1_recommendation_related_services\.sql/);
  assert.match(recommendationWorkflow, /bash \.\/scripts\/run-recommendation-database-certification\.sh/);
  assert.doesNotMatch(recommendationWorkflow, /test db supabase\/tests\//);
});

// The recommendation gate is a deliberate subset -- it certifies the
// recommendation surface on its own. Asserting it is a *subset* keeps it honest
// without pinning a count that drifts every time a suite is added.
test('recommendation certification is a real subset of the suites on disk', () => {
  const certified = certifiedSuites(recommendation);

  assert.ok(certified.length > 0, 'recommendation certification runs no suites');
  const orphaned = certified.filter((name) => !suitesOnDisk.includes(name));
  assert.deepEqual(orphaned, [], `recommendation certification references missing suites: ${orphaned.join(', ')}`);

  for (const suite of certified) {
    assert.match(suite, /\.sql$/);
  }
});

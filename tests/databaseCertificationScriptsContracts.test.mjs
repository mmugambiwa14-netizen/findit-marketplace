import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [migration, recommendation, migrationWorkflow, recommendationWorkflow] = await Promise.all([
  readFile(new URL('../scripts/run-migration-database-certification.sh', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/run-recommendation-database-certification.sh', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/migration-gates.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/recommendation-database-gates.yml', import.meta.url), 'utf8'),
]);

function suiteCount(source) {
  const block = source.match(/TEST_FILES=\(\r?\n([\s\S]*?)\r?\n\)/)?.[1] || '';
  return block.split('\n').filter((line) => /supabase\/tests\/.+\.sql/.test(line)).length;
}

test('migration certification is pinned, exhaustive and self-cleaning', () => {
  assert.match(migration, /SUPABASE_CLI_VERSION="2\.84\.2"/);
  assert.match(migration, /trap cleanup EXIT/);
  assert.match(migration, /db lint --local --level error/);
  assert.match(migration, /v1_private_authenticated_rpc_implementations\.sql/);
  assert.match(migration, /v1_security_advisor_baseline\.sql/);
  assert.match(migration, /v1_curated_business_marketplace\.sql/);
  assert.equal(suiteCount(migration), 37);
  assert.match(migrationWorkflow, /bash \.\/scripts\/run-migration-database-certification\.sh/);
  assert.doesNotMatch(migrationWorkflow, /test db supabase\/tests\//);
});

test('recommendation certification uses the same clean database contract', () => {
  assert.match(recommendation, /SUPABASE_CLI_VERSION="2\.84\.2"/);
  assert.match(recommendation, /trap cleanup EXIT/);
  assert.match(recommendation, /db lint --local --level error/);
  assert.match(recommendation, /v1_private_authenticated_rpc_implementations\.sql/);
  assert.match(recommendation, /v1_security_advisor_baseline\.sql/);
  assert.match(recommendation, /v1_recommendation_related_services\.sql/);
  assert.equal(suiteCount(recommendation), 15);
  assert.match(recommendationWorkflow, /bash \.\/scripts\/run-recommendation-database-certification\.sh/);
  assert.doesNotMatch(recommendationWorkflow, /test db supabase\/tests\//);
});

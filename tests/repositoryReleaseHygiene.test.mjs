import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [packageJsonText, workflow, stagingWorkflow, certification, hygiene, sqlBoundary] = await Promise.all([
  read('package.json'),
  read('.github/workflows/release-candidate-gates.yml'),
  read('.github/workflows/tours-staging-acceptance.yml'),
  read('scripts/tours-release-certification.mjs'),
  read('scripts/verify-repository-hygiene.mjs'),
  read('scripts/verify-sql-boundary.mjs'),
]);

const packageJson = JSON.parse(packageJsonText);

test('release candidate exposes repository hygiene and SQL boundary gates', () => {
  assert.equal(packageJson.scripts['verify:hygiene'], 'node ./scripts/verify-repository-hygiene.mjs');
  assert.equal(packageJson.scripts['verify:sql-boundary'], 'node ./scripts/verify-sql-boundary.mjs');
  assert.match(workflow, /npm run verify:hygiene/);
  assert.match(workflow, /npm run verify:sql-boundary/);
  assert.match(stagingWorkflow, /npm run verify:hygiene/);
  assert.match(stagingWorkflow, /npm run verify:sql-boundary/);
  assert.match(certification, /Repository hygiene/);
  assert.match(certification, /SQL boundary/);
  assert.equal(packageJson.scripts['audit:product-surface'], 'node ./scripts/audit-product-surface.mjs');
  assert.match(workflow, /npm run audit:product-surface/);
  assert.match(stagingWorkflow, /npm run audit:product-surface/);
  assert.match(certification, /Product surface audit/);
});

test('hygiene gate checks pictographic symbols, merge markers and high-confidence secrets', () => {
  assert.match(hygiene, /prohibitedUnicodeRanges/);
  assert.match(hygiene, /unresolved merge-conflict marker/);
  assert.match(hygiene, /PRIVATE KEY/);
  assert.match(hygiene, /GitHub token/);
  assert.match(hygiene, /AWS access key/);
});

test('SQL gate requires a contiguous migration sequence and safe recent rollbacks', () => {
  assert.match(sqlBoundary, /migration sequence expected/);
  assert.match(sqlBoundary, /missing rollback pair/);
  assert.match(sqlBoundary, /unbalanced/);
  assert.match(sqlBoundary, /destructive table\/data rollback statements/);
  assert.match(sqlBoundary, /0046_mvp_foundation_countries_currency_publication\.sql/);
});

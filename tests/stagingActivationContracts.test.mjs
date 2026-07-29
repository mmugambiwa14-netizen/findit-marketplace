import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [activation, workflow, packageJson, smokeFixtures] = await Promise.all([
  readFile(new URL('../scripts/activate-staging-capabilities.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/tours-staging-acceptance.yml', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/lib/tour-smoke-fixtures.mjs', import.meta.url), 'utf8'),
]);

test('staging capability activation is exact-target guarded and reversible on failure', () => {
  assert.match(activation, /FINDIT_ALLOW_STAGING_ACTIVATION !== 'staging'/);
  assert.match(activation, /expectedProjectRef/);
  assert.match(activation, /target\.label !== 'hosted staging'/);
  assert.match(activation, /initialTourControl/);
  assert.match(activation, /initialPolicies/);
  assert.match(activation, /catch \(error\)[\s\S]*p_enabled: policy\.enabled/);
  assert.match(activation, /p_enabled: initialTourControl\?\.enabled \?\? false/);
});

test('hosted moderation tests borrow and preserve the single staging founder', () => {
  assert.match(smokeFixtures, /role === 'admin' && smokeTarget\.label === 'hosted staging'/);
  assert.match(smokeFixtures, /FINDIT_ALLOW_STAGING_FOUNDER_SESSION !== 'staging'/);
  assert.match(smokeFixtures, /staging must have exactly one founder admin/);
  assert.match(smokeFixtures, /preserveUser: true/);
  assert.match(smokeFixtures, /user\.userId && !user\.preserveUser/);
});

test('activation leaves Peek and all seven recommendation policies active', () => {
  assert.match(activation, /p_feature_key: 'tours'/);
  assert.match(activation, /p_enabled: true/);
  assert.match(activation, /initialPolicies\.length, 7/);
  assert.match(activation, /activePolicies\.every\(\(policy\) => policy\.enabled\)/);
});

test('hosted acceptance activates capabilities only after lifecycle and scale gates', () => {
  const activationIndex = workflow.indexOf('npm run activate:staging-capabilities');
  assert.ok(activationIndex > workflow.indexOf('npm run test:tours-processing-hosted'));
  assert.ok(activationIndex > workflow.indexOf('npm run test:tours-observability-hosted'));
  assert.match(workflow, /FINDIT_ALLOW_STAGING_ACTIVATION: staging/);
  assert.equal(JSON.parse(packageJson).scripts['activate:staging-capabilities'], 'node ./scripts/activate-staging-capabilities.mjs');
});

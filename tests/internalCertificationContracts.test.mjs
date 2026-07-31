import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [certification, releaseWorkflow, acceptanceWorkflow] = await Promise.all([
  readFile(new URL('../scripts/internal-certification.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/release-candidate-gates.yml', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/tours-staging-acceptance.yml', import.meta.url), 'utf8'),
]);

test('internal certification requires both gate success and an unchanged source tree', () => {
  assert.match(certification, /const sourceExact = gitStatus !== null && gitStatusEntries\.length === 0/);
  assert.match(certification, /certified: gatesPassed && sourceExact/);
  assert.match(certification, /working tree differs from the requested commit/);
  assert.match(certification, /verify:package-lock-normalized/);
  assert.match(certification, /generate:dependency-inventory/);
  assert.match(certification, /verify:workflow-pinning/);
  assert.match(certification, /deploymentConfigurationSha256/);
  assert.match(certification, /mapProviderSha256/);
});

test('release and staging acceptance retain certification evidence', () => {
  for (const workflow of [releaseWorkflow, acceptanceWorkflow]) {
    assert.match(workflow, /artifacts\/certification\/internal-certification\.json/);
    assert.match(workflow, /artifacts\/certification\/dependency-inventory\.json/);
    assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
    assert.match(workflow, /retention-days: 90/);
  }
});

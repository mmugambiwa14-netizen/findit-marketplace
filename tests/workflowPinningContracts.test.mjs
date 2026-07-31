import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const approved = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['denoland/setup-deno', '22d081ff2d3a40755e97629de92e3bcbfa7cf2ed'],
  ['actions/configure-pages', '45bfe0192ca1faeb007ade9deae92b16b8254a0d'],
  ['actions/upload-pages-artifact', 'fc324d3547104276b827a68afc52ff2a11cc49c9'],
  ['actions/deploy-pages', 'cd2ce8fcbc39b97be8ca5fce6e763baed58fa128'],
  ['actions/upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
]);

test('all workflow actions use the approved immutable commits', async () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  const fileNames = (await readdir(directory)).filter((name) => /\.ya?ml$/i.test(name));
  let inspected = 0;

  for (const fileName of fileNames) {
    const source = await readFile(new URL(fileName, directory), 'utf8');
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gm)) {
      inspected += 1;
      const reference = match[1];
      if (reference.startsWith('./')) continue;
      const separator = reference.lastIndexOf('@');
      assert.ok(separator > 0, `${fileName}: missing action ref`);
      const action = reference.slice(0, separator);
      const ref = reference.slice(separator + 1);
      assert.equal(ref, approved.get(action), `${fileName}: unapproved or mutable ref for ${action}`);
      assert.match(ref, /^[0-9a-f]{40}$/);
    }
  }

  assert.ok(inspected > 0, 'expected workflow action references');
});

test('workflow verifier contains the same immutable allowlist', async () => {
  const source = await readFile(new URL('../scripts/verify-workflow-pinning.mjs', import.meta.url), 'utf8');
  for (const [action, sha] of approved) {
    assert.match(source, new RegExp(action.replace('/', '\\/')));
    assert.match(source, new RegExp(sha));
  }
  assert.match(source, /40-character commit SHA/);
});

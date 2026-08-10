import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const workflowsDirectory = new URL('../.github/workflows/', import.meta.url);

function lineIndex(source, pattern) {
  return source.split('\n').findIndex((line) => pattern.test(line));
}

test('every locked workflow install normalizes the package lock first', async () => {
  const fileNames = (await readdir(workflowsDirectory)).filter((name) => /\.ya?ml$/i.test(name));
  let installPaths = 0;

  for (const fileName of fileNames) {
    const source = await readFile(new URL(fileName, workflowsDirectory), 'utf8');
    if (!/\bnpm ci\b/.test(source)) continue;
    installPaths += 1;

    const normalization = lineIndex(source, /node \.\/scripts\/normalize-package-lock\.mjs --write/);
    const setupNode = lineIndex(source, /uses: actions\/setup-node@/);
    const lockedInstall = lineIndex(source, /\bnpm ci\b/);
    assert.ok(normalization >= 0, `${fileName}: missing package-lock normalization`);
    assert.ok(setupNode >= 0, `${fileName}: missing pinned setup-node action`);
    assert.ok(lockedInstall >= 0, `${fileName}: missing locked install`);
    assert.ok(normalization < setupNode, `${fileName}: normalize before setup-node cache resolution`);
    assert.ok(setupNode < lockedInstall, `${fileName}: setup Node before npm ci`);
  }

  // Pinned deliberately so npm-ci detection cannot pass vacuously. The unified
  // certification workflow adds the fourteenth currently locked install path.
  assert.equal(installPaths, 14, 'all fourteen npm-ci workflow paths must be covered');
});

test('normalizer synchronizes the manifest boundary and removes retired packages', async () => {
  const source = await readFile(new URL('../scripts/normalize-package-lock.mjs', import.meta.url), 'utf8');
  assert.match(source, /\['name', 'version', 'dependencies', 'devDependencies', 'engines'\]/);
  assert.match(source, /node_modules\/leaflet/);
  assert.match(source, /node_modules\/@types\/leaflet/);
  assert.match(source, /package-lock\.json matches the manifest/);
  assert.doesNotMatch(source, /structuredClone/);
});

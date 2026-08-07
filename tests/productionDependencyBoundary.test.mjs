import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('Tailwind build tooling is dev-only', () => {
  for (const name of ['tailwindcss', 'tailwindcss-animate', 'postcss', 'autoprefixer', 'vite']) {
    assert.equal(pkg.dependencies?.[name], undefined, `${name} must not be a production dependency`);
    assert.ok(pkg.devDependencies?.[name], `${name} must remain available to the build toolchain`);
  }
});

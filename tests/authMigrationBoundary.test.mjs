import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = join(repositoryRoot, 'src');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.js', '.jsx'].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

test('Base44 client consumers contain no remaining Base44 auth operations', async () => {
  const violations = [];

  for (const file of await sourceFiles(sourceRoot)) {
    const source = await readFile(file, 'utf8');
    if (source.includes('@/api/base44Client') && /\bbase44\.auth\./.test(source)) {
      violations.push(relative(repositoryRoot, file).replaceAll('\\', '/'));
    }
  }

  assert.deepEqual(violations, []);
});

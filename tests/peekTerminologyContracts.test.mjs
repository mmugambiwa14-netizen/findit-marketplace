import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const roots = ['src/components', 'src/pages'];
const extensions = new Set(['.js', '.jsx']);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'admin') continue;
      files.push(...await sourceFiles(path));
      continue;
    }
    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    if (extensions.has(extension)) files.push(path);
  }
  return files;
}

test('customer-facing source uses Peek instead of Tour terminology', async () => {
  const failures = [];
  for (const root of roots) {
    for (const path of await sourceFiles(root)) {
      const content = await readFile(path, 'utf8');
      content.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') || trimmed.includes('import(')) return;
        if (!/['"`][^'"`]*\bTours?\b[^'"`]*['"`]/.test(line)) return;
        failures.push(`${path}:${index + 1}: ${trimmed}`);
      });
    }
  }

  assert.deepEqual(failures, [], `Customer UI still exposes Tour terminology:\n${failures.join('\n')}`);
});

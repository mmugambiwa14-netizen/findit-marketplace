import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import { safeExternalUrl } from '../../src/lib/safeUrl.js';

const ROOT = new URL('../../src/', import.meta.url);
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

async function sourceFiles(directory = ROOT) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(target);
  }
  return files;
}

async function sourceMatches(pattern) {
  const matches = [];
  for (const file of await sourceFiles()) {
    const source = await readFile(file, 'utf8');
    if (pattern.test(source)) {
      matches.push(relative(new URL('../../', import.meta.url).pathname, file.pathname));
    }
  }
  return matches;
}

test('user-supplied external links allow only absolute HTTP and HTTPS URLs', () => {
  assert.equal(safeExternalUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl(' HTTP://EXAMPLE.COM '), 'http://example.com/');
  for (const value of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//attacker.example/path',
    '/relative/path',
    'not a url',
    null,
  ]) {
    assert.equal(safeExternalUrl(value), null);
  }
});

test('application source does not bypass React escaping with raw HTML injection', async () => {
  const matches = await sourceMatches(/dangerouslySetInnerHTML\s*=/);
  assert.deepEqual(matches, [], `Raw HTML rendering found in: ${matches.join(', ')}`);
});

test('application source does not embed javascript or vbscript URL schemes', async () => {
  const matches = await sourceMatches(/(?:href|src|action)\s*=\s*["'`]\s*(?:javascript|vbscript):/i);
  assert.deepEqual(matches, [], `Dangerous literal URL scheme found in: ${matches.join(', ')}`);
});

test('external window openings must explicitly prevent opener access', async () => {
  const files = await sourceFiles();
  const unsafe = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const openCalls = source.match(/window\.open\([^;]+\);?/g) ?? [];
    for (const call of openCalls) {
      if (!/noopener/.test(call) || !/noreferrer/.test(call)) {
        unsafe.push(`${relative(new URL('../../', import.meta.url).pathname, file.pathname)}: ${call.slice(0, 120)}`);
      }
    }
  }
  assert.deepEqual(unsafe, [], `Unsafe window.open calls found:\n${unsafe.join('\n')}`);
});

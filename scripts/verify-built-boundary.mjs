import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = join(projectRoot, 'dist');
const inspectExtensions = new Set(['.html', '.js', '.css', '.json']);
const files = [];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (inspectExtensions.has(extname(path))) files.push(path);
  }
}

walk(outputRoot);
if (!files.some((file) => extname(file) === '.js')) {
  throw new Error('Production build verification found no JavaScript output.');
}

const violations = files
  .filter((file) => /base44(?:\.app)?/i.test(readFileSync(file, 'utf8')))
  .map((file) => relative(projectRoot, file));

if (violations.length) {
  throw new Error(`Production build contains Base44 runtime references:\n${violations.join('\n')}`);
}

console.log(`Production build Base44 boundary: PASS (${files.length} generated text assets inspected)`);

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(projectRoot, 'src');
const legacyRoot = join(projectRoot, 'base44');
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const violations = [];

function walk(directory) {
  if (!existsSync(directory)) return [];

  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

const packageManifest = JSON.parse(
  readFileSync(join(projectRoot, 'package.json'), 'utf8'),
);
for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  if (packageManifest[group]?.['@base44/sdk']) {
    violations.push(`package.json ${group} contains @base44/sdk`);
  }
}

for (const file of walk(sourceRoot)) {
  if (!sourceExtensions.has(extname(file))) continue;
  const source = readFileSync(file, 'utf8');
  if (
    /@base44\/sdk|api\/base44Client|\bbase44\.(?:entities|functions|integrations|agents)\b/.test(source)
  ) {
    violations.push(relative(projectRoot, file).replaceAll('\\', '/'));
  }
}

const retainedLegacyFiles = walk(legacyRoot);
if (retainedLegacyFiles.length > 0) {
  violations.push(`${retainedLegacyFiles.length} files remain beneath base44/`);
}

const browserEnvironment = readFileSync(
  join(projectRoot, '.env.example'),
  'utf8',
);
if (/VITE_BASE44_|BASE44_LEGACY_SDK_IMPORTS/.test(browserEnvironment)) {
  violations.push('.env.example still exposes legacy Base44 configuration');
}

if (violations.length > 0) {
  throw new Error(
    `Base44 elimination gate failed:\n${violations.join('\n')}`,
  );
}

console.log('Base44 elimination gate: PASS (SDK, source callers, export tree, and browser configuration removed)');

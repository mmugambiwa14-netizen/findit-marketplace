// stamp-service-worker.mjs
//
// Replaces the __SW_VERSION__ placeholder in the built service worker with a
// hash derived from the build output and loads the independent Web Push
// handlers. Keeping push handling in public/push-sw.js avoids weakening the
// carefully reviewed cache boundary in public/sw.js.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = join(projectRoot, 'dist');
const workerPath = join(outputRoot, 'sw.js');
const pushImport = "importScripts('/push-sw.js');\n";

function collect(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) collect(path, files);
    else files.push(relative(outputRoot, path).replaceAll('\\', '/'));
  }
  return files;
}

let source;
try {
  source = readFileSync(workerPath, 'utf8');
} catch {
  console.error('Service worker stamp: FAIL (dist/sw.js not found -- is public/sw.js present?)');
  process.exit(1);
}

if (!source.includes('__SW_VERSION__')) {
  console.error('Service worker stamp: FAIL (no __SW_VERSION__ placeholder in dist/sw.js)');
  console.error('A worker that ships an unstamped version cannot invalidate its caches.');
  process.exit(1);
}

const fingerprint = collect(outputRoot).sort().join('\n');
const version = createHash('sha256').update(fingerprint).digest('hex').slice(0, 12);
let stamped = source.replaceAll('__SW_VERSION__', version);
if (!stamped.startsWith(pushImport)) stamped = `${pushImport}${stamped}`;

writeFileSync(workerPath, stamped, 'utf8');

console.log(`Service worker stamp: PASS (version ${version} from ${fingerprint.split('\n').length} build artefacts; push enabled)`);

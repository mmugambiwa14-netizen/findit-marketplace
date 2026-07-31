import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const packagePath = resolve(root, 'package.json');
const lockPath = resolve(root, 'package-lock.json');
const write = process.argv.includes('--write');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const original = await readFile(lockPath, 'utf8');
const lock = JSON.parse(original);

if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) {
  throw new Error('Unsupported package-lock boundary');
}

const rootPackage = lock.packages[''];
for (const field of ['name', 'version', 'dependencies', 'devDependencies', 'engines']) {
  if (packageJson[field] === undefined) delete rootPackage[field];
  else rootPackage[field] = structuredClone(packageJson[field]);
}

const bannedPackages = [
  'node_modules/leaflet',
  'node_modules/@types/leaflet',
];
for (const packagePathKey of bannedPackages) delete lock.packages[packagePathKey];

function packageIsReferenced(packageName) {
  for (const [packagePathKey, metadata] of Object.entries(lock.packages)) {
    if (packagePathKey === `node_modules/${packageName}` || !metadata || typeof metadata !== 'object') continue;
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      if (metadata[field] && Object.hasOwn(metadata[field], packageName)) return true;
    }
  }
  return false;
}

if (!packageIsReferenced('@types/geojson')) delete lock.packages['node_modules/@types/geojson'];

const normalized = `${JSON.stringify(lock, null, 2)}\n`;
const changed = normalized !== original;

if (write) {
  if (changed) await writeFile(lockPath, normalized, 'utf8');
  console.log(changed ? 'package-lock.json normalized.' : 'package-lock.json already normalized.');
  process.exit(0);
}

if (changed) {
  console.error('package-lock.json is not normalized. Run: node scripts/normalize-package-lock.mjs --write');
  process.exit(1);
}

console.log('package-lock.json matches the manifest and contains no retired Leaflet packages.');

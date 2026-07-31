import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const outputPath = resolve(root, 'artifacts/certification/dependency-inventory.json');
const lockPath = resolve(root, 'package-lock.json');
const lockBytes = await readFile(lockPath);
const lock = JSON.parse(lockBytes.toString('utf8'));

if (lock.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) {
  throw new Error('Unsupported package-lock boundary');
}

function packageNameFromPath(packagePath) {
  const marker = 'node_modules/';
  const offset = packagePath.lastIndexOf(marker);
  if (offset < 0) return null;
  const suffix = packagePath.slice(offset + marker.length);
  if (!suffix) return null;
  if (!suffix.startsWith('@')) return suffix.split('/')[0];
  return suffix.split('/').slice(0, 2).join('/');
}

function integrityRecord(integrity) {
  if (typeof integrity !== 'string' || !integrity) return null;
  const separator = integrity.indexOf('-');
  if (separator <= 0) return { algorithm: 'unknown', value: integrity };
  return {
    algorithm: integrity.slice(0, separator),
    value: integrity.slice(separator + 1),
  };
}

const packages = [];
for (const [installPath, metadata] of Object.entries(lock.packages)) {
  if (!installPath || !metadata || typeof metadata !== 'object') continue;
  const name = packageNameFromPath(installPath);
  if (!name || typeof metadata.version !== 'string') continue;
  packages.push({
    name,
    version: metadata.version,
    installPath,
    developmentOnly: metadata.dev === true,
    optional: metadata.optional === true,
    bundled: metadata.inBundle === true,
    license: typeof metadata.license === 'string' ? metadata.license : null,
    integrity: integrityRecord(metadata.integrity),
    resolvedRegistryUrl: typeof metadata.resolved === 'string' && metadata.resolved.startsWith('https://registry.npmjs.org/')
      ? metadata.resolved
      : null,
  });
}
packages.sort((left, right) => left.installPath.localeCompare(right.installPath));

const missingIntegrity = packages.filter((item) => !item.integrity && !item.bundled);
const nonRegistryResolutions = packages.filter((item) => !item.resolvedRegistryUrl && !item.bundled);
const retiredPackages = packages.filter((item) => ['leaflet', '@types/leaflet'].includes(item.name));

const inventory = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    lockfileVersion: lock.lockfileVersion,
    packageLockSha256: createHash('sha256').update(lockBytes).digest('hex'),
  },
  summary: {
    componentCount: packages.length,
    productionComponents: packages.filter((item) => !item.developmentOnly).length,
    developmentComponents: packages.filter((item) => item.developmentOnly).length,
    missingIntegrityCount: missingIntegrity.length,
    nonRegistryResolutionCount: nonRegistryResolutions.length,
    retiredPackageCount: retiredPackages.length,
  },
  policy: {
    retiredPackagesAbsent: retiredPackages.length === 0,
    allNonBundledPackagesHaveIntegrity: missingIntegrity.length === 0,
    allNonBundledPackagesResolveFromNpmRegistry: nonRegistryResolutions.length === 0,
  },
  exceptions: {
    missingIntegrity: missingIntegrity.map(({ name, version, installPath }) => ({ name, version, installPath })),
    nonRegistryResolutions: nonRegistryResolutions.map(({ name, version, installPath }) => ({ name, version, installPath })),
    retiredPackages: retiredPackages.map(({ name, version, installPath }) => ({ name, version, installPath })),
  },
  components: packages,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

if (!inventory.policy.retiredPackagesAbsent
  || !inventory.policy.allNonBundledPackagesHaveIntegrity
  || !inventory.policy.allNonBundledPackagesResolveFromNpmRegistry) {
  console.error(`Dependency inventory policy failed. Report: ${outputPath}`);
  process.exit(1);
}

console.log(`Dependency inventory written to ${outputPath}: ${packages.length} components verified.`);

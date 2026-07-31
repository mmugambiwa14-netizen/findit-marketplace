// Refreshes the vendored MapLibre GL runtime in public/vendor/maplibre.
//
// The map runtime is served from our own origin so that no third-party CDN sits
// inside the Content-Security-Policy script-src. That means the assets are
// committed, and this script is how they are updated: bump MAPLIBRE_VERSION in
// src/lib/mapProvider.js, run `node scripts/vendor-maplibre-assets.mjs`, and
// commit the result.
//
// Pass --check to verify the committed assets match the pinned version without
// writing anything, which is what CI should run.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const providerSource = await readFile(resolve(root, 'src/lib/mapProvider.js'), 'utf8');
const versionMatch = providerSource.match(/const MAPLIBRE_VERSION = '([^']+)'/);

if (!versionMatch) {
  console.error('Could not read MAPLIBRE_VERSION from src/lib/mapProvider.js');
  process.exit(1);
}

const version = versionMatch[1];
const outputDirectory = resolve(root, 'public/vendor/maplibre');
const checkOnly = process.argv.includes('--check');
const assets = ['maplibre-gl.js', 'maplibre-gl.css'];
const failures = [];

await mkdir(outputDirectory, { recursive: true });

for (const asset of assets) {
  const url = `https://unpkg.com/maplibre-gl@${version}/dist/${asset}`;
  const response = await fetch(url);

  if (!response.ok) {
    failures.push(`${asset}: upstream responded ${response.status}`);
    continue;
  }

  const upstream = Buffer.from(await response.arrayBuffer());
  const digest = createHash('sha256').update(upstream).digest('hex');
  const target = resolve(outputDirectory, asset);

  if (checkOnly) {
    const committed = await readFile(target).catch(() => null);
    if (!committed) failures.push(`${asset}: not vendored`);
    else if (!committed.equals(upstream)) failures.push(`${asset}: differs from maplibre-gl@${version}`);
    else console.log(`ok       ${asset} sha256:${digest}`);
    continue;
  }

  await writeFile(target, upstream);
  console.log(`vendored ${asset} (${upstream.length} bytes) sha256:${digest}`);
}

if (failures.length) {
  console.error(`Vendored MapLibre assets do not match maplibre-gl@${version}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`MapLibre ${version} assets verified in public/vendor/maplibre.`);

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [packageSource, certificationSource, providerSource, deploymentSource] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/internal-certification.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/mapProvider.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
]);

const packageManifest = JSON.parse(packageSource);
const csp = deploymentSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1] || '';

test('internal certification verifies and hashes the vendored MapLibre runtime', () => {
  assert.equal(
    packageManifest.scripts['verify:maplibre-assets'],
    'node ./scripts/vendor-maplibre-assets.mjs --check',
  );
  assert.match(certificationSource, /'verify:maplibre-assets'/);
  assert.match(certificationSource, /deploymentConfigurationSha256/);
  assert.match(certificationSource, /deploymentHeadersSha256/);
  assert.match(certificationSource, /mapLibreRuntimeSha256/);
  assert.match(certificationSource, /public\/vendor\/maplibre\/maplibre-gl\.js/);
  assert.match(certificationSource, /mapLibreStylesheetSha256/);
  assert.match(certificationSource, /public\/vendor\/maplibre\/maplibre-gl\.css/);
});

test('production runtime is first-party and the CSP has no third-party script origin', () => {
  assert.match(providerSource, /vendor\/maplibre\/maplibre-gl\.js/);
  assert.match(providerSource, /vendor\/maplibre\/maplibre-gl\.css/);
  assert.doesNotMatch(providerSource, /unpkg\.com/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unpkg\.com|cdnjs|jsdelivr/);
});

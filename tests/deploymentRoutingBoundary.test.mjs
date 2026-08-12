import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const appSource = readFileSync(resolve(projectRoot, 'src/App.jsx'), 'utf8');
const authSource = readFileSync(
  resolve(projectRoot, 'src/services/authService.js'),
  'utf8',
);
const registerSource = readFileSync(resolve(projectRoot, 'src/pages/Register.jsx'), 'utf8');
const indexSource = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
const documentBootstrapSource = readFileSync(resolve(projectRoot, 'src/documentBootstrap.js'), 'utf8');
const pagesFallback = readFileSync(
  resolve(projectRoot, 'scripts/create-pages-spa-fallback.mjs'),
  'utf8',
);

test('browser routing consumes the Vite deployment base path', () => {
  assert.match(appSource, /import\.meta\.env\.BASE_URL/);
  assert.match(appSource, /<Router basename=\{routerBaseName\}>/);
});

test('all provider-driven auth callbacks use the deployment-aware URL helper', () => {
  assert.match(authSource, /new URL\(import\.meta\.env\.BASE_URL, window\.location\.origin\)/);
  assert.match(authSource, /redirectTo: appUrl\(redirectPath\)/);
  assert.match(authSource, /emailRedirectTo: appUrl\(redirectPath\)/);
  assert.match(registerSource, /redirectPath: returnTo/);
  assert.match(registerSource, /resendSignupConfirmation\(email, returnTo\)/);
  assert.match(authSource, /redirectTo: appUrl\('\/reset-password'\)/);
});

// The GitHub Pages staging workflow that used to be asserted here was retired
// when Cloudflare became the authoritative host. Cloudflare serves the app at the
// domain root and handles deep links with a `/* /index.html 200` rewrite in
// public/_redirects, which tests/cloudflareHeadersContracts.test.mjs asserts. The
// client-side route restoration below is still live behaviour and stays covered.
test('deep links restore the intended route safely', () => {
  assert.match(pagesFallback, /window\.location\.replace\(destination\.toString\(\)\)/);
  assert.match(pagesFallback, /currentPath\.startsWith\(basePath\)/);
  assert.match(indexSource, /src\/documentBootstrap\.js/);
  assert.match(documentBootstrapSource, /currentUrl\.searchParams\.get\(ROUTE_KEY\)/);
  assert.match(documentBootstrapSource, /targetUrl\.origin === window\.location\.origin/);
  assert.match(documentBootstrapSource, /targetUrl\.pathname\.startsWith\(baseUrl\.pathname\)/);
});

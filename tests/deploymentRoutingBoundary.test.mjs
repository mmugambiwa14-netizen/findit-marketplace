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
const pagesWorkflow = readFileSync(
  resolve(projectRoot, '.github/workflows/deploy-staging-pages.yml'),
  'utf8',
);
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

test('Pages deep links redirect through a 200 shell and restore the route safely', () => {
  assert.match(pagesWorkflow, /create-pages-spa-fallback\.mjs dist "\$VITE_BASE_PATH"/);
  assert.doesNotMatch(pagesWorkflow, /cp dist\/index\.html dist\/404\.html/);
  assert.match(pagesFallback, /window\.location\.replace\(destination\.toString\(\)\)/);
  assert.match(pagesFallback, /currentPath\.startsWith\(basePath\)/);
  assert.match(indexSource, /src\/documentBootstrap\.js/);
  assert.match(documentBootstrapSource, /currentUrl\.searchParams\.get\(ROUTE_KEY\)/);
  assert.match(documentBootstrapSource, /targetUrl\.origin === window\.location\.origin/);
  assert.match(documentBootstrapSource, /targetUrl\.pathname\.startsWith\(baseUrl\.pathname\)/);
});

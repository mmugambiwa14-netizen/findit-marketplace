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
const previewWorkflow = readFileSync(
  resolve(projectRoot, '.github/workflows/peekalisting-preview.yml'),
  'utf8',
);
const redirects = readFileSync(resolve(projectRoot, 'public/_redirects'), 'utf8');

test('browser routing consumes the Vite deployment base path', () => {
  assert.match(appSource, /import\.meta\.env\.BASE_URL/);
  assert.match(appSource, /<Router basename=\{routerBaseName\}>/);
});

test('all provider-driven auth callbacks use the deployment-aware URL helper', () => {
  assert.match(authSource, /VITE_PUBLIC_APP_ORIGIN/);
  assert.match(authSource, /new URL\(import\.meta\.env\.BASE_URL, configuredAppOrigin\(\)\)/);
  assert.match(authSource, /buildOAuthCallbackUrl\(bridgeId, redirectPath\)/);
  assert.match(authSource, /emailRedirectTo: appUrl\(redirectPath\)/);
  assert.match(registerSource, /redirectPath: returnTo/);
  assert.match(registerSource, /resendSignupConfirmation\(email, returnTo\)/);
  assert.match(authSource, /redirectTo: appUrl\('\/reset-password'\)/);
});

test('Cloudflare staging restores deep links without a GitHub Pages or Vercel runtime', () => {
  assert.match(previewWorkflow, /workflow_dispatch/);
  assert.match(previewWorkflow, /confirmation/);
  assert.match(previewWorkflow, /name: cloudflare-staging/);
  assert.match(previewWorkflow, /VITE_MODE: staging/);
  assert.match(previewWorkflow, /VITE_DEPLOY_ENV: staging/);
  assert.match(previewWorkflow, /VITE_BASE_PATH: \//);
  assert.match(previewWorkflow, /VITE_PUBLIC_APP_ORIGIN: https:\/\/staging\.peekalisting\.pages\.dev/);
  assert.match(previewWorkflow, /npx wrangler pages deploy dist/);
  assert.match(previewWorkflow, /--project-name=peekalisting/);
  assert.match(previewWorkflow, /--branch=staging/);
  assert.doesNotMatch(previewWorkflow, /actions\/deploy-pages|actions\/upload-pages-artifact|github-pages/);
  assert.match(redirects, /^\/\*\s+\/index\.html\s+200$/m);
  assert.match(indexSource, /src\/documentBootstrap\.js/);
  assert.match(documentBootstrapSource, /currentUrl\.searchParams\.get\(ROUTE_KEY\)/);
  assert.match(documentBootstrapSource, /targetUrl\.origin === window\.location\.origin/);
  assert.match(documentBootstrapSource, /targetUrl\.pathname\.startsWith\(baseUrl\.pathname\)/);
});

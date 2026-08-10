import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const appSource = readFileSync(resolve(projectRoot, 'src/App.jsx'), 'utf8');
const authSource = readFileSync(resolve(projectRoot, 'src/services/authService.js'), 'utf8');
const registerSource = readFileSync(resolve(projectRoot, 'src/pages/Register.jsx'), 'utf8');
const indexSource = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
const documentBootstrapSource = readFileSync(resolve(projectRoot, 'src/documentBootstrap.js'), 'utf8');
const previewWorkflow = readFileSync(resolve(projectRoot, '.github/workflows/peekalisting-preview.yml'), 'utf8');
const deployScript = readFileSync(resolve(projectRoot, 'scripts/deploy-canonical-cloudflare-staging.sh'), 'utf8');
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
  assert.match(previewWorkflow, /branches:\s*\n\s*- main/);
  assert.match(previewWorkflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(previewWorkflow, /name: cloudflare-staging/);
  assert.match(previewWorkflow, /VITE_MODE: staging/);
  assert.match(previewWorkflow, /VITE_DEPLOY_ENV: staging/);
  assert.match(previewWorkflow, /VITE_BASE_PATH: \//);
  assert.match(previewWorkflow, /CLOUDFLARE_PAGES_PROJECT: peekalisting-staging/);
  assert.match(previewWorkflow, /CLOUDFLARE_STAGING_DOMAIN: staging\.peekalisting\.com/);
  assert.match(previewWorkflow, /VITE_PUBLIC_APP_ORIGIN: https:\/\/staging\.peekalisting\.com/);
  assert.match(previewWorkflow, /deploy-canonical-cloudflare-staging\.sh/);
  assert.match(previewWorkflow, /npm run verify:deployment-security/);
  assert.match(previewWorkflow, /npm run verify:cloudflare-staging/);
  assert.match(deployScript, /npx --yes wrangler@4 pages deploy dist/);
  assert.match(deployScript, /--project-name="\$\{CLOUDFLARE_PAGES_PROJECT\}"/);
  assert.match(deployScript, /--branch=main/);
  assert.match(deployScript, /current-build\.txt/);
  assert.doesNotMatch(previewWorkflow, /VITE_PUBLIC_APP_ORIGIN: https:\/\/peekalisting\.com/);
  assert.doesNotMatch(previewWorkflow, /actions\/deploy-pages|actions\/upload-pages-artifact|github-pages/);
  assert.match(redirects, /^\/\*\s+\/index\.html\s+200$/m);
  assert.match(indexSource, /src\/documentBootstrap\.js/);
  assert.match(documentBootstrapSource, /currentUrl\.searchParams\.get\(ROUTE_KEY\)/);
  assert.match(documentBootstrapSource, /targetUrl\.origin === window\.location\.origin/);
  assert.match(documentBootstrapSource, /targetUrl\.pathname\.startsWith\(baseUrl\.pathname\)/);
});

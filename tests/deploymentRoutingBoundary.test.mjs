import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const appSource = readFileSync(resolve(projectRoot, 'src/App.jsx'), 'utf8');
const authSource = readFileSync(resolve(projectRoot, 'src/services/authService.js'), 'utf8');
const registerSource = readFileSync(resolve(projectRoot, 'src/pages/Register.jsx'), 'utf8');
const previewWorkflow = readFileSync(resolve(projectRoot, '.github/workflows/peekalisting-preview.yml'), 'utf8');
const deployScript = readFileSync(resolve(projectRoot, 'scripts/deploy-canonical-cloudflare-staging.sh'), 'utf8');

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

test('canonical staging deploys main at the root custom domain and proves its exact source', () => {
  assert.match(previewWorkflow, /branches:\s*\n\s*- main/);
  assert.match(previewWorkflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(previewWorkflow, /test "\$GITHUB_REF_NAME" = "main"/);
  assert.match(previewWorkflow, /VITE_BASE_PATH: \/\n/);
  assert.match(previewWorkflow, /VITE_PUBLIC_APP_ORIGIN: https:\/\/staging\.peekalisting\.com/);
  assert.match(previewWorkflow, /VITE_PREVIEW_DEPLOYMENT: "false"/);
  assert.match(previewWorkflow, /CLOUDFLARE_PAGES_PROJECT: peekalisting-staging/);
  assert.match(previewWorkflow, /CLOUDFLARE_STAGING_DOMAIN: staging\.peekalisting\.com/);
  assert.match(previewWorkflow, /test "\$\(git rev-parse HEAD\)" = "\$GITHUB_SHA"/);
  assert.match(previewWorkflow, /current-build\.txt/);
  assert.match(previewWorkflow, /staging-build\.json/);
  assert.match(previewWorkflow, /"branch":"main"/);
  assert.match(previewWorkflow, /"sha":"\$GITHUB_SHA"/);
  assert.match(previewWorkflow, /deploy-canonical-cloudflare-staging\.sh/);
  assert.match(deployScript, /staging\.peekalisting\.com/);
  assert.match(deployScript, /current-build\.txt/);
  assert.match(deployScript, /GITHUB_SHA/);
});

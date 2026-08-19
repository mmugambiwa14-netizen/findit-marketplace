import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('build budget measures the awaited bootstrap graph and static shared imports', async () => {
  const source = await read('scripts/verify-build-budget.mjs');
  assert.match(source, /dynamicImportPattern/);
  assert.match(source, /staticImportPattern/);
  assert.match(source, /criticalScriptPaths/);
  assert.match(source, /referencedScripts\(currentPath, staticImportPattern\)/);
});

test('PWA queries revalidate after focus and reconnect', async () => {
  const source = await read('src/lib/query-client.js');
  assert.match(source, /refetchOnWindowFocus:\s*true/);
  assert.match(source, /refetchOnReconnect:\s*true/);
});

test('OAuth selects the full-window path and still requests account selection', async () => {
  const source = await read('src/services/authService.js');
  assert.match(source, /function shouldUseOAuthPopup\(\)[\s\S]*return false/);
  assert.match(source, /prompt: 'select_account'/);
  assert.match(source, /buildFullWindowOAuthCallbackUrl\(redirectPath\)/);
});

test('client and CSP reporting are bounded and do not carry credentials', async () => {
  const client = await read('src/lib/errorMonitoring.js');
  const endpoint = await read('functions/api/client-errors.js');
  const csp = await read('functions/api/csp-report.js');
  const headers = await read('public/_headers');
  assert.match(client, /keepalive: true/);
  assert.match(client, /credentials: 'omit'/);
  assert.match(endpoint, /MAX_BODY_BYTES/);
  assert.match(csp, /MAX_BODY_BYTES/);
  assert.match(headers, /Reporting-Endpoints: csp-endpoint/);
  assert.match(headers, /report-uri \/api\/csp-report/);
  assert.match(headers, /bwgklpxoetrrkutottdb\.supabase\.co/);
  assert.match(headers, /jvbpxnfxkptuexgssplj\.supabase\.co/);
});

test('transactional email fails closed when the application origin is missing', async () => {
  const source = await read('supabase/functions/transactional-email-dispatch/index.ts');
  assert.match(source, /configuredBase=Deno\.env\.get\("FINDIT_APP_URL"\)/);
  assert.match(source, /app_url_not_configured/);
  assert.doesNotMatch(source, /staging\.peekalisting\.pages\.dev/);
});

test('share-image redirects are restricted to first-party Supabase storage', async () => {
  const source = await read('functions/_middleware.js');
  assert.match(source, /trustedSupabaseImageUrl/);
  assert.match(source, /parsed\.origin === origin/);
  assert.match(source, /parsed\.pathname\.startsWith\('\/storage\/v1\/'\)/);
});

test('server-side view subjects and abuse budgets no longer trust client viewer keys', async () => {
  const source = await read('supabase/migrations/20260819090000_harden_public_view_abuse.sql');
  assert.match(source, /private\.request_abuse_subject/);
  assert.match(source, /marketplace\.view\.day/);
  assert.match(source, /peek\.view\.day/);
  assert.match(source, /v_server_viewer_key/);
  assert.match(source, /client-supplied p_viewer_key/);
});

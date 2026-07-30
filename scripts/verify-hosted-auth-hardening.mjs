import { evaluateHostedAuthConfig } from './lib/auth-config-policy.mjs';

const accessToken = process.env.FINDIT_SUPABASE_ACCESS_TOKEN?.trim();
const expectedProjectRef = process.env.FINDIT_EXPECTED_PROJECT_REF?.trim();
const mode = process.env.FINDIT_AUTH_PREFLIGHT_MODE ?? 'audit';
const allowMode = process.env.FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT;

if (!accessToken) {
  throw new Error('Hosted Auth preflight requires FINDIT_SUPABASE_ACCESS_TOKEN.');
}
if (!expectedProjectRef || !/^[a-z0-9]{20}$/.test(expectedProjectRef)) {
  throw new Error('Hosted Auth preflight requires an exact 20-character FINDIT_EXPECTED_PROJECT_REF.');
}
if (!['audit', 'staging', 'production'].includes(mode)) {
  throw new Error('FINDIT_AUTH_PREFLIGHT_MODE must be audit, staging, or production.');
}
if (allowMode !== mode) {
  throw new Error(
    `Hosted Auth preflight refuses to run unless FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT=${mode}.`,
  );
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);
let response;
try {
  response = await fetch(
    `https://api.supabase.com/v1/projects/${expectedProjectRef}/config/auth`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    },
  );
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    throw new Error('Supabase Auth configuration request timed out.');
  }
  throw new Error('Supabase Auth configuration could not be retrieved.');
} finally {
  clearTimeout(timeout);
}

if (!response.ok) {
  throw new Error(`Supabase Auth configuration request failed with HTTP ${response.status}.`);
}

let configuration;
try {
  configuration = await response.json();
} catch {
  throw new Error('Supabase Auth configuration response was not valid JSON.');
}

const result = evaluateHostedAuthConfig(configuration, process.env);
console.log(JSON.stringify({
  projectRef: expectedProjectRef,
  ...result.summary,
  status: result.status,
}, null, 2));

if (result.problems.length) {
  console.error('Hosted Auth hardening verification failed:');
  for (const problem of result.problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('Hosted Auth hardening verification passed.');

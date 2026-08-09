import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mode = process.env.VITE_MODE || process.env.NODE_ENV || 'development';

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const output = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    output[name] = value;
  }
  return output;
}

function loadProjectEnv() {
  const root = process.cwd();
  const merged = {};
  for (const filename of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    Object.assign(merged, parseEnvFile(resolve(root, filename)));
  }
  return merged;
}

const env = { ...loadProjectEnv(), ...process.env };
const problems = [];
const requiredBrowserVariables = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const unsafeViteName = /(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|API_TOKEN|ACCESS_TOKEN)/i;
for (const name of Object.keys(env)) {
  if (name.startsWith('VITE_') && unsafeViteName.test(name)) {
    problems.push(`${name} must not be VITE-prefixed because Vite exposes it to browser code`);
  }
}

for (const name of requiredBrowserVariables) {
  const value = env[name]?.trim();
  if (!value) problems.push(`${name} is missing`);
  else if (/your-|example|placeholder/i.test(value)) problems.push(`${name} still contains a placeholder`);
}

if (env.VITE_SUPABASE_URL?.trim()) {
  try {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (!['http:', 'https:'].includes(url.protocol)) problems.push('VITE_SUPABASE_URL must use HTTP or HTTPS');
    if (mode === 'production' && url.protocol !== 'https:') problems.push('VITE_SUPABASE_URL must use HTTPS in production');
    const expectedProjectRef = env.FINDIT_EXPECTED_PROJECT_REF?.trim();
    if (expectedProjectRef && url.hostname !== `${expectedProjectRef}.supabase.co`) {
      problems.push('VITE_SUPABASE_URL does not match FINDIT_EXPECTED_PROJECT_REF');
    }
  } catch {
    problems.push('VITE_SUPABASE_URL is not a valid absolute URL');
  }
}

const featureFlags = Object.keys(env).filter((name) => name.startsWith('VITE_FEATURE_'));
const authProviderFlags = ['VITE_AUTH_GOOGLE_ENABLED', 'VITE_AUTH_APPLE_ENABLED'];
const previewFlags = ['VITE_PREVIEW_AUTH_BYPASS'];
for (const name of [...featureFlags, ...authProviderFlags, ...previewFlags]) {
  if (env[name] === undefined || env[name] === '') continue;
  if (!['true', 'false'].includes(env[name])) problems.push(`${name} must be exactly true or false`);
}

for (const name of [
  'TOURS_BACKEND_ENABLED',
  'FINDIT_TOURS_RELEASE_ACCEPTED',
  'FINDIT_TOURS_WORKERS_ENABLED',
  'FINDIT_RECOMMENDATION_WORKERS_ENABLED',
]) {
  if (env[name] !== undefined && env[name] !== '' && !['true', 'false'].includes(env[name])) {
    problems.push(`${name} must be exactly true or false`);
  }
}

const toursBrowserEnabled = env.VITE_FEATURE_TOURS === 'true';
const toursPreviewEnabled = env.VITE_FEATURE_TOURS_PREVIEW === 'true';
const toursBackendEnabled = env.TOURS_BACKEND_ENABLED === 'true';
const toursReleaseAccepted = env.FINDIT_TOURS_RELEASE_ACCEPTED === 'true';
const toursWorkersEnabled = env.FINDIT_TOURS_WORKERS_ENABLED === 'true';
const tourProcessorMode = env.FINDIT_TOUR_PROCESSOR_MODE?.trim();
if ((toursBrowserEnabled || toursPreviewEnabled) && !toursBackendEnabled) {
  problems.push('Tour browser or preview access cannot be enabled unless TOURS_BACKEND_ENABLED is true');
}
if (toursBackendEnabled) {
  if (!toursWorkersEnabled) problems.push('FINDIT_TOURS_WORKERS_ENABLED must be true when TOURS_BACKEND_ENABLED=true');
  if (!['github-actions', 'external'].includes(tourProcessorMode)) {
    problems.push('FINDIT_TOUR_PROCESSOR_MODE must be github-actions or external when TOURS_BACKEND_ENABLED=true');
  }
  for (const name of [
    'FINDIT_TOUR_CLEANUP_WORKER_SECRET',
    'FINDIT_TOUR_CACHE_WORKER_SECRET',
    'FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET',
  ]) {
    if (!env[name]?.trim()) problems.push(`${name} is required when TOURS_BACKEND_ENABLED=true`);
  }
  if (tourProcessorMode === 'external') {
    for (const name of [
      'TOUR_PROCESSOR_URL',
      'TOUR_PROCESSOR_SECRET',
      'TOUR_PROCESSING_CALLBACK_URL',
      'FINDIT_TOUR_PROCESSING_WORKER_SECRET',
    ]) {
      if (!env[name]?.trim()) problems.push(`${name} is required when FINDIT_TOUR_PROCESSOR_MODE=external`);
    }
    for (const name of ['TOUR_PROCESSOR_URL', 'TOUR_PROCESSING_CALLBACK_URL']) {
      if (!env[name]?.trim()) continue;
      try {
        const url = new URL(env[name]);
        if (mode === 'production' && url.protocol !== 'https:') problems.push(`${name} must use HTTPS in production`);
      } catch {
        problems.push(`${name} must be a valid absolute URL`);
      }
    }
  }
  if (env.TOUR_CACHE_PURGE_URL?.trim() && !env.TOUR_CACHE_PURGE_SECRET?.trim()) {
    problems.push('TOUR_CACHE_PURGE_SECRET is required when TOUR_CACHE_PURGE_URL is configured');
  }
}

if (env.FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED !== undefined
  && env.FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED !== ''
  && !['true', 'false'].includes(env.FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED)) {
  problems.push('FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED must be exactly true or false');
}
if (env.FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED === 'true' && !env.FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET?.trim()) {
  problems.push('FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET is required when essential notification workers are enabled');
}
if (env.FINDIT_RECOMMENDATION_WORKERS_ENABLED === 'true' && !env.FINDIT_RECOMMENDATION_WORKER_SECRET?.trim()) {
  problems.push('FINDIT_RECOMMENDATION_WORKER_SECRET is required when recommendation workers are enabled');
}

const requiredMvpLaunchFlags = [
  'VITE_FEATURE_BUSINESS_PROFILES',
  'VITE_FEATURE_MESSAGING',
  'VITE_FEATURE_ESSENTIAL_NOTIFICATIONS',
  'VITE_FEATURE_GOOGLE_OAUTH',
  'VITE_FEATURE_MAPS',
  'VITE_FEATURE_MANUAL_LOCATION',
  'VITE_FEATURE_CURRENT_LOCATION',
  'VITE_FEATURE_REPORTING',
];
const deferredV1Flags = [
  'VITE_FEATURE_CURRENCY_CONVERSION',
  'VITE_FEATURE_PHONE_VERIFICATION',
  'VITE_FEATURE_INTERNATIONAL_LISTING',
  'VITE_FEATURE_SERVICE_RADIUS',
  'VITE_FEATURE_PAYMENTS',
  'VITE_FEATURE_SUBSCRIPTIONS',
  'VITE_FEATURE_ESCROW',
  'VITE_FEATURE_PREMIUM_LISTINGS',
  'VITE_FEATURE_AI_MODERATION',
  'VITE_FEATURE_AI_BAN_EVASION',
  'VITE_FEATURE_AI_TICKET_TRIAGE',
  'VITE_FEATURE_AI_SUPPORT_CHAT',
  'VITE_FEATURE_SCHEDULED_REMINDERS',
  'VITE_FEATURE_MARKETING_EMAILS',
  'VITE_FEATURE_LISTING_EXPIRY',
  'VITE_FEATURE_LISTING_FRESHNESS_REMINDERS',
];
const incompleteCapabilities = [
  'VITE_FEATURE_CURRENCY_CONVERSION',
  'VITE_FEATURE_PHONE_VERIFICATION',
  'VITE_FEATURE_INTERNATIONAL_LISTING',
  'VITE_FEATURE_SERVICE_RADIUS',
];
for (const name of incompleteCapabilities) {
  if (env[name] === 'true') problems.push(`${name} must remain false until its complete product contract is implemented`);
}

const mapsEnabled = env.VITE_FEATURE_MAPS === 'true';
const currentLocationEnabled = env.VITE_FEATURE_CURRENT_LOCATION === 'true';
if (mapsEnabled) {
  const key = env.VITE_MAPTILER_PUBLIC_KEY?.trim();
  // Staging/development can exercise the complete map UI through the
  // same-origin vendored MapLibre runtime and OpenFreeMap's no-key fallback.
  // Production must still use a restricted MapTiler browser key.
  if (!key && mode === 'production') problems.push('VITE_MAPTILER_PUBLIC_KEY is required when maps are enabled in production');
  else if (/your-|example|placeholder|replace-/i.test(key)) problems.push('VITE_MAPTILER_PUBLIC_KEY still contains a placeholder');
  const styleId = env.VITE_MAPTILER_STYLE_ID?.trim() || 'streets-v4';
  if (!/^[a-z0-9][a-z0-9_-]{1,95}$/i.test(styleId)) problems.push('VITE_MAPTILER_STYLE_ID is invalid');
}
if (currentLocationEnabled && env.VITE_FEATURE_MANUAL_LOCATION !== 'true') {
  problems.push('VITE_FEATURE_MANUAL_LOCATION must remain true as the privacy-safe fallback for current location');
}
if (env.VITE_FEATURE_GOOGLE_OAUTH === 'true' && env.VITE_AUTH_GOOGLE_ENABLED !== 'true') {
  problems.push('VITE_AUTH_GOOGLE_ENABLED must be true when VITE_FEATURE_GOOGLE_OAUTH=true');
}

if (mode === 'production') {
  for (const name of requiredMvpLaunchFlags) {
    if (env[name] !== 'true') problems.push(`${name} must be true for a V1 production release`);
  }
  for (const name of deferredV1Flags) {
    if (env[name] !== 'false') problems.push(`${name} must be false for a V1 production release`);
  }
  if (env.VITE_FEATURE_TOURS_PREVIEW !== 'false') problems.push('VITE_FEATURE_TOURS_PREVIEW must be false in production');
  if (env.VITE_FEATURE_PREVIEW_FIXTURES !== 'false') problems.push('VITE_FEATURE_PREVIEW_FIXTURES must be false in production');
  if (env.VITE_PREVIEW_AUTH_BYPASS !== 'false') problems.push('VITE_PREVIEW_AUTH_BYPASS must be false in production');

  if (env.FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED !== 'true') {
    problems.push('FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED must be true for production essential notifications');
  }
  if (!env.FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET?.trim()) {
    problems.push('FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET is required for production essential notifications');
  }

  if (toursReleaseAccepted) {
    if (!toursBrowserEnabled || !toursBackendEnabled) {
      problems.push('An accepted Tours production release requires both browser and backend Tours enabled');
    }
    if (!/^tour-acceptance-[a-z0-9][a-z0-9-]{7,95}$/.test(env.FINDIT_TOURS_ACCEPTANCE_ID ?? '')) {
      problems.push('FINDIT_TOURS_ACCEPTANCE_ID must identify the approved staging acceptance record');
    }
  } else if (toursBrowserEnabled || toursBackendEnabled) {
    problems.push('Tours must remain disabled in production until FINDIT_TOURS_RELEASE_ACCEPTED=true');
  }
}

if (problems.length > 0) {
  console.error('Environment validation failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Environment validation passed for ${mode} mode.`);

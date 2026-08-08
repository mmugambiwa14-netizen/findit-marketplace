import process from 'node:process';

const origin = process.env.FINDIT_STAGING_ORIGIN || process.argv[2];
if (!origin) {
  console.error('Usage: npm run verify:cloudflare-staging -- https://staging.example.pages.dev');
  process.exit(2);
}

let base;
try {
  base = new URL(origin);
} catch {
  console.error('Cloudflare staging verification failed: origin is not a valid URL');
  process.exit(2);
}

if (base.protocol !== 'https:') {
  console.error('Cloudflare staging verification failed: origin must use HTTPS');
  process.exit(2);
}

const failures = [];
const request = async (path, options = {}) => {
  const url = new URL(path, base);
  const response = await fetch(url, { redirect: 'follow', ...options });
  const body = await response.text();
  return { response, body, url };
};

const requirePage = async (path) => {
  try {
    const { response, body } = await request(path);
    if (response.status !== 200) failures.push(`${path}: expected HTTP 200, got ${response.status}`);
    if (!body.includes('<div id="root"></div>')) failures.push(`${path}: SPA shell missing`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

let root;
try {
  root = await request('/');
  if (root.response.status !== 200) failures.push(`/: expected HTTP 200, got ${root.response.status}`);
  if (!root.body.includes('<div id="root"></div>')) failures.push('/: SPA root missing');
} catch (error) {
  failures.push(`/: ${error instanceof Error ? error.message : String(error)}`);
}

for (const path of ['/search', '/login', '/admin', '/staging-deep-link-check']) await requirePage(path);

const requiredHeaders = [
  ['content-security-policy', (value) => value?.includes("script-src 'self'") && !value.includes("script-src 'unsafe-inline'")],
  ['strict-transport-security', (value) => value?.includes('max-age=')],
  ['x-content-type-options', (value) => value?.toLowerCase() === 'nosniff'],
  ['x-frame-options', (value) => value?.toUpperCase() === 'DENY'],
  ['referrer-policy', (value) => Boolean(value)],
  ['permissions-policy', (value) => Boolean(value)],
];
for (const [header, predicate] of requiredHeaders) {
  const value = root?.response.headers.get(header);
  if (!predicate(value)) failures.push(`/: missing or unsafe ${header}`);
}

try {
  const { response, body } = await request('/manifest.webmanifest');
  if (response.status !== 200) failures.push(`/manifest.webmanifest: expected HTTP 200, got ${response.status}`);
  if (!response.headers.get('content-type')?.includes('manifest')) failures.push('/manifest.webmanifest: wrong content type');
  const manifest = JSON.parse(body);
  if (manifest.display !== 'standalone') failures.push('/manifest.webmanifest: display must be standalone');
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 1) failures.push('/manifest.webmanifest: icons missing');
} catch (error) {
  failures.push(`/manifest.webmanifest: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const { response, body } = await request('/sw.js');
  if (response.status !== 200) failures.push(`/sw.js: expected HTTP 200, got ${response.status}`);
  if (!response.headers.get('content-type')?.includes('javascript')) failures.push('/sw.js: wrong content type');
  if (!body.includes("addEventListener('fetch'")) failures.push('/sw.js: fetch handler missing');
} catch (error) {
  failures.push(`/sw.js: ${error instanceof Error ? error.message : String(error)}`);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
if (supabaseUrl || supabaseAnonKey) {
  if (!supabaseUrl || !supabaseAnonKey) {
    failures.push('Supabase connectivity check requires both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  } else {
    try {
      const api = new URL('/auth/v1/settings', supabaseUrl);
      const response = await fetch(api, { headers: { apikey: supabaseAnonKey } });
      if (response.status !== 200) failures.push(`Supabase Auth settings: expected HTTP 200, got ${response.status}`);
    } catch (error) {
      failures.push(`Supabase Auth settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

if (failures.length) {
  console.error('Cloudflare staging verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Cloudflare staging verification passed for ${base.host}: SPA, PWA, security headers, and configured Supabase connectivity verified.`);

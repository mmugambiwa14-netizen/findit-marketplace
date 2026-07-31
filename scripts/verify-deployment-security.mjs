import { readFile } from 'node:fs/promises';

const failures = [];
const [vercelSource, html, mapProvider] = await Promise.all([
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/mapProvider.js', import.meta.url), 'utf8'),
]);

let vercel;
try {
  vercel = JSON.parse(vercelSource);
} catch (error) {
  failures.push(`vercel.json is invalid JSON: ${error.message}`);
  vercel = {};
}

function failUnless(condition, message) {
  if (!condition) failures.push(message);
}

const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
failUnless(
  rewrites.some((rewrite) => rewrite?.source === '/(.*)' && rewrite?.destination === '/index.html'),
  'vercel.json must preserve SPA deep links through an index.html rewrite',
);

const headerRules = Array.isArray(vercel.headers) ? vercel.headers : [];
const globalRule = headerRules.find((rule) => rule?.source === '/(.*)');
const globalHeaders = new Map(
  (globalRule?.headers || []).map((header) => [String(header.key || '').toLowerCase(), String(header.value || '')]),
);
const assetRule = headerRules.find((rule) => rule?.source === '/assets/(.*)');
const assetHeaders = new Map(
  (assetRule?.headers || []).map((header) => [String(header.key || '').toLowerCase(), String(header.value || '')]),
);

for (const required of [
  'content-security-policy',
  'strict-transport-security',
  'referrer-policy',
  'permissions-policy',
  'x-content-type-options',
  'x-frame-options',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
]) {
  failUnless(globalHeaders.has(required), `missing deployment security header: ${required}`);
}

failUnless(globalHeaders.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options must be nosniff');
failUnless(globalHeaders.get('x-frame-options') === 'DENY', 'X-Frame-Options must deny framing');
failUnless(
  globalHeaders.get('cross-origin-opener-policy') === 'same-origin-allow-popups',
  'Cross-Origin-Opener-Policy must preserve trusted OAuth popups',
);
failUnless(
  /max-age=63072000/i.test(globalHeaders.get('strict-transport-security') || '')
    && /includeSubDomains/i.test(globalHeaders.get('strict-transport-security') || ''),
  'HSTS must cover two years and subdomains',
);
failUnless(
  /geolocation=\(self\)/.test(globalHeaders.get('permissions-policy') || '')
    && /camera=\(\)/.test(globalHeaders.get('permissions-policy') || '')
    && /microphone=\(\)/.test(globalHeaders.get('permissions-policy') || ''),
  'Permissions-Policy must allow first-party geolocation and deny unused sensors',
);
failUnless(
  assetHeaders.get('cache-control') === 'public, max-age=31536000, immutable',
  'fingerprinted assets must use immutable one-year caching',
);

const csp = globalHeaders.get('content-security-policy') || '';
const directives = new Map(
  csp
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...values] = part.split(/\s+/);
      return [name, values];
    }),
);

for (const directive of [
  'default-src',
  'base-uri',
  'object-src',
  'frame-ancestors',
  'form-action',
  'script-src',
  'style-src',
  'connect-src',
  'img-src',
  'media-src',
  'font-src',
  'worker-src',
]) {
  failUnless(directives.has(directive), `CSP is missing ${directive}`);
}

failUnless(directives.get('default-src')?.includes("'self'"), "CSP default-src must be 'self'");
failUnless(directives.get('base-uri')?.includes("'self'"), "CSP base-uri must be 'self'");
failUnless(directives.get('object-src')?.includes("'none'"), "CSP object-src must be 'none'");
failUnless(directives.get('frame-ancestors')?.includes("'none'"), "CSP frame-ancestors must be 'none'");
failUnless(directives.get('script-src')?.includes('https://unpkg.com'), 'CSP must allow only the pinned MapLibre runtime origin');
failUnless(directives.get('connect-src')?.includes('https://api.maptiler.com'), 'CSP must allow MapTiler API requests');
failUnless(directives.get('connect-src')?.includes('https://*.supabase.co'), 'CSP must allow Supabase HTTPS requests');
failUnless(directives.get('worker-src')?.includes('blob:'), 'current MapLibre runtime requires blob workers');
failUnless(csp.includes('upgrade-insecure-requests'), 'CSP must upgrade insecure requests');

for (const prohibited of ["'unsafe-inline'", "'unsafe-eval'", 'http:']) {
  failUnless(!csp.includes(prohibited), `CSP contains prohibited source ${prohibited}`);
}
for (const [name, values] of directives) {
  failUnless(!values.includes('*'), `CSP ${name} must not contain a standalone wildcard`);
}

const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)];
failUnless(scriptTags.length >= 2, 'index.html must load the document bootstrap and application entry');
for (const [, attributes] of scriptTags) {
  failUnless(/\bsrc\s*=/.test(attributes), 'index.html must not contain inline script execution');
  failUnless(/\btype\s*=\s*["']module["']/.test(attributes), 'all document scripts must be ES modules');
}
const bootstrapPosition = html.indexOf('/src/documentBootstrap.js');
const applicationPosition = html.indexOf('/src/main.jsx');
failUnless(bootstrapPosition >= 0, 'index.html must load documentBootstrap.js');
failUnless(applicationPosition > bootstrapPosition, 'document bootstrap must load before the React application');

failUnless(/MAPLIBRE_VERSION = '5\.12\.0'/.test(mapProvider), 'MapLibre runtime version must remain exactly pinned');
failUnless(/unpkg\.com\/maplibre-gl@\$\{MAPLIBRE_VERSION\}/.test(mapProvider), 'MapLibre runtime must use the exact pinned package path');
failUnless(!/maplibre-gl@(?:latest|\^|~)/.test(mapProvider), 'MapLibre runtime must not use a floating version');

if (failures.length) {
  console.error('Deployment security verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Deployment security verification passed: strict CSP, hardened headers, SPA routing and pinned map runtime inspected.');

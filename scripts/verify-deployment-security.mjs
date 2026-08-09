import { readFile } from 'node:fs/promises';

const failures = [];
const [headersSource, redirectsSource, html, mapProvider] = await Promise.all([
  readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
  readFile(new URL('../public/_redirects', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/mapProvider.js', import.meta.url), 'utf8'),
]);

function failUnless(condition, message) {
  if (!condition) failures.push(message);
}

function parseHeaders(source) {
  const rules = new Map();
  let current = null;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = line.trim();
      rules.set(current, new Map());
      continue;
    }
    const match = line.match(/^\s+([^:]+):\s*(.*)$/);
    if (current && match) rules.get(current).set(match[1].trim().toLowerCase(), match[2].trim());
  }
  return rules;
}

const rules = parseHeaders(headersSource);
const globalHeaders = rules.get('/*') || new Map();
const assetHeaders = rules.get('/assets/*') || new Map();

failUnless(/^\/\*$/m.test(headersSource), '_headers must declare a /* baseline block');
failUnless(/^\/assets\/\*$/m.test(headersSource), '_headers must declare an immutable assets block');
failUnless(/^\/sw\.js$/m.test(headersSource), '_headers must declare a service-worker block');
failUnless(/^\/manifest\.webmanifest$/m.test(headersSource), '_headers must declare a manifest block');
failUnless(/^\/\*\s+\/index\.html\s+200$/m.test(redirectsSource), '_redirects must preserve SPA deep links');

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
  'style-src-elem',
  'style-src-attr',
  'connect-src',
  'img-src',
  'media-src',
  'font-src',
  'worker-src',
]) failUnless(directives.has(directive), `CSP is missing ${directive}`);

failUnless(directives.get('default-src')?.includes("'self'"), "CSP default-src must be 'self'");
failUnless(directives.get('base-uri')?.includes("'self'"), "CSP base-uri must be 'self'");
failUnless(directives.get('object-src')?.includes("'none'"), "CSP object-src must be 'none'");
failUnless(directives.get('frame-ancestors')?.includes("'none'"), "CSP frame-ancestors must be 'none'");
failUnless(
  directives.get('script-src')?.every((source) => !source.startsWith('http')),
  'CSP script-src must not trust any external origin; the MapLibre runtime is vendored and served from self',
);
failUnless(!directives.get('script-src')?.includes("'unsafe-inline'"), 'CSP script-src must reject inline scripts');
failUnless(!directives.get('script-src')?.includes("'unsafe-eval'"), 'CSP script-src must reject eval');
failUnless(!directives.get('style-src-elem')?.includes("'unsafe-inline'"), 'CSP style-src-elem must reject inline style elements');
failUnless(
  directives.get('style-src-attr')?.length === 1
    && directives.get('style-src-attr')?.[0] === "'unsafe-inline'",
  'CSP may allow inline styling only through style-src-attr for runtime geometry and theme state',
);
failUnless(directives.get('connect-src')?.includes('https://api.maptiler.com'), 'CSP must allow MapTiler API requests');
failUnless(directives.get('connect-src')?.includes('https://*.supabase.co'), 'CSP must allow Supabase HTTPS requests');
failUnless(directives.get('worker-src')?.includes('blob:'), 'current MapLibre runtime requires blob workers');
failUnless(csp.includes('upgrade-insecure-requests'), 'CSP must upgrade insecure requests');
failUnless(!csp.includes('http:'), 'CSP must not allow clear-text HTTP sources');

for (const [name, values] of directives) failUnless(!values.includes('*'), `CSP ${name} must not contain a standalone wildcard`);

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
failUnless(
  /<meta\s+name=["']viewport["']\s+content=["'][^"']*maximum-scale=1(?:\.0)?[^"']*user-scalable=no[^"']*["']/i.test(html),
  'index.html must keep the document at the app viewport scale',
);

failUnless(/MAPLIBRE_VERSION = '5\.12\.0'/.test(mapProvider), 'MapLibre runtime version must remain exactly pinned');
failUnless(!/unpkg\.com/.test(mapProvider), 'MapLibre runtime must not be loaded from a public CDN');
failUnless(/vendor\/maplibre\//.test(mapProvider), 'MapLibre runtime must load from the vendored same-origin assets');
failUnless(!/maplibre-gl@(?:latest|\^|~)/.test(mapProvider), 'MapLibre runtime must not use a floating version');

if (failures.length) {
  console.error('Deployment security verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Deployment security verification passed: Cloudflare headers, SPA routing, script safety and pinned map runtime inspected.');

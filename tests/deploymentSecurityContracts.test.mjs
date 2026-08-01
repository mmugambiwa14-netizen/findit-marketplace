import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [vercelSource, html, bootstrap, verifier] = await Promise.all([
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/documentBootstrap.js', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-deployment-security.mjs', import.meta.url), 'utf8'),
]);
const vercel = JSON.parse(vercelSource);
const globalHeaders = Object.fromEntries(
  vercel.headers
    .find((rule) => rule.source === '/(.*)')
    .headers
    .map((header) => [header.key.toLowerCase(), header.value]),
);

test('deployment config owns SPA fallback and security headers', () => {
  assert.deepEqual(vercel.rewrites, [{ source: '/(.*)', destination: '/index.html' }]);
  const csp = globalHeaders['content-security-policy'];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /https:\/\/api\.maptiler\.com/);
  assert.match(csp, /https:\/\/\*\.supabase\.co/);
  assert.match(csp, /style-src-attr 'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(csp, /style-src-elem[^;]*'unsafe-inline'/);
  assert.equal(globalHeaders['x-content-type-options'], 'nosniff');
  assert.equal(globalHeaders['x-frame-options'], 'DENY');
  assert.equal(globalHeaders['cross-origin-opener-policy'], 'same-origin-allow-popups');
});

test('document bootstrap is external, ordered and fail-safe', () => {
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)];
  assert.ok(scriptTags.length >= 2);
  for (const [, attributes] of scriptTags) {
    assert.match(attributes, /\bsrc\s*=/);
    assert.match(attributes, /\btype\s*=\s*["']module["']/);
  }
  assert.ok(html.indexOf('/src/documentBootstrap.js') < html.indexOf('/src/main.jsx'));
  assert.match(bootstrap, /readStoredString/);
  assert.match(bootstrap, /browserStorage\.js/);
  assert.match(bootstrap, /readStoredString\('local', 'theme', null\)/);
  assert.doesNotMatch(bootstrap, /localStorage|sessionStorage/);
  assert.match(bootstrap, /targetUrl\.origin === window\.location\.origin/);
  assert.match(bootstrap, /targetUrl\.pathname\.startsWith\(baseUrl\.pathname\)/);
});

test('deployment verification enforces scoped styles and script safety', () => {
  assert.match(verifier, /Deployment security verification passed/);
  assert.match(verifier, /MapLibre runtime version must remain exactly pinned/);
  assert.match(verifier, /index\.html must not contain inline script execution/);
  assert.match(verifier, /style-src-attr for runtime geometry and theme state/);
  assert.match(verifier, /script-src must reject inline scripts/);
});

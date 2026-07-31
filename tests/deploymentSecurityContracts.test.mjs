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
  assert.match(globalHeaders['content-security-policy'], /default-src 'self'/);
  assert.match(globalHeaders['content-security-policy'], /object-src 'none'/);
  assert.match(globalHeaders['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(globalHeaders['content-security-policy'], /https:\/\/api\.maptiler\.com/);
  assert.match(globalHeaders['content-security-policy'], /https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(globalHeaders['content-security-policy'], /'unsafe-inline'|'unsafe-eval'/);
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
  assert.match(bootstrap, /try \{[\s\S]*localStorage\.getItem\('theme'\)/);
  assert.match(bootstrap, /targetUrl\.origin === window\.location\.origin/);
  assert.match(bootstrap, /targetUrl\.pathname\.startsWith\(baseUrl\.pathname\)/);
});

test('deployment verification is part of the enforceable source graph', () => {
  assert.match(verifier, /Deployment security verification passed/);
  assert.match(verifier, /MapLibre runtime version must remain exactly pinned/);
  assert.match(verifier, /index\.html must not contain inline script execution/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [headers, redirects, html, bootstrap, verifier] = await Promise.all([
  readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
  readFile(new URL('../public/_redirects', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/documentBootstrap.js', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-deployment-security.mjs', import.meta.url), 'utf8'),
]);
const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1] || '';

test('Cloudflare deployment config owns SPA fallback and security headers', () => {
  assert.match(redirects, /^\/\*\s+\/index\.html\s+200$/m);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /https:\/\/api\.maptiler\.com/);
  assert.match(csp, /https:\/\/\*\.supabase\.co/);
  assert.match(csp, /style-src-attr 'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(csp, /style-src-elem[^;]*'unsafe-inline'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Cross-Origin-Opener-Policy: same-origin-allow-popups/);
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

test('deployment verification enforces Cloudflare headers and script safety', () => {
  assert.match(verifier, /Deployment security verification passed/);
  assert.match(verifier, /MapLibre runtime version must remain exactly pinned/);
  assert.match(verifier, /index\.html must not contain inline script execution/);
  assert.match(verifier, /style-src-attr for runtime geometry and theme state/);
  assert.match(verifier, /script-src must reject inline scripts/);
  assert.match(verifier, /public\/_headers/);
  assert.doesNotMatch(verifier, /vercel\.json/);
});

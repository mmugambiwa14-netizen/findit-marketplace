import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * Cloudflare edge configuration contract.
 *
 * Cloudflare is the authoritative hosting target and Vercel is being retired.
 * The entire production security posture used to live in vercel.json, so the
 * risk during that migration is silent loss: a platform swap that quietly ships
 * the app with no CSP, no HSTS and no frame denial, with nothing failing.
 *
 * These assertions exist so public/_headers cannot become decorative. They pin
 * the security-relevant headers by value rather than merely checking presence,
 * because a header set to a weaker value is the failure mode that matters.
 */

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the Cloudflare headers file carries the full security posture', async () => {
  const headers = await read('public/_headers');

  // Baseline block must exist and apply to every route.
  assert.match(headers, /^\/\*$/m, '_headers must declare a /* baseline block');

  assert.match(headers, /Strict-Transport-Security: max-age=63072000; includeSubDomains; preload/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Cross-Origin-Opener-Policy: same-origin-allow-popups/);
  assert.match(headers, /Cross-Origin-Resource-Policy: same-site/);
  assert.match(
    headers,
    /Permissions-Policy: geolocation=\(self\), camera=\(\), microphone=\(\), payment=\(\), usb=\(\), browsing-topics=\(\)/,
    'camera, microphone, payment and usb must stay denied',
  );
});

test('the content security policy keeps its script and frame boundaries', async () => {
  const headers = await read('public/_headers');
  const csp = headers.match(/Content-Security-Policy: (.+)/)?.[1];
  assert.ok(csp, '_headers must declare a Content-Security-Policy');

  // The audit records the absence of script-src 'unsafe-inline' as a strength.
  // Losing it during the hosting migration would be a real regression, so it is
  // asserted rather than assumed.
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'/);

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /upgrade-insecure-requests/);
});

test('caching rules distinguish immutable assets from the shell', async () => {
  const headers = await read('public/_headers');

  // The shell must never be cached, or a released build can be pinned forever.
  assert.match(headers, /Cache-Control: no-store, max-age=0/);
  // Fingerprinted assets are safe to cache immutably.
  assert.match(headers, /^\/assets\/\*$/m);
  assert.match(headers, /Cache-Control: public, max-age=31536000, immutable/);
  // The service worker must revalidate or clients can never be updated.
  assert.match(headers, /^\/sw\.js$/m);
  assert.match(headers, /Cache-Control: public, max-age=0, must-revalidate/);
  assert.match(headers, /Service-Worker-Allowed: \//);
});

test('the SPA fallback preserves deep links without changing the URL', async () => {
  const redirects = await read('public/_redirects');
  // A 200 rewrite, not a 301/302: the client router needs the original path.
  assert.match(
    redirects,
    /^\/\*\s+\/index\.html\s+200$/m,
    '_redirects must rewrite unknown paths to index.html with status 200',
  );
});

test('the Cloudflare edge configuration ships in the build output', async () => {
  // Vite copies public/ verbatim into dist/, so these must live there rather
  // than at the repository root, or Cloudflare never sees them.
  await assert.doesNotReject(read('public/_headers'), 'public/_headers must exist');
  await assert.doesNotReject(read('public/_redirects'), 'public/_redirects must exist');
});

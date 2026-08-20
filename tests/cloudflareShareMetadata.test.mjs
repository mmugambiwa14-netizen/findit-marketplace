import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest } from '../functions/_middleware.js';
import { renderPagesRuntimeConfig, validatePagesPublishableKey } from '../scripts/prepare-pages-functions-runtime.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const propertyId = 'a4ed6157-3a51-4386-9392-1e33c41081dd';
const genericHtml = `<!doctype html><html><head>
  <title>PeekaListing Marketplace</title>
  <meta name="description" content="Generic marketplace description">
  <meta property="og:title" content="PeekaListing Marketplace">
  <meta property="og:description" content="Generic marketplace description">
  <meta property="og:image" content="/brand/peekalisting-icon-512.png">
  <meta name="twitter:card" content="summary_large_image">
</head><body><div id="root"></div></body></html>`;

function pageContext(url, photos) {
  return {
    request: new Request(url),
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
    },
    next: async () => new Response(genericHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    photos,
  };
}

function publicRecord(photos) {
  return [{
    id: propertyId,
    kind: 'property',
    title: 'Family house for Sale in Harare',
    description: 'Four-bedroom family home with a landscaped garden.',
    photos,
    price: 135000,
    currency: 'USD',
    public_location_label: 'Harare',
  }];
}

test('share URLs retain only the stable listing reference', async () => {
  const [share, contact] = await Promise.all([
    read('src/lib/share.js'),
    read('src/components/listings/ContactButtons.jsx'),
  ]);
  assert.match(share, /searchParams\.set\(['"]ref['"], code\)/);
  assert.doesNotMatch(share, /searchParams\.set\(['"](?:title|preview|summary)['"]/);
  assert.doesNotMatch(share, /Preview image:/);
  assert.doesNotMatch(contact, /sharePayload\.imageUrl\].*join/);
  assert.match(contact, /WhatsApp reads the listing-specific Open Graph card/);
});
test('Cloudflare replaces generic metadata with one authoritative public listing card', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, '/rest/v1/listings');
    assert.equal(url.searchParams.get('id'), `eq.${propertyId}`);
    assert.equal(url.searchParams.get('kind'), 'eq.property');
    return Response.json(publicRecord(['https://images.example.com/house.jpg?width=1200&height=630']));
  };
  try {
    const context = pageContext(`https://staging.peekalisting.com/property/${propertyId}?ref=PR-NZGS&title=Injected&preview=https%3A%2F%2Fevil.example%2Ffake.jpg`);
    const response = await onRequest(context);
    const html = await response.text();
    assert.equal((html.match(/property="og:title"/g) || []).length, 1);
    assert.match(html, /property="og:title" content="Family house for Sale in Harare"/);
    assert.match(html, /property="og:image" content="https:\/\/images\.example\.com\/house\.jpg\?width=1200&amp;height=630"/);
    assert.match(html, new RegExp(`property="og:url" content="https://staging\\.peekalisting\\.com/property/${propertyId}"`));
    assert.doesNotMatch(html, /PeekaListing Marketplace|Injected|evil\.example/);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('private listing covers use a stable Cloudflare route and anonymous Supabase signing', async () => {
  const originalFetch = globalThis.fetch;
  const storagePath = '0da535d0-1b36-4bcf-9d8e-f9abb148e923/staging/37683bf6-b595-4f3b-98d6-ad82ba2eea46.webp';
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    requests.push({ url, init });
    if (url.pathname === '/rest/v1/listings') return Response.json(publicRecord([storagePath]));
    if (url.pathname.includes('/storage/v1/object/sign/listing-images/')) {
      return Response.json({ signedURL: '/object/sign/listing-images/example.webp?token=public-image-token' });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const page = await onRequest(pageContext(`https://staging.peekalisting.com/property/${propertyId}?ref=PR-NZGS`));
    const html = await page.text();
    assert.match(html, new RegExp(`property="og:image" content="https://staging\\.peekalisting\\.com/share-image/property/${propertyId}"`));

    const imageContext = pageContext(`https://staging.peekalisting.com/share-image/property/${propertyId}`, [storagePath]);
    const image = await onRequest(imageContext);
    assert.equal(image.status, 302);
    assert.equal(image.headers.get('location'), 'https://example.supabase.co/storage/v1/object/sign/listing-images/example.webp?token=public-image-token');
    assert.equal(requests.at(-1).init.headers.Authorization, 'Bearer sb_publishable_test_only');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cloudflare keeps preview and production metadata bindings separate without privileged keys', async () => {
  const [middleware, preview, production, generated] = await Promise.all([
    read('functions/_middleware.js'),
    read('.github/workflows/peekalisting-preview.yml'),
    read('.github/workflows/deploy-production-pages.yml'),
    read('cloudflare/pages-runtime-config.js'),
  ]);
  assert.match(preview, /deployment_configs:\{preview:\{env_vars:/);
  assert.match(production, /deployment_configs:\{production:\{env_vars:/);
  assert.match(preview, /SUPABASE_PUBLISHABLE_KEY:\{type:"secret_text"/);
  assert.match(production, /SUPABASE_PUBLISHABLE_KEY:\{type:"secret_text"/);
  assert.match(preview, /DEPLOYMENT_ENV:\{type:"plain_text",value:"staging"\}/);
  assert.match(production, /DEPLOYMENT_ENV:\{type:"plain_text",value:"production"\}/);
  assert.match(preview, /prepare-pages-functions-runtime\.mjs/);
  assert.match(production, /prepare-pages-functions-runtime\.mjs/);
  assert.ok(
    preview.indexOf('Deploy the isolated staging project')
      < preview.indexOf('Configure isolated staging metadata bindings'),
    'staging metadata must be applied after Wrangler uploads file-managed variables',
  );
  assert.ok(
    production.indexOf('Deploy production branch without changing DNS')
      < production.indexOf('Configure production metadata bindings'),
    'production metadata must be applied after Wrangler uploads file-managed variables',
  );
  assert.doesNotMatch(generated, /https:\/\/|sb_publishable_|eyJ/);
  assert.doesNotMatch(middleware, /service[_-]?role|secret[_-]?key/i);
});

test('Functions deployment config accepts only publishable or anonymous Supabase credentials', () => {
  assert.equal(validatePagesPublishableKey('sb_publishable_browser_safe'), 'sb_publishable_browser_safe');
  assert.throws(() => validatePagesPublishableKey('sb_secret_forbidden'), /secret key cannot be bundled/i);
  const jwt = (role) => [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(JSON.stringify({ role })).toString('base64url'),
    'signature',
  ].join('.');
  assert.equal(validatePagesPublishableKey(jwt('anon')), jwt('anon'));
  assert.throws(() => validatePagesPublishableKey(jwt('service_role')), /publishable or legacy anon key/i);
  const source = renderPagesRuntimeConfig('https://example.supabase.co', 'sb_publishable_browser_safe');
  assert.match(source, /supabaseUrl: "https:\/\/example\.supabase\.co"/);
  assert.match(source, /supabasePublishableKey: "sb_publishable_browser_safe"/);
});

test('Cloudflare emits a cached production sitemap with live public marketplace records', async () => {
  const originalFetch = globalThis.fetch;
  const serviceId = 'c584f420-f91e-4a44-bdbc-c5aca5d66339';
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname === '/rest/v1/listings') {
      assert.equal(url.searchParams.get('country_code'), 'eq.ZW');
      assert.equal(url.searchParams.get('status'), 'in.(available,under_offer)');
      return Response.json([{ id: propertyId, kind: 'property', updated_at: '2026-08-19T12:00:00Z' }]);
    }
    if (url.pathname === '/rest/v1/services') {
      assert.equal(url.searchParams.get('category'), 'neq.legal');
      return Response.json([{ id: serviceId, updated_at: '2026-08-18T12:00:00Z' }]);
    }
    throw new Error('Unexpected request: ' + url);
  };
  try {
    const response = await onRequest(pageContext('https://peekalisting.com/sitemap.xml'));
    const xml = await response.text();
    assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
    assert.match(response.headers.get('cache-control'), /s-maxage=3600/);
    assert.match(xml, new RegExp('<loc>https://peekalisting\\.com/property/' + propertyId + '</loc>'));
    assert.match(xml, new RegExp('<loc>https://peekalisting\\.com/service/' + serviceId + '</loc>'));
    assert.match(xml, /<lastmod>2026-08-19T12:00:00\.000Z<\/lastmod>/);
    assert.doesNotMatch(xml, /staging\.peekalisting/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cloudflare noindexes staging and private routes while enriching public production pages', async () => {
  const staging = await onRequest(pageContext('https://staging.peekalisting.com/services'));
  const stagingHtml = await staging.text();
  assert.equal(staging.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(stagingHtml, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(stagingHtml, /<title>Find services in Zimbabwe \| PeekaListing<\/title>/);

  const privatePage = await onRequest(pageContext('https://peekalisting.com/settings'));
  assert.equal(privatePage.headers.get('x-robots-tag'), 'noindex, nofollow');

  const home = await onRequest(pageContext('https://www.peekalisting.com/'));
  const homeHtml = await home.text();
  assert.equal(home.headers.get('x-robots-tag'), null);
  assert.match(homeHtml, /<link rel="canonical" href="https:\/\/peekalisting\.com\/">/);
  assert.match(homeHtml, /"@type":"SearchAction"/);
  assert.match(homeHtml, /https:\/\/peekalisting\.com\/search\?q=\{search_term_string\}/);
});

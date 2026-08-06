import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('navigation uses the canonical PeekaListing wordmark and mark', async () => {
  const logo = await read('src/components/BrandLogo.jsx');
  assert.match(logo, /aria-label="PeekaListing"/);
  assert.match(logo, /peekalisting-binoculars\.svg/);
  assert.match(logo, /Peeka/);
  assert.match(logo, /Listing/);
  assert.doesNotMatch(logo, />Find</);
});

test('browser and PWA metadata identify PeekaListing', async () => {
  const html = await read('index.html');
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  assert.match(html, /PeekaListing Marketplace/);
  assert.match(html, /application-name" content="PeekaListing"/);
  assert.match(html, /peekalisting-binoculars\.svg/);
  assert.equal(manifest.name, 'PeekaListing Marketplace');
  assert.equal(manifest.short_name, 'PeekaListing');
  assert.ok(manifest.icons.every((icon) => icon.src === '/brand/peekalisting-binoculars.svg'));
});

test('startup and push fallbacks never expose the former product name', async () => {
  const startup = await read('src/main.jsx');
  const push = await read('public/push-sw.js');
  assert.match(startup, /PeekaListing startup failed/);
  assert.match(startup, /PeekaListing preview could not start/);
  assert.doesNotMatch(startup, /FindIt/);
  assert.match(push, /title: 'PeekaListing'/);
  assert.match(push, /peekalisting-binoculars\.svg/);
});

test('service worker rotates PeekaListing caches and retires legacy caches', async () => {
  const worker = await read('public/sw.js');
  assert.match(worker, /peekalisting-shell-/);
  assert.match(worker, /peekalisting-assets-/);
  assert.match(worker, /peekalisting-binoculars\.svg/);
  assert.match(worker, /name\.startsWith\('findit-'\)/);
});

test('live help content reflects verified businesses and automatic publication', async () => {
  const faq = await read('src/pages/FAQs.jsx');
  assert.match(faq, /Does PeekaListing verify businesses/);
  assert.match(faq, /Validated listings publish immediately/);
  assert.match(faq, /Peeks publish automatically/);
  assert.doesNotMatch(faq, /messaging has completed migration/);
  assert.doesNotMatch(faq, /FindIt/);
});

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
  // This previously required every manifest icon to be the binocular SVG, which
  // was unsatisfiable alongside webAppManifest.test.mjs: browsers will not offer
  // installation without PNG icons at 192 and 512 plus a maskable, so the two
  // contracts contradicted each other. The intent here is brand ownership, not
  // file format -- assert that install metadata carries PeekaListing assets and
  // never the retired FindIt rasters, which is what actually matters and is
  // strictly harder to pass than the old check.
  assert.ok(
    manifest.icons.every((icon) => icon.src.startsWith('/brand/peekalisting-')),
    'every manifest icon must be a PeekaListing asset',
  );
  assert.ok(
    manifest.icons.every((icon) => !/findit/i.test(icon.src)),
    'install metadata must never reference a retired FindIt raster',
  );
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

test('live user-facing surfaces never expose the former product name', async () => {
  const paths = [
    'src/pages/PropertyDetail.jsx',
    'src/pages/CarDetail.jsx',
    'src/pages/MachineryDetail.jsx',
    'src/pages/ServiceDetail.jsx',
    'src/pages/SellerProfile.jsx',
    'src/pages/Profile.jsx',
    'src/pages/Tours.jsx',
    'src/components/AppErrorBoundary.jsx',
    'src/components/AuthLayout.jsx',
    'src/components/auth/AccountBlocked.jsx',
    'src/components/auth/GuestPromptSheet.jsx',
    'src/components/layout/AppLayout.jsx',
    'src/components/layout/BottomNav.jsx',
    'src/components/layout/MobileTopNav.jsx',
    'src/components/layout/SiteFooter.jsx',
    'src/components/layout/TopNav.jsx',
    'src/components/listings/ContactButtons.jsx',
    'src/components/listings/ListingDetailLayout.jsx',
    'src/components/listings/ListingDetailTabs.jsx',
    'src/components/listings/MessageDialog.jsx',
    'src/components/pwa/InstallPrompt.jsx',
    'src/components/discover/HomePeekRail.jsx',
    'src/components/tours/TourUploader.jsx',
    'src/services/listingTourContracts.js',
    'public/offline.html',
  ];
  const sources = await Promise.all(paths.map(read));
  for (let index = 0; index < sources.length; index += 1) {
    assert.doesNotMatch(sources[index], /\bFindIt\b/, `${paths[index]} must not expose the retired product name`);
  }
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

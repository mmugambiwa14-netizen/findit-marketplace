import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  detailTabs,
  featureItem,
  propertyDetail,
  carDetail,
  machineryDetail,
  serviceDetail,
] = await Promise.all([
  read('src/components/listings/ListingDetailTabs.jsx'),
  read('src/components/listings/ListingFeatureItem.jsx'),
  read('src/pages/PropertyDetail.jsx'),
  read('src/pages/CarDetail.jsx'),
  read('src/pages/MachineryDetail.jsx'),
  read('src/pages/ServiceDetail.jsx'),
]);

test('asset listing details expose the shared four-section information model', () => {
  for (const source of [propertyDetail, carDetail, machineryDetail]) {
    assert.match(source, /<ListingDetailTabs>/);
    for (const id of ['listing-info', 'description', 'location', 'seller']) {
      assert.match(source, new RegExp(`<ListingTabSection id="${id}"`));
    }
  }
});

test('service details expose the shared listing detail information model', () => {
  assert.match(serviceDetail, /<ListingDetailTabs>/);
  for (const id of ['listing-info', 'description', 'location', 'seller']) {
    assert.match(serviceDetail, new RegExp(`<ListingTabSection id="${id}"`));
  }
});

test('description remains seller-written text with bounded read more/read less behavior', () => {
  assert.match(detailTabs, /String\(value \|\| ''\)\.trim\(\)/);
  assert.match(detailTabs, /description\.length > 420/);
  assert.match(detailTabs, /Read less/);
  assert.match(detailTabs, /Read more/);
  assert.doesNotMatch(detailTabs, /dangerouslySetInnerHTML/);
});

test('location map communicates the public-area privacy boundary', () => {
  assert.match(detailTabs, /SearchResultsMap/);
  assert.match(detailTabs, /approximate public area/);
  assert.match(detailTabs, /private live location/);
  assert.match(detailTabs, /Open in Google Maps/);
});

test('seller surface exposes identity context and a dedicated profile route', () => {
  assert.match(detailTabs, /\/seller\/\$\{encodeURIComponent\(sellerId\)\}/);
  assert.match(detailTabs, /active listing/);
  assert.match(detailTabs, /Joined/);
});

test('asset listings prioritize Peek Requests before secondary pricing controls', () => {
  for (const source of [propertyDetail, carDetail, machineryDetail]) {
    const peekIndex = source.indexOf('<PeekThreadsSection');
    const variantIndex = source.indexOf('<VariantSelector');
    const priceIndex = source.indexOf('<PriceBreakdown');
    assert.ok(peekIndex >= 0, 'Peek Requests must be present');
    assert.ok(variantIndex > peekIndex, 'variant controls must follow Peek Requests');
    assert.ok(priceIndex > peekIndex, 'price breakdown must follow Peek Requests');
  }
  assert.match(serviceDetail, /<PeekThreadsSection/);
});

test('listing section navigation stays in normal document flow with fluid accessible tabs', () => {
  assert.doesNotMatch(detailTabs, /\bsticky\b/);
  assert.match(detailTabs, /<AnimatedTabs/);
  assert.match(detailTabs, /semantics="tabs"/);
  assert.match(detailTabs, /ariaLabel="Listing detail sections"/);
  assert.match(detailTabs, /role="tabpanel"/);
  assert.match(detailTabs, /aria-labelledby=/);
  assert.match(detailTabs, /availableTabs/);
  for (const label of ['Details', 'Description', 'Location', 'Seller']) {
    assert.match(detailTabs, new RegExp(label));
  }
});

test('listing information uses reusable raised cards', () => {
  assert.match(featureItem, /min-h-\[4\.25rem\].*border-b.*last:border-b-0/);
  assert.match(featureItem, /max-w-\[58%\].*text-right/);
  assert.match(featureItem, /odd:bg-muted\/20/);
  assert.match(detailTabs, /rounded-3xl border border-border\/80 bg-card\/90/);
});

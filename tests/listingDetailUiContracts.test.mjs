import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  appLayout,
  detailActions,
  detailTabs,
  detailLayout,
  featureItem,
  contactButtons,
  listingSummary,
  propertyDetail,
  carDetail,
  machineryDetail,
  serviceDetail,
] = await Promise.all([
  read('src/components/layout/AppLayout.jsx'),
  read('src/components/listings/ListingDetailActions.jsx'),
  read('src/components/listings/ListingDetailTabs.jsx'),
  read('src/components/listings/ListingDetailLayout.jsx'),
  read('src/components/listings/ListingFeatureItem.jsx'),
  read('src/components/listings/ContactButtons.jsx'),
  read('src/components/listings/ListingSummary.jsx'),
  read('src/pages/PropertyDetail.jsx'),
  read('src/pages/CarDetail.jsx'),
  read('src/pages/MachineryDetail.jsx'),
  read('src/pages/ServiceDetail.jsx'),
]);

test('listing detail routes use a self-contained mobile shell', () => {
  assert.match(appLayout, /LISTING_DETAIL_PREFIXES/);
  assert.match(appLayout, /const listingDetail = isListingDetailRoute\(location\.pathname\)/);
  assert.match(appLayout, /showSharedMobileTopBar = !immersiveConversation && !immersivePeek && !listingDetail/);
  assert.match(detailActions, /md:hidden/);
  assert.match(detailActions, /bg-black\/55/);
});

test('listing summaries share one elevated hierarchy across every public detail type', () => {
  assert.match(listingSummary, /aria-label="Listing summary"/);
  assert.match(listingSummary, /-mt-3 rounded-\[1\.75rem\]/);
  assert.match(listingSummary, /shadow-floating backdrop-blur-xl/);
  assert.match(listingSummary, /text-\[2rem\] font-black/);
  assert.match(listingSummary, /rounded-full border border-border\/70 bg-muted\/35/);

  for (const source of [propertyDetail, carDetail, machineryDetail, serviceDetail]) {
    assert.match(source, /import ListingSummary from "@\/components\/listings\/ListingSummary"/);
    assert.match(source, /<ListingSummary/);
    assert.match(source, /grid grid-cols-1 gap-3 min-\[430px\]:grid-cols-2/);
    assert.match(source, /tour\?\.status === "ready"/);
    assert.match(source, />Video proof available<\/Badge>/);
  }
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

test('listing section navigation is a sticky elevated segmented surface', () => {
  assert.match(detailTabs, /sticky top-\[calc\(env\(safe-area-inset-top,0px\)\+3\.75rem\)\]/);
  assert.match(detailTabs, /rounded-2xl border border-border\/80 bg-card\/90 p-1 shadow-floating/);
  assert.match(detailTabs, /bg-primary\/12 text-primary shadow-sm/);
  for (const label of ['Details', 'Description', 'Location', 'Seller']) {
    assert.match(detailTabs, new RegExp(label));
  }
  assert.match(detailTabs, /role="tablist"/);
  assert.match(detailTabs, /role="tabpanel"/);
  assert.match(detailTabs, /data-listing-detail-tab/);
});

test('listing information uses reusable raised cards', () => {
  assert.match(featureItem, /rounded-2xl border border-border\/80 bg-card\/90/);
  assert.match(featureItem, /locked-icon-tile h-10 w-10/);
  assert.match(detailTabs, /rounded-3xl border border-border\/80 bg-card\/90/);
});

test('mobile contact is a primary full-width action with privacy-safe choices', () => {
  assert.match(detailLayout, /fixed inset-x-0 bottom-0/);
  assert.match(detailLayout, /max-w-4xl rounded-2xl border border-border\/80 bg-card\/94/);
  assert.match(contactButtons, /h-12 w-full rounded-2xl shadow-floating/);
  assert.match(contactButtons, /Contact \{recipientLabel\}/);
  assert.match(contactButtons, /Phone numbers and email addresses stay hidden in PeekaListing/);
});

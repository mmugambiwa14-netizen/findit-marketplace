import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  appLayout,
  detailActions,
  detailTabs,
  detailLayout,
  lightbox,
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
  read('src/components/ui/image-lightbox.jsx'),
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
  assert.match(listingSummary, /embedded = false/);
  assert.match(listingSummary, /mx-0 mt-0 bg-card\/90/);
  assert.match(listingSummary, /shadow-floating backdrop-blur-xl/);
  assert.match(listingSummary, /text-\[2rem\] font-black/);
  assert.match(listingSummary, /rounded-full border border-border\/70 bg-muted\/35/);

  for (const source of [propertyDetail, carDetail, machineryDetail, serviceDetail]) {
    assert.match(source, /import ListingSummary from "@\/components\/listings\/ListingSummary"/);
    assert.match(source, /<ListingSummary\s+embedded/);
    assert.match(source, /mt-5 overflow-hidden rounded-3xl border border-border\/80 bg-card\/90 shadow-sm/);
    assert.match(source, /tour\?\.status === "ready"/);
    assert.match(source, />Video proof available<\/Badge>/);
  }
});

test('mobile listing media controls clear the status bar and support photo swipes', () => {
  assert.match(detailActions, /pt-\[max\(3\.75rem,calc\(env\(safe-area-inset-top\)\+1rem\)\)\]/);
  assert.match(lightbox, /\[&>button\]:top-\[max\(3\.75rem,calc\(env\(safe-area-inset-top\)\+1rem\)\)\]/);
  assert.match(lightbox, /onTouchStart=\{handleTouchStart\}/);
  assert.match(lightbox, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(lightbox, /Math\.abs\(deltaX\) < Math\.abs\(deltaY\) \* 1\.2/);
  assert.match(lightbox, /if \(!start \|\| zoomed \|\| total < 2\) return/);
  assert.match(lightbox, /Swipe left or right to view another photo/);
});

test('section tabs follow media and the listing summary belongs only to Details', () => {
  for (const source of [propertyDetail, carDetail, machineryDetail, serviceDetail]) {
    const mediaIndex = source.indexOf('<ListingMediaViewer');
    const tabsIndex = source.indexOf('<ListingDetailTabs>');
    const detailsIndex = source.indexOf('<ListingTabSection id="listing-info"');
    const summaryIndex = source.indexOf('<ListingSummary');
    assert.ok(mediaIndex >= 0, 'listing media must be present');
    assert.ok(tabsIndex > mediaIndex, 'section tabs must follow listing media');
    assert.ok(detailsIndex > tabsIndex, 'Details must be a tab panel');
    assert.ok(summaryIndex > detailsIndex, 'the listing summary must render inside Details');
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

test('listing section navigation stays in normal document flow as an elevated segmented surface', () => {
  assert.doesNotMatch(detailTabs, /\bsticky\b/);
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
  assert.match(featureItem, /min-h-\[4\.25rem\].*border-b.*last:border-b-0/);
  assert.match(featureItem, /max-w-\[58%\].*text-right/);
  assert.match(featureItem, /odd:bg-muted\/20/);
  assert.match(detailTabs, /rounded-3xl border border-border\/80 bg-card\/90/);
});

test('mobile contact is a primary full-width action with privacy-safe choices', () => {
  assert.match(detailLayout, /fixed inset-x-0 bottom-0/);
  assert.match(detailLayout, /max-w-4xl rounded-2xl border border-border\/80 bg-card\/94/);
  assert.match(contactButtons, /h-12 w-full rounded-2xl shadow-floating/);
  assert.match(contactButtons, /Contact \{recipientLabel\}/);
  assert.match(contactButtons, /Phone numbers and email addresses stay hidden in PeekaListing/);
});

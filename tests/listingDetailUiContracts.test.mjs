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
] = await Promise.all([
  read('src/components/layout/AppLayout.jsx'),
  read('src/components/listings/ListingDetailActions.jsx'),
  read('src/components/listings/ListingDetailTabs.jsx'),
  read('src/components/listings/ListingDetailLayout.jsx'),
  read('src/components/listings/ListingFeatureItem.jsx'),
  read('src/components/listings/ContactButtons.jsx'),
]);

test('listing detail routes use a self-contained mobile shell', () => {
  assert.match(appLayout, /LISTING_DETAIL_PREFIXES/);
  assert.match(appLayout, /const listingDetail = isListingDetailRoute\(location\.pathname\)/);
  assert.match(appLayout, /showSharedMobileTopBar = !immersiveConversation && !immersivePeek && !listingDetail/);
  assert.match(detailActions, /md:hidden/);
  assert.match(detailActions, /bg-black\/55/);
});

test('listing section navigation is a sticky elevated segmented surface', () => {
  assert.match(detailTabs, /sticky top-\[calc\(env\(safe-area-inset-top,0px\)\+3\.75rem\)\]/);
  assert.match(detailTabs, /rounded-2xl border border-border\/80 bg-card\/90 p-1 shadow-floating/);
  assert.match(detailTabs, /bg-primary\/12 text-primary shadow-sm/);
  for (const label of ['Listing info', 'Description', 'Location', 'Seller']) {
    assert.match(detailTabs, new RegExp(label));
  }
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

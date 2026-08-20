import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  app,
  home,
  discoverGrid,
  theme,
  navigation,
  bottomNav,
  search,
  listingCard,
  serviceCard,
  marketplaceCard,
  propertyDetail,
  carDetail,
  machineryDetail,
  serviceDetail,
  login,
  register,
] = await Promise.all([
  read('src/App.jsx'),
  read('src/pages/Home.jsx'),
  read('src/components/discover/DiscoverCategoryGrid.jsx'),
  read('src/index.css'),
  read('src/lib/navigationConfig.js'),
  read('src/components/layout/BottomNav.jsx'),
  read('src/pages/Search.jsx'),
  read('src/components/listings/ListingCard.jsx'),
  read('src/components/services/ServiceCard.jsx'),
  read('src/components/marketplace/MarketplaceCard.jsx'),
  read('src/pages/PropertyDetail.jsx'),
  read('src/pages/CarDetail.jsx'),
  read('src/pages/MachineryDetail.jsx'),
  read('src/pages/ServiceDetail.jsx'),
  read('src/pages/Login.jsx'),
  read('src/pages/Register.jsx'),
]);

test('Milestone A applies the approved blue light and dark design tokens', () => {
  assert.match(theme, /:root\s*\{[\s\S]*?color-scheme:\s*light/);
  assert.match(theme, /--background:\s*216 45% 97%/);
  assert.match(theme, /--primary:\s*217 91% 48%/);
  assert.match(theme, /\.dark\s*\{[\s\S]*?--background:\s*223 58% 5%/);
  assert.match(theme, /\.dark\s*\{[\s\S]*?--primary:\s*214 100% 48%/);
  assert.match(theme, /min-width:\s*320px/);
  assert.match(theme, /prefers-reduced-motion/);
});

test('Discover is minimal and performs no listing-feed query in the page shell', () => {
  assert.doesNotMatch(home, /useQuery|getLatestPublicListings|ListingGrid|featured|auction/i);
  assert.match(home, /DiscoverCategoryGrid/);
  assert.match(discoverGrid, /\/search\?type=property/);
  assert.match(discoverGrid, /\/search\?type=car/);
  assert.match(discoverGrid, /\/search\?type=machinery/);
  assert.match(discoverGrid, /\/services/);
});

test('canonical navigation and compatibility routes are present', () => {
  for (const label of ['Discover', 'Peeks', 'Post', 'Chats', 'Profile']) {
    assert.match(navigation, new RegExp(`label: ['"]${label}['"]`));
  }
  assert.match(bottomNav, /PRIMARY_NAV_ITEMS/);
  assert.match(app, /path="\/post"/);
  assert.match(app, /path="\/chats"/);
  assert.match(app, /path="\/chats\/:conversationId"/);
  assert.match(app, /path="\/create" element={<LegacyPathRedirect to="\/post" \/>}/);
  assert.match(app, /path="\/messages" element={<LegacyPathRedirect to="\/chats" \/>}/);
  assert.match(app, /path="\/tours" element={<LegacyPathRedirect to="\/peek" \/>}/);
  assert.match(app, /LegacyConversationRedirect/);
});

test('Search keeps its service boundary and is decomposed into focused UI components', () => {
  assert.match(search, /searchPublicListingsPage/);
  for (const component of ['CategoryResultsHeader', 'SearchToolbar', 'ActiveFilterChips', 'FilterSheet', 'SortSheet', 'ListingResults']) {
    assert.match(search, new RegExp(component));
  }
});

test('listing and service cards share one visual shell with a dormant video contract', () => {
  assert.match(listingCard, /MarketplaceCard/);
  assert.match(serviceCard, /MarketplaceCard/);
  assert.match(marketplaceCard, /tour/);
  assert.match(marketplaceCard, /media=tour/);
});

test('all public detail types use the shared media contract and Peek language', () => {
  for (const source of [propertyDetail, carDetail, machineryDetail, serviceDetail]) {
    assert.match(source, /ListingMediaViewer/);
    assert.match(source, /Take a Peek/);
  }
  for (const source of [propertyDetail, carDetail, machineryDetail, serviceDetail]) {
    assert.doesNotMatch(source, /Watch Peek|See their work/);
  }
});

test('protected sign-in and registration retain the requested internal destination', () => {
  assert.match(login, /sanitizeReturnTo/);
  assert.match(login, /returnTo/);
  assert.match(register, /sanitizeReturnTo/);
  assert.match(register, /signInWithOAuth\(provider, returnTo\)/);
});

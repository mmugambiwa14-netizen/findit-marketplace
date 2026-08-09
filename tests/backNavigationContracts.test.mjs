import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const paths = [
  'src/App.jsx',
  'src/components/AuthLayout.jsx',
  'src/components/ProtectedRoute.jsx',
  'src/components/admin/AdminSidebarCollapsible.jsx',
  'src/components/business/BusinessPublishingGate.jsx',
  'src/components/layout/AdminLayout.jsx',
  'src/components/layout/BackButton.jsx',
  'src/components/listings/ListingDetailLayout.jsx',
  'src/components/listings/ListingDetailActions.jsx',
  'src/components/search/CategoryResultsHeader.jsx',
  'src/lib/navigation.js',
  'src/lib/PageNotFound.jsx',
  'src/pages/BusinessProfiles.jsx',
  'src/pages/BuyerPeekRequests.jsx',
  'src/pages/ContactSupport.jsx',
  'src/pages/CreateListing.jsx',
  'src/pages/CreateService.jsx',
  'src/pages/FAQs.jsx',
  'src/pages/Inquiries.jsx',
  'src/pages/LegalPage.jsx',
  'src/pages/MyListings.jsx',
  'src/pages/MyServices.jsx',
  'src/pages/NotificationCenter.jsx',
  'src/pages/Profile.jsx',
  'src/pages/PublicBusinessProfile.jsx',
  'src/pages/Saved.jsx',
  'src/pages/SellerProfile.jsx',
  'src/pages/Settings.jsx',
  'src/pages/Tours.jsx',
  'src/pages/ToursPlaceholder.jsx',
];

const sources = new Map(await Promise.all(paths.map(async (path) => [path, await read(path)])));
const source = (path) => sources.get(path);
const { goBackOrHome } = await import('../src/lib/navigation.js');

test('the shared back control is accessible and falls back safely for direct entry', () => {
  const button = source('src/components/layout/BackButton.jsx');
  const navigation = source('src/lib/navigation.js');
  assert.match(button, /goBackOrHome\(navigate, fallback\)/);
  assert.match(button, /aria-label=\{label\}/);
  assert.match(button, /title=\{label\}/);
  assert.match(button, /h-11 w-11/);
  assert.match(button, /aria-hidden="true"/);
  assert.match(navigation, /window\.history\.state\?\.idx/);
  assert.match(navigation, /Number\.isInteger\(routerHistoryIndex\) && routerHistoryIndex > 0/);
  assert.match(navigation, /navigate\(fallback\)/);
});

test('back navigation uses the React Router history index before the direct-entry fallback', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const destinations = [];

  try {
    globalThis.window = { history: { state: { idx: 2 }, length: 3 }, location: { origin: 'https://staging.example' } };
    globalThis.document = { referrer: '' };
    goBackOrHome((destination) => destinations.push(destination), '/search');

    globalThis.window = { history: { state: { idx: 0 }, length: 1 }, location: { origin: 'https://staging.example' } };
    goBackOrHome((destination) => destinations.push(destination), '/search');
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }

  assert.deepEqual(destinations, [-1, '/search']);
});

test('every rendered route family except the Discover root owns visible back navigation', () => {
  const expectations = [
    ['sign-in and registration', 'src/components/AuthLayout.jsx', /Back to marketplace/],
    ['role-protected error states', 'src/components/ProtectedRoute.jsx', /<BackButton/],
    ['Search and Services', 'src/components/search/CategoryResultsHeader.jsx', /<BackButton/],
    ['listing detail loading, error and missing states', 'src/components/listings/ListingDetailLayout.jsx', /<BackButton/],
    ['loaded listing detail pages', 'src/components/listings/ListingDetailActions.jsx', /aria-label="Go back"/],
    ['seller profiles', 'src/pages/SellerProfile.jsx', /<BackButton/],
    ['public business profiles', 'src/pages/PublicBusinessProfile.jsx', /<BackButton/],
    ['Peeks', 'src/pages/Tours.jsx', /<BackButton/],
    ['Peeks fallback', 'src/pages/ToursPlaceholder.jsx', /<BackButton/],
    ['Help', 'src/pages/FAQs.jsx', /aria-label="Go back"/],
    ['contact support', 'src/pages/ContactSupport.jsx', /<ArrowLeft/],
    ['legal documents', 'src/pages/LegalPage.jsx', /<ArrowLeft/],
    ['listing creation', 'src/pages/CreateListing.jsx', /goBackOrHome\(navigate/],
    ['publishing access choice', 'src/components/business/BusinessPublishingGate.jsx', /<BackButton/],
    ['service creation', 'src/pages/CreateService.jsx', /aria-label="Go back"/],
    ['saved listings', 'src/pages/Saved.jsx', /aria-label="Back to Discover"/],
    ['Profile', 'src/pages/Profile.jsx', /<BackButton/],
    ['owned listings', 'src/pages/MyListings.jsx', /aria-label="Go back"/],
    ['owned services', 'src/pages/MyServices.jsx', /<BackButton/],
    ['Peek requests', 'src/pages/BuyerPeekRequests.jsx', /aria-label="Go back"/],
    ['Settings', 'src/pages/Settings.jsx', /aria-label="Go back"/],
    ['Chats', 'src/pages/Inquiries.jsx', /<ArrowLeft/],
    ['business profile management', 'src/pages/BusinessProfiles.jsx', /aria-label="Back to profile"/],
    ['Notifications', 'src/pages/NotificationCenter.jsx', /aria-label="Go back"/],
    ['mobile admin pages', 'src/components/layout/AdminLayout.jsx', /<BackButton/],
    ['desktop admin pages', 'src/components/admin/AdminSidebarCollapsible.jsx', /Back to app/],
    ['unknown routes', 'src/lib/PageNotFound.jsx', /<BackButton/],
  ];

  for (const [label, path, pattern] of expectations) {
    assert.match(source(path), pattern, `${label} must expose back navigation`);
  }

  assert.match(source('src/App.jsx'), /<Route path="\/" element=\{<Home \/>\}/);
});

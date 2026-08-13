import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [viewport, nav, search, map, design, indexHtml, authService, oauthCallback, indexCss] = await Promise.all([
  read('src/pwa-viewport.css'),
  read('src/components/layout/BottomNav.jsx'),
  read('src/components/discover/DiscoverSearch.jsx'),
  read('src/components/discover/DiscoverMapView.jsx'),
  read('src/findit-locked-design.css'),
  read('index.html'),
  read('src/services/authService.js'),
  read('src/components/auth/OAuthCallback.jsx'),
  read('src/index.css'),
]);

test('mobile form controls cannot trigger document auto-zoom', () => {
  assert.match(viewport, /input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\):not\(\[type='range'\]\):not\(\[type='file'\]\)/);
  assert.match(viewport, /font-size: 16px !important/);
  assert.match(search, /text-base placeholder:text-muted-foreground\/80 md:text-sm/);
  assert.match(indexHtml, /maximum-scale=1(?:\.0)?/);
  assert.match(indexHtml, /user-scalable=no/);
});

test('mobile navigation stays centered and contained by the viewport', () => {
  assert.doesNotMatch(nav, /fixed inset-x-2\.5/);
  assert.doesNotMatch(nav, /findit-mobile-nav fixed bottom-2\.5/);
  assert.match(nav, /findit-mobile-nav fixed bottom-0/);
  assert.match(nav, /className="clay-nav flex[^\"]*w-full/);
  assert.match(nav, /item\.prominent \? 'justify-center' : 'justify-end pb-0\.5'/);
  assert.match(indexCss, /--findit-nav-height: 3\.25rem/);
  assert.match(viewport, /\.findit-mobile-nav[\s\S]*bottom: 0;[\s\S]*left: 50%;[\s\S]*width: min\(500px, calc\(100% - 1\.25rem\)\);[\s\S]*transform: translateX\(-50%\)/);
  assert.match(viewport, /\.findit-mobile-nav \.clay-nav[\s\S]*height: calc\(var\(--findit-nav-height\) \+ env\(safe-area-inset-bottom, 0px\)\);[\s\S]*padding-bottom: env\(safe-area-inset-bottom, 0px\);/);
  assert.match(viewport, /\.findit-mobile-nav-clearance[\s\S]*padding-bottom: calc\(var\(--findit-nav-height\) \+ max\(0\.75rem, env\(safe-area-inset-bottom\)\)\);/);
});

test('map zoom and pan stay inside a stable map-only viewport', () => {
  assert.match(map, /className="findit-discover-map"/);
  assert.match(design, /\.findit-discover-map[\s\S]*height: clamp\(540px, calc\(var\(--findit-viewport-height, 100dvh\) - 270px\), 720px\);/);
  assert.match(design, /\.findit-discover-map[\s\S]*overscroll-behavior: contain;/);
});

test('mobile and standalone OAuth never strand the app in an about:blank popup', () => {
  assert.match(authService, /function shouldUseOAuthPopup\(\)/);
  assert.match(authService, /display-mode: standalone/);
  assert.match(authService, /pointer: coarse/);
  assert.match(authService, /max-width: 767px/);
  assert.match(authService, /if \(usePopup\)/);
  assert.match(authService, /buildFullWindowOAuthCallbackUrl\(redirectPath\)/);
  assert.match(oauthCallback, /bridgeId \? 'This window will close automatically\.' : 'Returning you to PeekaListing\.'/);
});

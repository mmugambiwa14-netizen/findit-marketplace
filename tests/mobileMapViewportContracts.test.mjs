import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [viewport, nav, search, map, design] = await Promise.all([
  read('src/pwa-viewport.css'),
  read('src/components/layout/BottomNav.jsx'),
  read('src/components/discover/DiscoverSearch.jsx'),
  read('src/components/discover/DiscoverMapView.jsx'),
  read('src/findit-locked-design.css'),
]);

test('mobile form controls cannot trigger document auto-zoom', () => {
  assert.match(viewport, /input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\):not\(\[type='range'\]\):not\(\[type='file'\]\)/);
  assert.match(viewport, /font-size: 16px !important/);
  assert.match(search, /text-base placeholder:text-muted-foreground\/80 md:text-sm/);
  assert.doesNotMatch(viewport, /user-scalable\s*:\s*no/);
});

test('mobile navigation stays centered and contained by the viewport', () => {
  assert.doesNotMatch(nav, /fixed inset-x-2\.5/);
  assert.match(nav, /className="clay-nav flex[^\"]*w-full/);
  assert.match(viewport, /\.findit-mobile-nav[\s\S]*left: 50%;[\s\S]*width: min\(500px, calc\(100% - 1\.25rem\)\);[\s\S]*transform: translateX\(-50%\)/);
});

test('map zoom and pan stay inside a stable map-only viewport', () => {
  assert.match(map, /className="findit-discover-map"/);
  assert.match(design, /\.findit-discover-map[\s\S]*height: clamp\(540px, calc\(var\(--findit-viewport-height, 100dvh\) - 270px\), 720px\);/);
  assert.match(design, /\.findit-discover-map[\s\S]*overscroll-behavior: contain;/);
});

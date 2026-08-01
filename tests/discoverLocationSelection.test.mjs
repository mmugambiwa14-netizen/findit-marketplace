import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldCommitDiscoverLocationSelection } from '../src/components/discover/discoverLocationSelection.js';

const [discoverHeader, bottomNav] = await Promise.all([
  readFile(new URL('../src/components/discover/DiscoverHeader.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/layout/BottomNav.jsx', import.meta.url), 'utf8'),
]);

test('Discover keeps the location sheet open until a city is selected', () => {
  assert.equal(shouldCommitDiscoverLocationSelection(null), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id' }), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id', state: 'province-id' }), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id', state: 'province-id', city: '   ' }), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id', state: 'province-id', city: 'city-id' }), true);
});

test('the Discover location sheet remains scrollable above mobile navigation', () => {
  assert.match(discoverHeader, /max-h-\[calc\(100dvh-0\.75rem\)\]/);
  assert.match(discoverHeader, /touch-pan-y overflow-y-auto overscroll-contain/);
  assert.match(bottomNav, /bottom-2\.5 z-40 md:hidden/);
  assert.doesNotMatch(bottomNav, /z-\[1000\]/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCommitDiscoverLocationSelection } from '../src/components/discover/discoverLocationSelection.js';

test('Discover keeps the location sheet open until a city is selected', () => {
  assert.equal(shouldCommitDiscoverLocationSelection(null), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id' }), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id', state: 'province-id' }), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id', state: 'province-id', city: '   ' }), false);
  assert.equal(shouldCommitDiscoverLocationSelection({ country: 'country-id', state: 'province-id', city: 'city-id' }), true);
});

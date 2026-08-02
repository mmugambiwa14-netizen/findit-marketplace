import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocationSelection,
  hasCoordinates,
  restoreLocationSelection,
} from '../src/services/locationSelectionContracts.js';

const HARARE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Harare',
  type: 'city',
  latitude: -17.8292,
  longitude: 31.0522,
  country_code: 'ZW',
};

// Part III §8: "Preserve the correct coordinates."
test('a confirmed selection carries its coordinates', () => {
  const selection = buildLocationSelection(HARARE, {
    country: 'zw-id', countryName: 'Zimbabwe', countryCode: 'ZW',
    state: 'hre-id', stateName: 'Harare Province',
  });

  assert.equal(selection.city, HARARE.id);
  assert.equal(selection.cityName, 'Harare');
  assert.equal(selection.latitude, -17.8292);
  assert.equal(selection.longitude, 31.0522);
  assert.equal(hasCoordinates(selection), true);
});

test('a place without coordinates yields nulls rather than NaN or undefined', () => {
  const selection = buildLocationSelection({ id: 'x', name: 'Nowhere' });
  assert.equal(selection.latitude, null);
  assert.equal(selection.longitude, null);
  assert.equal(hasCoordinates(selection), false);
});

test('non-numeric coordinates are rejected, not passed through', () => {
  const selection = buildLocationSelection({
    id: 'x', name: 'Bad', latitude: 'not-a-number', longitude: {},
  });
  assert.equal(selection.latitude, null);
  assert.equal(selection.longitude, null);
});

test('a selection without a confirmed place is refused', () => {
  assert.throws(() => buildLocationSelection(null), TypeError);
  assert.throws(() => buildLocationSelection({ name: 'No id' }), TypeError);
});

test('country code falls back to the place when context omits it', () => {
  const selection = buildLocationSelection(HARARE, { country: 'zw-id' });
  assert.equal(selection.countryCode, 'ZW');
});

// Part III §8: "Draft restoration must restore both the canonical place and
// its coordinates."
test('draft restore recovers the canonical place and its coordinates', () => {
  const stored = buildLocationSelection(HARARE, { countryCode: 'ZW' });
  const { selection, coordinatesRestored } = restoreLocationSelection(JSON.parse(JSON.stringify(stored)));

  assert.equal(selection.city, HARARE.id);
  assert.equal(selection.cityName, 'Harare');
  assert.equal(selection.latitude, -17.8292);
  assert.equal(selection.longitude, 31.0522);
  assert.equal(coordinatesRestored, true);
});

test('a draft missing coordinates restores the place but reports the loss', () => {
  const { selection, coordinatesRestored } = restoreLocationSelection({
    city: HARARE.id, cityName: 'Harare',
  });
  assert.equal(selection.cityName, 'Harare', 'the place itself still restores');
  assert.equal(coordinatesRestored, false, 'and the missing coordinates are reported');
});

test('an empty draft restores nothing rather than a half-formed location', () => {
  assert.equal(restoreLocationSelection(null), null);
  assert.equal(restoreLocationSelection({}), null);
  assert.equal(restoreLocationSelection({ city: '' }), null);
});

test('a coordinate pair is only usable when both halves are present', () => {
  assert.equal(hasCoordinates({ latitude: -17.8, longitude: null }), false);
  assert.equal(hasCoordinates({ latitude: null, longitude: 31.0 }), false);
  assert.equal(hasCoordinates({ latitude: 0, longitude: 0 }), true, 'zero is a real coordinate');
});

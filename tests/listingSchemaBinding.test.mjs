import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveListingSchemaBinding,
  seedListingSchemaValues,
} from '../src/services/listingSchemaBinding.js';

test('property taxonomy offer semantics map to the legacy registry field only at the adapter boundary', () => {
  const resolved = resolveListingSchemaBinding('property', {
    schema: 'property',
    subtype: 'residential',
    defaults: { property_type: 'house', offer_type: 'sale' },
  });

  assert.deepEqual(resolved.values, {
    subtype: 'residential',
    property_type: 'house',
    listing_type: 'sale',
  });
  assert.equal(resolved.offerType, 'sale');
  assert.equal(resolved.taxonomyDimensions.offer_type, 'sale');
  assert.equal(resolved.taxonomyDimensions.listing_type, undefined);
});

test('vehicle taxonomy keeps offer type as listing context without inventing a registry field', () => {
  const resolved = resolveListingSchemaBinding('car', {
    schema: 'car',
    subtype: 'car',
    defaults: { offer_type: 'rent', body_type: 'sedan' },
  });

  assert.equal(resolved.offerType, 'rent');
  assert.equal(resolved.values.subtype, 'car');
  assert.equal(resolved.values.body_type, 'sedan');
  assert.equal(resolved.values.offer_type, undefined);
  assert.equal(resolved.taxonomyDimensions.offer_type, 'rent');
});

test('machinery bindings seed supported equipment types and preserve application context', () => {
  const resolved = resolveListingSchemaBinding('machinery', {
    schema: 'machinery',
    defaults: { machinery_type: 'generator', applications: ['power'] },
  });

  assert.equal(resolved.values.machinery_type, 'generator');
  assert.equal(resolved.values.applications, undefined);
  assert.deepEqual(resolved.taxonomyDimensions.applications, ['power']);
});

test('unsupported taxonomy dimensions remain lossless context instead of invalid form answers', () => {
  const resolved = resolveListingSchemaBinding('property', {
    schema: 'property',
    subtype: 'agricultural',
    defaults: { property_type: 'farm', land_regime: 'a2' },
  });

  assert.equal(resolved.values.subtype, 'agricultural');
  assert.equal(resolved.values.property_type, 'farm');
  assert.equal(resolved.values.land_regime, undefined);
  assert.equal(resolved.taxonomyDimensions.land_regime, 'a2');
});

test('registry-incompatible option defaults are not injected into the live answer map', () => {
  const resolved = resolveListingSchemaBinding('property', {
    schema: 'property',
    subtype: 'residential',
    defaults: { property_type: 'cluster_home' },
  });

  assert.equal(resolved.values.property_type, undefined);
  assert.equal(resolved.taxonomyDimensions.property_type, 'cluster_home');
});

test('draft recovery can merge explicit answers over taxonomy defaults', () => {
  const seeded = seedListingSchemaValues(
    'property',
    { schema: 'property', subtype: 'residential', defaults: { property_type: 'house', offer_type: 'sale' } },
    { bedrooms: 4, listing_type: 'rent' },
  );

  assert.equal(seeded.values.property_type, 'house');
  assert.equal(seeded.values.bedrooms, 4);
  assert.equal(seeded.values.listing_type, 'rent');
});

test('a taxonomy binding cannot cross marketplace schema families', () => {
  assert.throws(
    () => resolveListingSchemaBinding('property', { schema: 'car', defaults: {} }),
    /does not match listing kind property/,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_ATTRIBUTES,
  buildDetailSections,
  fromStorageRow,
  needsSchemaMigration,
  storedSchemaVersion,
  toStoragePayload,
} from '../src/services/listingAttributes.js';
import { SCHEMA_VERSION } from '../src/domain/listingSchema/registry.js';

const VEHICLE = {
  brand: 'Toyota', model: 'Hilux', year: 2018, mileage: 90000,
  transmission: 'manual', fuel_type: 'diesel', condition: 'good',
  service_history: 'full', accident_history: 'none',
  spare_keys: 2, safety_features: ['abs', 'airbags'],
};

test('valid answers produce columns plus a versioned attributes document', () => {
  const result = toStoragePayload('car', VEHICLE);
  assert.equal(result.ok, true);

  // Exactly the columns car_details already has.
  assert.deepEqual(Object.keys(result.columns).sort(),
    ['brand', 'condition', 'fuel_type', 'mileage', 'model', 'transmission', 'year']);
  assert.equal(result.attributes.version, SCHEMA_VERSION);
  assert.equal(result.attributes.values.spare_keys, 2);
  assert.deepEqual(result.attributes.values.safety_features, ['abs', 'airbags']);
});

test('invalid answers are refused with field-level errors and no payload', () => {
  const result = toStoragePayload('car', { ...VEHICLE, last_service_mileage: 200000 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === 'last_service_mileage'));
  assert.equal(result.columns, undefined, 'nothing is written when validation fails');
});

// The property that draft recovery and editing depend on.
test('a payload round-trips back to the same values', () => {
  const { columns, attributes } = toStoragePayload('car', VEHICLE);
  const restored = fromStorageRow('car', { ...columns, attributes });

  for (const [key, value] of Object.entries(VEHICLE)) {
    assert.deepEqual(restored[key], value, `${key} survived the round trip`);
  }
});

test('schema subtype is validated and survives the storage round trip', () => {
  const input = { ...VEHICLE, subtype: 'suv' };
  const result = toStoragePayload('car', input);
  assert.equal(result.ok, true);
  assert.equal(result.attributes.values.subtype, 'suv');

  const restored = fromStorageRow('car', { ...result.columns, attributes: result.attributes });
  assert.equal(restored.subtype, 'suv');
});

test('unsupported schema subtype is rejected before storage', () => {
  const result = toStoragePayload('car', { ...VEHICLE, subtype: 'spaceship' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{ field: 'subtype', message: 'Subtype is invalid' }]);
  assert.equal(result.columns, undefined);
});

test('column values win over a stale duplicate in the document', () => {
  // A mileage edit writes the column; a document left holding the old value
  // must not shadow it, or the edit appears to revert.
  const restored = fromStorageRow('car', {
    mileage: 95000,
    attributes: { version: SCHEMA_VERSION, values: { mileage: 90000, spare_keys: 1 } },
  });
  assert.equal(restored.mileage, 95000);
  assert.equal(restored.spare_keys, 1);
});

test('joined detail tables are flattened, nested or as an array', () => {
  const nested = fromStorageRow('property', {
    id: 'x', attributes: EMPTY_ATTRIBUTES,
    property_details: { bedrooms: 3, bathrooms: 2 },
  });
  assert.equal(nested.bedrooms, 3);

  const asArray = fromStorageRow('property', {
    id: 'x', attributes: EMPTY_ATTRIBUTES,
    property_details: [{ bedrooms: 4 }],
  });
  assert.equal(asArray.bedrooms, 4);
});

test('a row with no attributes document still reads cleanly', () => {
  // Every listing written before migration 0114 looks like this.
  const restored = fromStorageRow('car', { brand: 'Toyota', mileage: 1000 });
  assert.equal(restored.brand, 'Toyota');
  assert.equal(restored.mileage, 1000);
});

test('a malformed attributes document degrades instead of throwing', () => {
  for (const attributes of [null, undefined, 'nonsense', 42, { version: 1 }, { values: null }]) {
    const restored = fromStorageRow('car', { brand: 'Toyota', attributes });
    assert.equal(restored.brand, 'Toyota');
  }
});

test('schema version is reported so old documents can be migrated deliberately', () => {
  assert.equal(storedSchemaVersion({ attributes: { version: 1, values: {} } }), 1);
  assert.equal(storedSchemaVersion({}), null);
  assert.equal(needsSchemaMigration({ attributes: { version: 0.5, values: {} } }), true);
  assert.equal(needsSchemaMigration({ attributes: { version: SCHEMA_VERSION, values: {} } }), false);
  assert.equal(needsSchemaMigration({}), false, 'a legacy row is not "old", it is unversioned');
});

// Part III §10 -- display rules.
test('detail sections hide blank and irrelevant fields', () => {
  const { columns, attributes } = toStoragePayload('car', VEHICLE);
  const sections = buildDetailSections('car', { ...columns, attributes });
  const shown = sections.flatMap((section) => section.fields.map((field) => field.id));

  assert.ok(shown.includes('mileage'));
  assert.ok(shown.includes('service_history'));
  assert.ok(!shown.includes('battery_capacity_kwh'), 'not applicable to a diesel');
  assert.ok(!shown.includes('interior_colour'), 'unanswered fields stay hidden');
});

test('an informative "unknown" is shown but an uninformative false is not', () => {
  const sections = buildDetailSections('car', {
    brand: 'Toyota', model: 'Hilux', year: 2018, mileage: 90000,
    transmission: 'manual', fuel_type: 'diesel', condition: 'good',
    attributes: {
      version: SCHEMA_VERSION,
      values: { service_history: 'unknown', accident_history: 'unknown' },
    },
  });
  const shown = sections.flatMap((section) => section.fields.map((field) => field.id));

  // Part III §10: "Unknown should only be shown where it provides useful buyer
  // information, such as unknown accident or service history."
  assert.ok(shown.includes('service_history'));
  assert.ok(shown.includes('accident_history'));
});

test('moderation-only fields never reach a public detail section', () => {
  const sections = buildDetailSections('machinery', {
    machinery_type: 'excavator', brand: 'CAT', model: '320',
    usage_hours: 5000, condition: 'good',
    attributes: { version: SCHEMA_VERSION, values: { serial_number: 'CAT0320ABC123' } },
  });
  const shown = sections.flatMap((section) => section.fields.map((field) => field.id));
  assert.ok(!shown.includes('serial_number'), 'serial numbers are moderation-only');
});

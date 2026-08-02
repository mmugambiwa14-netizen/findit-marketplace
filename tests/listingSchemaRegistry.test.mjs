import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CATEGORY_IDS,
  SCHEMA_VERSION,
  cardFields,
  filterableFields,
  getSchema,
  publicDetailFields,
  reconcileSubtypeChange,
  resolveVisibleFields,
  splitStorage,
  validateCategoryValues,
} from '../src/domain/listingSchema/registry.js';

const ids = (fields) => fields.map((field) => field.id);

test('all four marketplace categories use the same registry', () => {
  // CATEGORY_IDS is frozen, so copy before sorting rather than mutating it.
  assert.deepEqual([...CATEGORY_IDS].sort(), ['car', 'machinery', 'property', 'service']);
  for (const category of CATEGORY_IDS) {
    const schema = getSchema(category);
    assert.ok(schema.fields.length > 0, `${category} has fields`);
    assert.ok(schema.subtypes.length > 0, `${category} has subtypes`);
    assert.equal(schema.version, SCHEMA_VERSION);
  }
});

test('every field id is unique within its category', () => {
  for (const category of CATEGORY_IDS) {
    const all = ids(getSchema(category).fields);
    assert.equal(new Set(all).size, all.length, `${category} has no duplicate field ids`);
  }
});

// Part III §6: "Irrelevant machinery fields must not appear merely because
// they exist for another equipment subtype."
test('machinery capacity questions are scoped to the equipment that has them', () => {
  const excavator = ids(resolveVisibleFields('machinery', { machinery_type: 'excavator' }));
  const forklift = ids(resolveVisibleFields('machinery', { machinery_type: 'forklift' }));
  const generator = ids(resolveVisibleFields('machinery', { machinery_type: 'generator' }));

  assert.ok(excavator.includes('digging_depth_m'), 'excavator asks digging depth');
  assert.ok(!forklift.includes('digging_depth_m'), 'forklift does not ask digging depth');
  assert.ok(!generator.includes('digging_depth_m'), 'generator does not ask digging depth');

  assert.ok(forklift.includes('lifting_capacity_t'), 'forklift asks lifting capacity');
  assert.ok(!excavator.includes('lifting_capacity_t'), 'excavator does not ask lifting capacity');

  assert.ok(generator.includes('output_kva'), 'generator asks kVA output');
  assert.ok(!excavator.includes('output_kva'), 'excavator does not ask kVA output');
});

// Part III §4: property questions adapt to subtype.
test('land listings are not asked for bedrooms', () => {
  const residential = ids(resolveVisibleFields('property', { subtype: 'residential' }));
  const land = ids(resolveVisibleFields('property', { subtype: 'land' }));

  assert.ok(residential.includes('bedrooms'));
  assert.ok(!land.includes('bedrooms'), 'land has no bedrooms question');
  assert.ok(!land.includes('furnishing'), 'land has no furnishing question');
  assert.ok(land.includes('land_size_sqm'));
});

// Part III §7: services must not be forced into property-style location fields.
test('a remote-only service is never asked for a base location', () => {
  const remote = ids(resolveVisibleFields('service', { delivery_mode: 'remote' }));
  const onsite = ids(resolveVisibleFields('service', { delivery_mode: 'provider_location' }));

  assert.ok(!remote.includes('base_location_id'), 'remote service has no base location');
  assert.ok(!remote.includes('service_radius_km'), 'remote service has no travel radius');
  assert.ok(onsite.includes('base_location_id'), 'premises-based service does ask');
});

test('quote-required services are not asked for an amount', () => {
  const quoted = ids(resolveVisibleFields('service', { pricing_type: 'quote_required' }));
  const hourly = ids(resolveVisibleFields('service', { pricing_type: 'hourly' }));
  assert.ok(!quoted.includes('price'));
  assert.ok(hourly.includes('price'));
});

// Part III §5: mileage, service history and accident history structured.
test('vehicle trust fields are structured, filterable and on the card', () => {
  const schema = getSchema('car');
  for (const id of ['mileage', 'service_history', 'accident_history']) {
    const field = schema.fields.find((entry) => entry.id === id);
    assert.ok(field, `${id} exists`);
    assert.ok(field.filterable, `${id} is filterable`);
    assert.ok(field.onCard, `${id} appears on cards`);
  }
});

// Part III §12: cross-field relationships.
test('mileage at last service cannot exceed current mileage', () => {
  const bad = validateCategoryValues('car', {
    brand: 'Toyota', model: 'Hilux', year: 2018, mileage: 90000,
    transmission: 'manual', fuel_type: 'diesel', condition: 'good',
    service_history: 'full', accident_history: 'none',
    last_service_mileage: 120000,
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((error) => error.field === 'last_service_mileage'));

  const good = validateCategoryValues('car', {
    brand: 'Toyota', model: 'Hilux', year: 2018, mileage: 90000,
    transmission: 'manual', fuel_type: 'diesel', condition: 'good',
    service_history: 'full', accident_history: 'none',
    last_service_mileage: 84000,
  });
  assert.equal(good.valid, true, JSON.stringify(good.errors));
});

test('machinery hours at last service cannot exceed operating hours', () => {
  const result = validateCategoryValues('machinery', {
    machinery_type: 'excavator', brand: 'CAT', model: '320', usage_hours: 5000,
    condition: 'good', service_history: 'partial', last_service_hours: 7000,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.field === 'last_service_hours'));
});

test('a year built in the future is rejected', () => {
  const result = validateCategoryValues('property', {
    subtype: 'residential', listing_type: 'sale', property_type: 'house',
    bedrooms: 3, bathrooms: 2, construction_year: new Date().getFullYear() + 5,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.field === 'construction_year'));
});

test('required fields are enforced, including conditional ones', () => {
  const missing = validateCategoryValues('property', {
    subtype: 'residential', listing_type: 'sale', property_type: 'house',
  });
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((error) => error.field === 'bedrooms'));

  // land_size_sqm is only required for land and agricultural subtypes
  const land = validateCategoryValues('property', {
    subtype: 'land', listing_type: 'sale', property_type: 'stand',
  });
  assert.ok(land.errors.some((error) => error.field === 'land_size_sqm'));
});

test('unknown fields are rejected, not silently dropped', () => {
  const result = validateCategoryValues('car', {
    brand: 'Toyota', model: 'Hilux', year: 2018, mileage: 90000,
    transmission: 'manual', fuel_type: 'diesel', condition: 'good',
    service_history: 'none', accident_history: 'none',
    is_verified: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.field === 'is_verified'));
});

test('out-of-range and non-enum values are rejected', () => {
  const result = validateCategoryValues('property', {
    subtype: 'residential', listing_type: 'sale', property_type: 'house',
    bedrooms: 999, bathrooms: 2, furnishing: 'gold_plated',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.field === 'bedrooms'));
  assert.ok(result.errors.some((error) => error.field === 'furnishing'));
});

// Hybrid storage: existing columns keep working, the long tail is versioned.
test('values split into existing columns and a versioned attributes document', () => {
  const { values } = validateCategoryValues('car', {
    brand: 'Toyota', model: 'Hilux', year: 2018, mileage: 90000,
    transmission: 'manual', fuel_type: 'diesel', condition: 'good',
    service_history: 'full', accident_history: 'none', spare_keys: 2,
  });
  const { columns, attributes } = splitStorage('car', values);

  // These are the columns car_details already has today.
  assert.deepEqual(Object.keys(columns).sort(),
    ['brand', 'condition', 'fuel_type', 'mileage', 'model', 'transmission', 'year']);
  assert.equal(attributes.version, SCHEMA_VERSION);
  assert.equal(attributes.values.spare_keys, 2);
  assert.equal(attributes.values.service_history, 'full');
  assert.ok(!('brand' in attributes.values), 'column fields do not duplicate into attributes');
});

// Part III §2: compatible answers survive a subtype change; incompatible ones
// are reported before removal rather than vanishing.
test('subtype change keeps compatible answers and names what would be lost', () => {
  const current = {
    subtype: 'residential', listing_type: 'sale', property_type: 'house',
    bedrooms: 3, bathrooms: 2, borehole: true, land_size_sqm: 800,
  };
  const { kept, dropped } = reconcileSubtypeChange('property', current, 'land');

  assert.equal(kept.subtype, 'land');
  assert.equal(kept.borehole, true, 'borehole is meaningful for land too');
  assert.equal(kept.land_size_sqm, 800);
  assert.ok(!('bedrooms' in kept), 'bedrooms is dropped for land');

  const droppedIds = dropped.map((entry) => entry.field);
  assert.ok(droppedIds.includes('bedrooms'));
  assert.ok(dropped.every((entry) => entry.label), 'each loss is reported with a label to warn with');
});

// Part III §11: filters are generated from the schema, not hand-maintained.
test('filters derive from the registry and use stored values', () => {
  for (const category of CATEGORY_IDS) {
    const facets = filterableFields(category);
    assert.ok(facets.length > 0, `${category} exposes filters`);
    for (const field of facets) {
      if (field.input === 'select') {
        assert.ok(Array.isArray(field.options) && field.options.length > 0,
          `${category}.${field.id} filter has options`);
      }
      if (field.input === 'number') {
        assert.ok(field.validation, `${category}.${field.id} numeric filter has a range`);
      }
    }
  }
});

test('cards only advertise fields marked for cards', () => {
  for (const category of CATEGORY_IDS) {
    assert.ok(cardFields(category).length > 0, `${category} has card fields`);
  }
});

// Private and moderation-only fields must not reach a public detail page.
test('moderation-only fields are excluded from public detail', () => {
  const visible = ids(publicDetailFields('machinery', { machinery_type: 'excavator' }));
  assert.ok(!visible.includes('serial_number'), 'serial number is moderation-only');
});

import { conditionMet } from './defineField.js';
import { MACHINERY_FIELDS, MACHINERY_SUBTYPES } from './categories/machinery.js';
import { PROPERTY_FIELDS, PROPERTY_SUBTYPES } from './categories/property.js';
import { SERVICE_FIELDS, SERVICE_SUBTYPES } from './categories/service.js';
import { VEHICLE_FIELDS, VEHICLE_SUBTYPES } from './categories/vehicle.js';

/**
 * Central, versioned category schema registry (Part III §2 and §9).
 *
 * One registry drives creation, editing, draft recovery, review, cards, detail
 * pages, filters and moderation. A field cannot exist in the posting form but
 * be absent from search, because both read the same definitions.
 *
 * SCHEMA_VERSION is stored alongside each listing's attributes so a document
 * written under an older shape stays readable and can be migrated
 * deliberately. Bump it whenever a field's meaning, unit or allowed values
 * change -- not for additive changes, which are backward compatible.
 */
export const SCHEMA_VERSION = 1;

const CATEGORIES = Object.freeze({
  property: { label: 'Property', subtypes: PROPERTY_SUBTYPES, fields: PROPERTY_FIELDS },
  car: { label: 'Vehicles', subtypes: VEHICLE_SUBTYPES, fields: VEHICLE_FIELDS },
  machinery: { label: 'Machinery', subtypes: MACHINERY_SUBTYPES, fields: MACHINERY_FIELDS },
  service: { label: 'Services', subtypes: SERVICE_SUBTYPES, fields: SERVICE_FIELDS },
});

export const CATEGORY_IDS = Object.freeze(Object.keys(CATEGORIES));

/** @param {string} category */
export function getSchema(category) {
  const schema = CATEGORIES[category];
  if (!schema) throw new TypeError(`Unknown listing category: ${category}`);
  return { version: SCHEMA_VERSION, category, ...schema };
}

/** @param {string} category */
export function getSubtypes(category) {
  return getSchema(category).subtypes;
}

/**
 * Fields that should be shown for the current answers, in section then order.
 * A field whose `showWhen` fails is not merely hidden -- it is not part of the
 * listing, so it is never validated, stored or displayed.
 *
 * @param {string} category
 * @param {Record<string, unknown>} values
 */
export function resolveVisibleFields(category, values = {}) {
  return getSchema(category).fields
    .filter((field) => conditionMet(field.showWhen, values))
    .sort((left, right) => (left.section === right.section
      ? left.order - right.order
      : left.section.localeCompare(right.section)));
}

/**
 * Whether a field must be answered given the current values. Covers both a
 * flat `requirement: 'required'` and a conditional `requiredWhen`.
 */
export function isFieldRequired(field, values = {}) {
  if (field.requirement === 'required') return true;
  return Boolean(field.requiredWhen) && conditionMet(field.requiredWhen, values);
}

/** Fields marked filterable, for generating search facets (Part III §11). */
export function filterableFields(category) {
  return getSchema(category).fields.filter((field) => field.filterable);
}

/** Fields that belong on a listing card. */
export function cardFields(category) {
  return getSchema(category).fields.filter((field) => field.onCard);
}

/**
 * Fields safe to render on a public detail page. Private and moderation-only
 * fields (a machine's serial number, for instance) are excluded here rather
 * than relied on to be omitted by each caller.
 */
export function publicDetailFields(category, values = {}) {
  return resolveVisibleFields(category, values)
    .filter((field) => field.onDetail && field.visibility === 'public');
}

// --- Validation -------------------------------------------------------------

function coerce(field, raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (field.input === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  if (field.input === 'boolean') return Boolean(raw);
  if (field.input === 'multiselect') return Array.isArray(raw) ? raw : [raw];
  return String(raw);
}

function validateOne(field, value, errors) {
  const allowed = field.options?.map((option) => option.value) ?? [];

  if (field.input === 'number') {
    if (Number.isNaN(value)) {
      errors.push({ field: field.id, message: `${field.label} must be a number` });
      return;
    }
    const { min, max, step } = field.validation ?? {};
    if (min !== undefined && value < min) {
      errors.push({ field: field.id, message: `${field.label} cannot be less than ${min}` });
    }
    if (max !== undefined && value > max) {
      errors.push({ field: field.id, message: `${field.label} cannot be more than ${max}` });
    }
    if (step === 1 && !Number.isInteger(value)) {
      errors.push({ field: field.id, message: `${field.label} must be a whole number` });
    }
    return;
  }

  if (field.input === 'select') {
    const permitted = allowed.concat(field.allowUnknown ? ['unknown'] : [])
      .concat(field.allowNotApplicable ? ['not_applicable'] : []);
    if (permitted.length > 0 && !permitted.includes(value)) {
      errors.push({ field: field.id, message: `${field.label} has an unsupported value` });
    }
    return;
  }

  if (field.input === 'multiselect') {
    if (allowed.length === 0) return; // options supplied at runtime (e.g. areas)
    const invalid = value.filter((entry) => !allowed.includes(entry));
    if (invalid.length > 0) {
      errors.push({ field: field.id, message: `${field.label} has an unsupported value` });
    }
    return;
  }

  const { maxLength } = field.validation ?? {};
  if (maxLength && typeof value === 'string' && Array.from(value).length > maxLength) {
    errors.push({ field: field.id, message: `${field.label} is too long` });
  }
}

/**
 * Cross-field rules (Part III §12). These are relationships no single field
 * can check on its own, and each corresponds to a rule Part III names.
 */
function validateRelationships(category, values, errors) {
  const number = (id) => (typeof values[id] === 'number' ? values[id] : null);

  if (category === 'car') {
    const mileage = number('mileage');
    const atService = number('last_service_mileage');
    if (mileage !== null && atService !== null && atService > mileage) {
      errors.push({
        field: 'last_service_mileage',
        message: 'Mileage at last service cannot exceed current mileage',
      });
    }
  }

  if (category === 'machinery') {
    const hours = number('usage_hours');
    const atService = number('last_service_hours');
    if (hours !== null && atService !== null && atService > hours) {
      errors.push({
        field: 'last_service_hours',
        message: 'Hours at last service cannot exceed current operating hours',
      });
    }
  }

  if (category === 'property') {
    const built = number('construction_year');
    if (built !== null && built > new Date().getFullYear()) {
      errors.push({ field: 'construction_year', message: 'Year built cannot be in the future' });
    }
    const floor = number('floor_number');
    const total = number('total_floors');
    if (floor !== null && total !== null && floor > total) {
      errors.push({ field: 'floor_number', message: 'Floor number cannot exceed total floors' });
    }
  }

  if (category === 'service') {
    // A remote-only provider must never be required to publish premises.
    if (values.delivery_mode === 'remote' && values.base_location_id) {
      errors.push({
        field: 'base_location_id',
        message: 'A remote-only service does not need a physical base location',
      });
    }
  }
}

/**
 * Validates answers against the resolved schema.
 *
 * Unknown keys are rejected rather than dropped -- the same strict-schema rule
 * the service contracts already apply, so an `is_verified: true` smuggled into
 * a payload fails loudly instead of being silently ignored.
 *
 * @returns {{ valid: boolean, errors: Array<{field: string, message: string}>, values: Record<string, unknown> }}
 */
export function validateCategoryValues(category, rawValues = {}) {
  const visible = resolveVisibleFields(category, rawValues);
  const visibleById = new Map(visible.map((field) => [field.id, field]));
  const knownIds = new Set(getSchema(category).fields.map((field) => field.id));
  const errors = [];
  const values = {};

  for (const key of Object.keys(rawValues)) {
    if (key === 'subtype') continue;
    if (!knownIds.has(key)) {
      errors.push({ field: key, message: `Unsupported field for ${category}: ${key}` });
    }
  }

  for (const field of visible) {
    const value = coerce(field, rawValues[field.id]);
    const missing = value === null || (Array.isArray(value) && value.length === 0);

    if (missing) {
      if (isFieldRequired(field, rawValues)) {
        errors.push({ field: field.id, message: `${field.label} is required` });
      }
      continue;
    }

    validateOne(field, value, errors);
    values[field.id] = value;
  }

  // A value answered for a field that is not visible is dropped rather than
  // stored, so switching subtype cannot leave an orphaned answer behind.
  for (const key of Object.keys(rawValues)) {
    if (knownIds.has(key) && !visibleById.has(key)) delete values[key];
  }

  validateRelationships(category, values, errors);
  return { valid: errors.length === 0, errors, values };
}

/**
 * Splits validated values into the hybrid storage model: existing normalized
 * columns keep working unchanged, and everything else becomes one versioned
 * attributes document.
 */
export function splitStorage(category, values) {
  const byId = new Map(getSchema(category).fields.map((field) => [field.id, field]));
  const columns = {};
  const attributes = {};

  for (const [id, value] of Object.entries(values)) {
    const field = byId.get(id);
    if (!field) continue;
    if (field.storage === 'column') columns[field.column] = value;
    else attributes[id] = value;
  }

  return { columns, attributes: { version: SCHEMA_VERSION, values: attributes } };
}

/**
 * Subtype change reconciliation (Part III §2): "Compatible answers should
 * remain when switching subtype. Incompatible answers should only be removed
 * after a clear warning."
 *
 * Returns what would be kept and what would be lost, so the UI can warn with
 * specifics before anything is discarded.
 */
export function reconcileSubtypeChange(category, values, nextSubtype) {
  const next = { ...values, subtype: nextSubtype };
  const stillVisible = new Set(resolveVisibleFields(category, next).map((field) => field.id));
  const byId = new Map(getSchema(category).fields.map((field) => [field.id, field]));

  const kept = {};
  const dropped = [];

  for (const [id, value] of Object.entries(values)) {
    if (id === 'subtype') continue;
    if (stillVisible.has(id)) kept[id] = value;
    else if (value !== null && value !== undefined && value !== '') {
      dropped.push({ field: id, label: byId.get(id)?.label ?? id, value });
    }
  }

  return { kept: { ...kept, subtype: nextSubtype }, dropped };
}

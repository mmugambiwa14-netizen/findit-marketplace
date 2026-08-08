import { getSchema, getSubtypes } from '../domain/listingSchema/registry.js';

const OFFER_STORAGE_FIELD = Object.freeze({
  property: 'listing_type',
});

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function fieldAcceptsValue(field, value) {
  if (value === null || value === undefined || value === '') return false;
  if (field.input === 'multiselect') {
    if (!Array.isArray(value)) return false;
    const allowed = field.options?.map((option) => option.value) ?? [];
    return allowed.length === 0 || value.every((entry) => allowed.includes(entry));
  }
  if (field.input === 'select') {
    const allowed = field.options?.map((option) => option.value) ?? [];
    return allowed.length === 0 || allowed.includes(value)
      || (field.allowUnknown && value === 'unknown')
      || (field.allowNotApplicable && value === 'not_applicable');
  }
  if (field.input === 'number') return Number.isFinite(Number(value));
  if (field.input === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Converts taxonomy semantics into answers understood by the versioned
 * listingSchema registry without teaching taxonomy about legacy storage names.
 *
 * `taxonomyDimensions` deliberately retains every canonical binding dimension,
 * including dimensions the current registry does not expose yet. This keeps
 * the taxonomy bridge lossless while the live form is activated incrementally.
 */
export function resolveListingSchemaBinding(kind, rawBinding = {}) {
  const schema = getSchema(kind);
  const binding = objectValue(rawBinding);
  const declaredSchema = typeof binding.schema === 'string' ? binding.schema : kind;
  if (declaredSchema !== kind) {
    throw new TypeError(`Taxonomy schema binding ${declaredSchema} does not match listing kind ${kind}`);
  }

  const defaults = objectValue(binding.defaults);
  const taxonomyDimensions = { ...defaults };
  if (typeof binding.subtype === 'string' && binding.subtype) {
    taxonomyDimensions.subtype = binding.subtype;
  }

  const fields = new Map(schema.fields.map((field) => [field.id, field]));
  const values = {};

  const subtype = taxonomyDimensions.subtype;
  if (typeof subtype === 'string' && getSubtypes(kind).some((entry) => entry.value === subtype)) {
    values.subtype = subtype;
  }

  for (const [canonicalId, value] of Object.entries(defaults)) {
    const targetId = canonicalId === 'offer_type' ? OFFER_STORAGE_FIELD[kind] : canonicalId;
    if (!targetId) continue;
    const field = fields.get(targetId);
    if (!field || !fieldAcceptsValue(field, value)) continue;
    values[targetId] = value;
  }

  const offerType = typeof defaults.offer_type === 'string' ? defaults.offer_type : null;
  return Object.freeze({
    schema: kind,
    values: Object.freeze(values),
    offerType,
    taxonomyDimensions: Object.freeze(taxonomyDimensions),
  });
}

/**
 * Category changes start from taxonomy meaning, not stale answers from a
 * different leaf. User-entered values are merged only when a caller explicitly
 * supplies them (for example draft recovery); explicit answers always win.
 */
export function seedListingSchemaValues(kind, rawBinding = {}, currentValues = {}) {
  const resolved = resolveListingSchemaBinding(kind, rawBinding);
  return {
    ...resolved,
    values: Object.freeze({ ...resolved.values, ...objectValue(currentValues) }),
  };
}

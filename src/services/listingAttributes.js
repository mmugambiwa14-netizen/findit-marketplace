import {
  SCHEMA_VERSION,
  publicDetailFields,
  splitStorage,
  validateCategoryValues,
} from '../domain/listingSchema/registry.js';

/**
 * Bridge between the category schema registry and the database (Part III §9).
 *
 * The registry knows what a field means; the repositories know how to write a
 * row. This module is the only place that translates between them, so the
 * hybrid storage split exists in exactly one place rather than being
 * re-derived at every call site.
 *
 * Round-trip guarantee: `fromStorageRow(toStoragePayload(values))` returns the
 * same values. Anything that breaks that breaks draft recovery and editing, so
 * it is asserted in tests/listingAttributes.test.mjs.
 */

/** Shape written for a listing that has no category answers yet. */
export const EMPTY_ATTRIBUTES = Object.freeze({ version: SCHEMA_VERSION, values: {} });

/**
 * Validates raw answers and produces the database payload.
 *
 * @param {string} category
 * @param {Record<string, unknown>} rawValues
 * @returns {{ ok: true, columns: Record<string, unknown>, attributes: object }
 *          | { ok: false, errors: Array<{field: string, message: string}> }}
 */
export function toStoragePayload(category, rawValues = {}) {
  const { valid, errors, values } = validateCategoryValues(category, rawValues);
  if (!valid) return { ok: false, errors };

  const { columns, attributes } = splitStorage(category, values);
  return { ok: true, columns, attributes };
}

/**
 * Reassembles a single value map from a database row.
 *
 * Column values win over the attributes document. They are the canonical copy
 * for the fields that live in columns, and a stale duplicate inside the
 * document must never shadow them -- that is how an edited mileage would
 * appear to revert.
 *
 * @param {string} category
 * @param {Record<string, unknown>} row  listing row, optionally with joined detail
 * @returns {Record<string, unknown>}
 */
export function fromStorageRow(category, row = {}) {
  const stored = row?.attributes;
  const documentValues = stored && typeof stored === 'object' && stored.values
    && typeof stored.values === 'object'
    ? stored.values
    : {};

  const values = { ...documentValues };

  // Detail tables arrive either as a nested object or already flattened.
  const detail = row.property_details || row.car_details || row.machinery_details || {};
  const flattened = Array.isArray(detail) ? (detail[0] ?? {}) : detail;

  for (const [key, value] of Object.entries({ ...row, ...flattened })) {
    if (key === 'attributes') continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue; // joins
    values[key] = value;
  }

  return values;
}

/**
 * The version a stored document was written under. Lets a reader detect a
 * document older than the current registry and migrate it deliberately rather
 * than reinterpreting old values under new rules.
 */
export function storedSchemaVersion(row) {
  const version = row?.attributes?.version;
  return typeof version === 'number' ? version : null;
}

/** True when a row predates the current registry version. */
export function needsSchemaMigration(row) {
  const version = storedSchemaVersion(row);
  return version !== null && version < SCHEMA_VERSION;
}

/**
 * Sections ready to render on a public detail page (Part III §10).
 *
 * Blank and irrelevant fields stay hidden, and private or moderation-only
 * fields never appear. "Unknown" is preserved only where the registry says it
 * is useful buyer information -- an unknown accident history is a fact worth
 * showing; an unknown balcony is noise.
 */
export function buildDetailSections(category, row) {
  const values = fromStorageRow(category, row);
  const sections = new Map();

  for (const field of publicDetailFields(category, values)) {
    const value = values[field.id];

    const missing = value === null || value === undefined || value === ''
      || (Array.isArray(value) && value.length === 0)
      || value === false;
    const informativeUnknown = value === 'unknown' && field.allowUnknown;

    if (missing && !informativeUnknown) continue;

    if (!sections.has(field.section)) sections.set(field.section, []);
    sections.get(field.section).push({
      id: field.id,
      label: field.label,
      value,
      unit: field.unit ?? null,
      input: field.input,
      options: field.options ?? null,
    });
  }

  return [...sections.entries()].map(([section, fields]) => ({ section, fields }));
}

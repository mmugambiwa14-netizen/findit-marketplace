/**
 * Field definition primitives for the listing schema registry (Part III §2).
 *
 * Every category field is described by one of these records rather than by a
 * hand-written form. The same record drives creation, editing, draft recovery,
 * the review screen, listing cards, detail pages, filters and moderation, so a
 * field cannot exist in the form but be missing from search.
 *
 * Storage routing is part of the definition (`storage`). This project uses a
 * hybrid model: high-traffic, always-present, filterable facts stay in the
 * existing normalized columns so current listings and read models keep working
 * unchanged, and the sparse subtype-specific long tail lives in a validated
 * `attributes` jsonb document. Nothing else in the system needs to know which
 * is which -- `splitStorage()` reads it from here.
 */

export const INPUT_TYPES = Object.freeze([
  'text',
  'textarea',
  'number',
  'select',
  'multiselect',
  'boolean',
  'date',
]);

export const SECTIONS = Object.freeze([
  'overview',
  'specifications',
  'features',
  'condition_history',
  'location',
  'service_area',
  'pricing',
  'availability',
  'documents',
]);

export const VISIBILITY = Object.freeze(['public', 'private', 'moderation']);

/**
 * @typedef {Object} FieldDefinition
 * @property {string}   id            Stable identifier. Never reused or renamed.
 * @property {string}   label         Human label shown in the form and detail page.
 * @property {string}   input         One of INPUT_TYPES.
 * @property {string}   section       One of SECTIONS.
 * @property {number}   order         Display order within the section.
 * @property {'required'|'optional'} requirement
 * @property {Object}   [requiredWhen] Conditional requirement, same shape as `showWhen`.
 * @property {Object}   [showWhen]    Visibility condition: { field, in: [...] }.
 * @property {Array}    [options]     Allowed values for select/multiselect.
 * @property {string}   [unit]        Canonical unit; values are normalised to it.
 * @property {Object}   [validation]  { min, max, step, maxLength }
 * @property {boolean}  [allowUnknown] Offer an explicit "Unknown" answer.
 * @property {boolean}  [allowNotApplicable]
 * @property {boolean}  [searchable]
 * @property {boolean}  [filterable]
 * @property {boolean}  [onCard]      Appears on listing cards.
 * @property {boolean}  [onDetail]    Appears on the detail page.
 * @property {string}   [visibility]  public | private | moderation.
 * @property {'column'|'attribute'} storage
 * @property {string}   [column]      Target column when storage === 'column'.
 */

/**
 * Builds a field definition, applying defaults and failing loudly on a
 * malformed one. Registry mistakes surface at module load, not at runtime in
 * a user's posting flow.
 *
 * @param {Partial<FieldDefinition>} definition
 * @returns {Readonly<FieldDefinition>}
 */
export function defineField(definition) {
  const field = {
    requirement: 'optional',
    allowUnknown: false,
    allowNotApplicable: false,
    searchable: false,
    filterable: false,
    onCard: false,
    onDetail: true,
    visibility: 'public',
    storage: 'attribute',
    ...definition,
  };

  if (!field.id || typeof field.id !== 'string') {
    throw new TypeError('Field definition requires a string id');
  }
  if (!INPUT_TYPES.includes(field.input)) {
    throw new TypeError(`Field ${field.id}: unsupported input type "${field.input}"`);
  }
  if (!SECTIONS.includes(field.section)) {
    throw new TypeError(`Field ${field.id}: unsupported section "${field.section}"`);
  }
  if (!VISIBILITY.includes(field.visibility)) {
    throw new TypeError(`Field ${field.id}: unsupported visibility "${field.visibility}"`);
  }
  if ((field.input === 'select' || field.input === 'multiselect') && !Array.isArray(field.options)) {
    throw new TypeError(`Field ${field.id}: ${field.input} requires an options array`);
  }
  if (field.storage === 'column' && !field.column) {
    throw new TypeError(`Field ${field.id}: storage "column" requires a column name`);
  }
  if (typeof field.order !== 'number') {
    throw new TypeError(`Field ${field.id}: order must be a number`);
  }

  return Object.freeze(/** @type {FieldDefinition} */ (field));
}

/** Convenience for a yes/no amenity that should be filterable and structured. */
export function amenity(id, label, section, order, extra = {}) {
  return defineField({
    id,
    label,
    input: 'boolean',
    section,
    order,
    filterable: true,
    ...extra,
  });
}

/**
 * Evaluates a `showWhen` / `requiredWhen` condition against current answers.
 * A missing condition means "always".
 *
 * @param {{ field: string, in?: unknown[], not?: unknown[] }|undefined} condition
 * @param {Record<string, unknown>} values
 * @returns {boolean}
 */
export function conditionMet(condition, values) {
  if (!condition) return true;
  const actual = values?.[condition.field];
  if (Array.isArray(condition.in)) {
    return Array.isArray(actual)
      ? actual.some((entry) => condition.in.includes(entry))
      : condition.in.includes(actual);
  }
  if (Array.isArray(condition.not)) return !condition.not.includes(actual);
  return actual !== undefined && actual !== null && actual !== '';
}

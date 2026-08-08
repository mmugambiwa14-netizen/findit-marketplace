const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const NODE_TYPES = new Set(['group', 'category', 'facet']);

function text(value, label, max, { required = false, min = 0 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && normalized.length < min) throw new TypeError(`${label} is required`);
  if (normalized.length > max) throw new TypeError(`${label} is too long`);
  return normalized;
}

function uuid(value, label, { optional = false } = {}) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function slug(value, label) {
  const normalized = text(value, label, 80, { required: true, min: 1 }).toLowerCase();
  if (!SLUG_PATTERN.test(normalized)) throw new TypeError(`${label} is invalid`);
  return normalized;
}

function boundedInteger(value, label, min, max, fallback = 0) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new TypeError(`${label} is invalid`);
  return parsed;
}

function unique(values) {
  return [...new Set(values)];
}

function slugList(value, label) {
  const values = Array.isArray(value) ? value : [];
  const normalized = values
    .map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '')
    .filter(Boolean);
  if (normalized.some((item) => !SLUG_PATTERN.test(item))) throw new TypeError(`${label} contains an invalid slug`);
  if (unique(normalized).length !== normalized.length) throw new TypeError(`${label} contains duplicates`);
  return normalized;
}

function synonymList(value) {
  const values = Array.isArray(value) ? value : [];
  const normalized = values
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean);
  if (normalized.some((item) => item.length > 80)) throw new TypeError('Synonyms contain a value that is too long');
  if (unique(normalized.map((item) => item.toLowerCase())).length !== normalized.length) throw new TypeError('Synonyms contain duplicates');
  return normalized;
}

function marketList(value) {
  const values = Array.isArray(value) ? value : [];
  const normalized = values
    .map((item) => typeof item === 'string' ? item.trim().toUpperCase() : '')
    .filter(Boolean);
  if (normalized.some((item) => !/^[A-Z]{2}$/.test(item))) throw new TypeError('Market availability contains an invalid country code');
  if (unique(normalized).length !== normalized.length) throw new TypeError('Market availability contains duplicates');
  return normalized;
}

function object(value, label) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function localizedLabels(value) {
  const labels = object(value, 'Localized labels');
  return Object.fromEntries(Object.entries(labels).map(([locale, label]) => {
    if (!LOCALE_PATTERN.test(locale)) throw new TypeError('Localized label locale is invalid');
    return [locale, text(label, `Localized label ${locale}`, 80, { required: true, min: 2 })];
  }));
}

function optionalTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new TypeError('Validity end time is invalid');
  return parsed.toISOString();
}

function nodeType(value) {
  if (!NODE_TYPES.has(value)) throw new TypeError('Taxonomy node type is invalid');
  return value;
}

export function normalizeTaxonomyNodeCreate(input = {}) {
  const type = nodeType(input.nodeType ?? 'category');
  const stableSlug = slug(input.stableSlug ?? input.slug, 'Stable slug');
  const canonicalSlug = slug(input.canonicalSlug ?? stableSlug, 'Canonical slug');
  const isPostable = type === 'category' && Boolean(input.isPostable);
  return {
    parentId: uuid(input.parentId, 'Parent taxonomy node id'),
    stableSlug,
    canonicalSlug,
    displayLabel: text(input.displayLabel, 'Display label', 80, { required: true, min: 2 }),
    description: text(input.description, 'Description', 1000),
    nodeType: type,
    isPostable,
    sortOrder: boundedInteger(input.sortOrder, 'Sort order', 0, 10_000, 0),
    schemaBinding: object(input.schemaBinding, 'Schema binding'),
    aliases: slugList(input.aliases, 'Aliases'),
    synonyms: synonymList(input.synonyms),
    localizedLabels: localizedLabels(input.localizedLabels),
    marketAvailability: marketList(input.marketAvailability),
    reason: text(input.reason, 'Admin reason', 1000, { required: true, min: 3 }),
  };
}

export function normalizeTaxonomyNodeUpdate(input = {}) {
  const canonicalSlug = slug(input.canonicalSlug, 'Canonical slug');
  return {
    categoryId: uuid(input.categoryId, 'Taxonomy node id'),
    canonicalSlug,
    displayLabel: text(input.displayLabel, 'Display label', 80, { required: true, min: 2 }),
    description: text(input.description, 'Description', 1000),
    sortOrder: boundedInteger(input.sortOrder, 'Sort order', 0, 10_000, 0),
    isActive: Boolean(input.isActive),
    isPostable: Boolean(input.isPostable),
    aliases: slugList(input.aliases, 'Aliases'),
    synonyms: synonymList(input.synonyms),
    localizedLabels: localizedLabels(input.localizedLabels),
    marketAvailability: marketList(input.marketAvailability),
    supersededBy: uuid(input.supersededBy, 'Replacement taxonomy node id', { optional: true }),
    validTo: optionalTimestamp(input.validTo),
    schemaBinding: object(input.schemaBinding, 'Schema binding'),
    reason: text(input.reason, 'Admin reason', 1000, { required: true, min: 3 }),
  };
}

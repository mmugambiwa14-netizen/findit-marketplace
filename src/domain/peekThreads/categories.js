/**
 * Peek Request categories (Peek Threads phase 2).
 *
 * These values must stay identical to the `peek_request_category` enum created
 * in migration 0116. A value that exists here but not in the enum is rejected
 * by Postgres at insert time with an opaque error, so the two are asserted
 * against each other in tests/peekThreadContracts.test.mjs.
 *
 * The order is the order the composer offers them, chosen so the two a buyer
 * reaches for most often -- "what condition is it in" and "does it work" --
 * come first, and the open-ended option comes last.
 */

/**
 * @typedef {Object} PeekRequestCategory
 * @property {string} value    Enum value stored in the database.
 * @property {string} label    Shown in the composer.
 * @property {string} hint     One-line example, so a buyer writes something specific.
 */

/** @type {ReadonlyArray<PeekRequestCategory>} */
export const PEEK_REQUEST_CATEGORIES = Object.freeze([
  { value: 'condition', label: 'Condition', hint: 'Show wear, damage or how it has aged' },
  { value: 'operation', label: 'Operation', hint: 'Show it running, starting or in use' },
  { value: 'close_up', label: 'Close-up', hint: 'Show one part in detail' },
  { value: 'measurements', label: 'Measurements', hint: 'Show size, depth or capacity' },
  { value: 'surroundings', label: 'Surroundings', hint: 'Show what is around it' },
  { value: 'availability', label: 'Availability', hint: 'Show current stock or what is included' },
  { value: 'demonstration', label: 'Demonstration', hint: 'Show a specific task being done' },
  { value: 'documentation', label: 'Documentation', hint: 'Show papers, service history or plates' },
  { value: 'custom', label: 'Something else', hint: 'Describe what you want to see' },
]);

const BY_VALUE = new Map(PEEK_REQUEST_CATEGORIES.map((entry) => [entry.value, entry]));

/** @param {unknown} value */
export function isPeekRequestCategory(value) {
  return typeof value === 'string' && BY_VALUE.has(value);
}

/** @param {string} value */
export function peekRequestCategory(value) {
  return BY_VALUE.get(value) ?? null;
}

/** @param {string} value */
export function peekRequestCategoryLabel(value) {
  return BY_VALUE.get(value)?.label ?? 'Request';
}

/**
 * Suggested prompts per category and listing kind. These are the examples the
 * brief lists, mapped to the categories they belong to, so the composer can
 * offer a starting point instead of an empty box -- an empty box is how
 * "show more pics" requests happen.
 *
 * @type {Readonly<Record<string, ReadonlyArray<{category: string, body: string}>>>}
 */
export const SUGGESTED_REQUESTS = Object.freeze({
  property: Object.freeze([
    { category: 'operation', body: 'Show the water pressure in the upstairs bathroom' },
    { category: 'surroundings', body: 'Show the view from the balcony' },
    { category: 'condition', body: 'Show the roof and gutters' },
    { category: 'close_up', body: 'Show the kitchen cupboards inside' },
    { category: 'availability', body: 'Show where the parking is' },
  ]),
  car: Object.freeze([
    { category: 'operation', body: 'Show a cold engine start' },
    { category: 'close_up', body: 'Show the rear tyres and tread' },
    { category: 'condition', body: 'Show the underside of the vehicle' },
    { category: 'operation', body: 'Show the dashboard with the engine running' },
    { category: 'documentation', body: 'Show the service history book' },
  ]),
  machinery: Object.freeze([
    { category: 'operation', body: 'Show the machine operating under load' },
    { category: 'close_up', body: 'Show the tracks or tyres' },
    { category: 'documentation', body: 'Show the hour meter reading' },
    { category: 'condition', body: 'Show any hydraulic leaks' },
    { category: 'demonstration', body: 'Show a full lift cycle' },
  ]),
  service: Object.freeze([
    { category: 'demonstration', body: 'Show an example of previous work' },
    { category: 'availability', body: 'Show the equipment you bring' },
    { category: 'documentation', body: 'Show your certification' },
  ]),
});

/** @param {string} kind */
export function suggestedRequests(kind) {
  return SUGGESTED_REQUESTS[kind] ?? SUGGESTED_REQUESTS.service;
}

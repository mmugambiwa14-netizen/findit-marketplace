import { amenity, defineField } from '../defineField.js';

/**
 * Service fields (Part III §7).
 *
 * "Services must not be forced into property-style location or pricing
 * fields." Two consequences shape this file:
 *
 * - Coverage is a delivery *mode* first (remote / customer location / provider
 *   premises / mixed), and only the modes that need geography ask for it. A
 *   remote-only provider is never asked for a physical address -- Part III §12
 *   names that as a validation rule, and gating it here means the question is
 *   never posed rather than posed and then forgiven.
 * - Pricing is a model first (fixed / hourly / daily / per job / per unit /
 *   quote), and the amount fields follow from it. "Quote required" asks for no
 *   amount at all.
 */

export const SERVICE_SUBTYPES = Object.freeze([
  { value: 'property_developer', label: 'Property development' },
  { value: 'mechanic', label: 'Mechanical' },
  { value: 'construction', label: 'Construction' },
  { value: 'geological', label: 'Geological' },
]);

const NEEDS_BASE_LOCATION = ['provider_location', 'mixed'];
const NEEDS_TRAVEL_AREA = ['customer_location', 'mixed'];
const AMOUNT_PRICING = ['fixed', 'hourly', 'daily', 'per_job', 'per_unit'];

export const SERVICE_FIELDS = Object.freeze([
  // --- Provider -----------------------------------------------------------
  defineField({
    id: 'provider_kind', label: 'Provider type', input: 'select',
    section: 'overview', order: 10, requirement: 'required',
    options: [
      { value: 'individual', label: 'Individual' },
      { value: 'team', label: 'Team' },
      { value: 'company', label: 'Company' },
    ],
    filterable: true, onCard: true,
  }),
  defineField({
    id: 'years_experience', label: 'Years of experience', input: 'number',
    section: 'overview', order: 20, validation: { min: 0, max: 80, step: 1 },
    filterable: true, onCard: true,
  }),
  defineField({
    id: 'qualifications', label: 'Qualifications', input: 'textarea',
    section: 'overview', order: 30, validation: { maxLength: 500 },
  }),
  defineField({
    id: 'licences', label: 'Licences', input: 'textarea',
    section: 'documents', order: 10, validation: { maxLength: 500 },
  }),
  defineField({
    id: 'certifications', label: 'Certifications', input: 'textarea',
    section: 'documents', order: 20, validation: { maxLength: 500 },
  }),
  defineField({
    id: 'insurance_status', label: 'Insurance', input: 'select',
    section: 'documents', order: 30,
    options: [
      { value: 'insured', label: 'Insured' },
      { value: 'not_insured', label: 'Not insured' },
    ],
    allowUnknown: true, filterable: true,
  }),

  // --- Delivery mode drives everything about coverage ---------------------
  defineField({
    id: 'delivery_mode', label: 'How the service is delivered', input: 'select',
    section: 'service_area', order: 10, requirement: 'required',
    options: [
      { value: 'remote', label: 'Remotely' },
      { value: 'customer_location', label: 'At the customer' },
      { value: 'provider_location', label: 'At our premises' },
      { value: 'mixed', label: 'A combination' },
    ],
    filterable: true, onCard: true,
    storage: 'column', column: 'delivery_mode',
  }),
  defineField({
    id: 'base_location_id', label: 'Base location', input: 'text',
    section: 'service_area', order: 20,
    // Only asked when the provider actually has premises to visit.
    showWhen: { field: 'delivery_mode', in: NEEDS_BASE_LOCATION },
    requiredWhen: { field: 'delivery_mode', in: NEEDS_BASE_LOCATION },
    storage: 'column', column: 'base_location_id',
  }),
  defineField({
    id: 'service_radius_km', label: 'Travel radius', input: 'number',
    section: 'service_area', order: 30, unit: 'km',
    showWhen: { field: 'delivery_mode', in: NEEDS_TRAVEL_AREA },
    validation: { min: 1, max: 2000 },
    filterable: true,
    storage: 'column', column: 'service_radius_km',
  }),
  defineField({
    id: 'service_areas', label: 'Areas covered', input: 'multiselect',
    section: 'service_area', order: 40,
    showWhen: { field: 'delivery_mode', in: NEEDS_TRAVEL_AREA },
    options: [],
    filterable: true,
  }),
  defineField({
    id: 'remote_available', label: 'Also available remotely', input: 'boolean',
    section: 'service_area', order: 50,
    showWhen: { field: 'delivery_mode', not: ['remote'] },
    filterable: true,
    storage: 'column', column: 'remote_available',
  }),

  // --- Pricing model drives the amount fields -----------------------------
  defineField({
    id: 'pricing_type', label: 'Pricing model', input: 'select',
    section: 'pricing', order: 10, requirement: 'required',
    options: [
      { value: 'fixed', label: 'Fixed price' },
      { value: 'starting_from', label: 'Starting from' },
      { value: 'hourly', label: 'Per hour' },
      { value: 'daily', label: 'Per day' },
      { value: 'per_job', label: 'Per job' },
      { value: 'per_unit', label: 'Per unit' },
      { value: 'quote_required', label: 'Quote required' },
    ],
    filterable: true, onCard: true,
    storage: 'column', column: 'pricing_type',
  }),
  defineField({
    id: 'price', label: 'Amount', input: 'number',
    section: 'pricing', order: 20,
    // No amount is asked for when the answer is "it depends".
    showWhen: { field: 'pricing_type', in: AMOUNT_PRICING.concat(['starting_from']) },
    requiredWhen: { field: 'pricing_type', in: AMOUNT_PRICING },
    validation: { min: 0, max: 999999999999 },
    filterable: true, onCard: true,
    storage: 'column', column: 'price',
  }),
  defineField({
    id: 'price_unit_label', label: 'Unit', input: 'text',
    section: 'pricing', order: 30,
    showWhen: { field: 'pricing_type', in: ['per_unit'] },
    requiredWhen: { field: 'pricing_type', in: ['per_unit'] },
    validation: { maxLength: 40 },
  }),
  defineField({
    id: 'callout_fee', label: 'Call-out fee', input: 'number',
    section: 'pricing', order: 40,
    showWhen: { field: 'delivery_mode', in: NEEDS_TRAVEL_AREA },
    validation: { min: 0, max: 10000000 },
  }),
  defineField({
    id: 'minimum_charge', label: 'Minimum charge', input: 'number',
    section: 'pricing', order: 50, validation: { min: 0, max: 10000000 },
  }),
  defineField({
    id: 'materials_included', label: 'Materials included', input: 'select',
    section: 'pricing', order: 60,
    options: [
      { value: 'included', label: 'Included' },
      { value: 'excluded', label: 'Charged separately' },
      { value: 'depends', label: 'Depends on the job' },
    ],
    filterable: true,
  }),

  // --- Availability -------------------------------------------------------
  defineField({
    id: 'lead_time', label: 'Typical lead time', input: 'select',
    section: 'availability', order: 10,
    options: [
      { value: 'same_day', label: 'Same day' }, { value: 'next_day', label: 'Next day' },
      { value: 'within_week', label: 'Within a week' },
      { value: 'within_month', label: 'Within a month' },
      { value: 'longer', label: 'Longer' },
    ],
    filterable: true, onCard: true,
  }),
  defineField({
    id: 'estimated_duration', label: 'Typical job duration', input: 'text',
    section: 'availability', order: 20, validation: { maxLength: 60 },
  }),
  amenity('emergency_available', 'Emergency call-outs', 'availability', 30, { onCard: true }),
  amenity('after_hours_available', 'After-hours work', 'availability', 40),
  defineField({
    id: 'booking_preference', label: 'How to book', input: 'select',
    section: 'availability', order: 50,
    options: [
      { value: 'call', label: 'Call' }, { value: 'message', label: 'Message on FindIt' },
      { value: 'whatsapp', label: 'WhatsApp' }, { value: 'quote_first', label: 'Request a quote first' },
    ],
    filterable: true,
  }),

  // --- Assurance ----------------------------------------------------------
  defineField({
    id: 'workmanship_guarantee', label: 'Workmanship guarantee', input: 'select',
    section: 'features', order: 10,
    options: [
      { value: 'none', label: 'None' }, { value: '30_days', label: '30 days' },
      { value: '90_days', label: '90 days' }, { value: '6_months', label: '6 months' },
      { value: '12_months', label: '12 months' },
    ],
    filterable: true, onCard: true,
  }),
  defineField({
    id: 'languages', label: 'Languages spoken', input: 'multiselect',
    section: 'features', order: 20,
    options: [
      { value: 'en', label: 'English' }, { value: 'sn', label: 'Shona' },
      { value: 'nd', label: 'Ndebele' }, { value: 'af', label: 'Afrikaans' },
      { value: 'pt', label: 'Portuguese' },
    ],
    filterable: true,
  }),
  amenity('equipment_supplied', 'Brings own equipment', 'features', 30),
  defineField({
    id: 'customer_requirements', label: 'What the customer must provide', input: 'textarea',
    section: 'features', order: 40, validation: { maxLength: 500 },
  }),
]);

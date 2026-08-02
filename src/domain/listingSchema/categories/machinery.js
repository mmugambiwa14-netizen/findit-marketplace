import { amenity, defineField } from '../defineField.js';

/**
 * Heavy vehicle and machinery fields (Part III §6).
 *
 * The governing rule: "Irrelevant machinery fields must not appear merely
 * because they exist for another equipment subtype." Capacity fields are
 * therefore each gated by `showWhen` on the equipment subtype -- digging depth
 * belongs to excavators, lifting capacity to cranes and forklifts, payload to
 * tippers. A forklift listing never renders a digging-depth question.
 *
 * `machinery_type`, `brand`, `model`, `year`, `condition` and `usage_hours`
 * map to the existing `machinery_details` columns.
 */

export const MACHINERY_SUBTYPES = Object.freeze([
  { value: 'excavator', label: 'Excavator' },
  { value: 'loader', label: 'Loader' },
  { value: 'bulldozer', label: 'Bulldozer' },
  { value: 'grader', label: 'Grader' },
  { value: 'crane', label: 'Crane' },
  { value: 'forklift', label: 'Forklift' },
  { value: 'tipper', label: 'Tipper truck' },
  { value: 'tractor', label: 'Tractor' },
  { value: 'generator', label: 'Generator' },
  { value: 'compressor', label: 'Compressor' },
]);

const DIGGERS = ['excavator', 'loader', 'bulldozer'];
const LIFTERS = ['crane', 'forklift'];
const HAULERS = ['tipper', 'tractor'];
const POWERED = ['generator', 'compressor'];
const ROAD_GOING = ['tipper', 'tractor', 'crane'];

export const MACHINERY_FIELDS = Object.freeze([
  // --- Identity -----------------------------------------------------------
  defineField({
    id: 'machinery_type', label: 'Equipment type', input: 'select',
    section: 'overview', order: 10, requirement: 'required',
    options: MACHINERY_SUBTYPES.map((entry) => ({ ...entry })),
    filterable: true, onCard: true,
    storage: 'column', column: 'machinery_type',
  }),
  defineField({
    id: 'brand', label: 'Manufacturer', input: 'text', section: 'overview', order: 20,
    requirement: 'required', validation: { maxLength: 60 },
    searchable: true, filterable: true, onCard: true,
    storage: 'column', column: 'brand',
  }),
  defineField({
    id: 'model', label: 'Model', input: 'text', section: 'overview', order: 30,
    requirement: 'required', validation: { maxLength: 60 },
    searchable: true, onCard: true,
    storage: 'column', column: 'model',
  }),
  defineField({
    id: 'year', label: 'Year', input: 'number', section: 'overview', order: 40,
    validation: { min: 1900, max: 2100, step: 1 }, allowUnknown: true,
    filterable: true, onCard: true,
    storage: 'column', column: 'year',
  }),
  defineField({
    id: 'serial_number', label: 'Serial / chassis number', input: 'text',
    section: 'documents', order: 10, validation: { maxLength: 80 },
    // Identifiers are moderation-only: useful for verifying a machine is not
    // stolen, not something to publish next to a price.
    visibility: 'moderation', onDetail: false,
  }),

  // --- Usage --------------------------------------------------------------
  defineField({
    id: 'usage_hours', label: 'Operating hours', input: 'number',
    section: 'specifications', order: 10, requirement: 'required', unit: 'hours',
    validation: { min: 0, max: 200000 },
    filterable: true, onCard: true,
    storage: 'column', column: 'usage_hours',
  }),
  defineField({
    id: 'mileage_km', label: 'Mileage', input: 'number',
    section: 'specifications', order: 20, unit: 'km',
    showWhen: { field: 'machinery_type', in: ROAD_GOING },
    validation: { min: 0, max: 3000000 }, filterable: true,
  }),

  // --- Power --------------------------------------------------------------
  defineField({
    id: 'engine_type', label: 'Engine', input: 'text',
    section: 'specifications', order: 30, validation: { maxLength: 60 },
  }),
  defineField({
    id: 'fuel_type', label: 'Fuel type', input: 'select',
    section: 'specifications', order: 40,
    options: [
      { value: 'diesel', label: 'Diesel' }, { value: 'petrol', label: 'Petrol' },
      { value: 'electric', label: 'Electric' }, { value: 'hybrid', label: 'Hybrid' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'power_output_kw', label: 'Power output', input: 'number',
    section: 'specifications', order: 50, unit: 'kw',
    validation: { min: 0, max: 10000 }, filterable: true,
  }),
  defineField({
    id: 'drivetrain', label: 'Drivetrain', input: 'select',
    section: 'specifications', order: 60,
    options: [
      { value: 'wheeled', label: 'Wheeled' }, { value: 'tracked', label: 'Tracked' },
      { value: '4x4', label: '4x4' }, { value: '6x4', label: '6x4' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'transmission', label: 'Transmission', input: 'select',
    section: 'specifications', order: 70,
    options: [
      { value: 'manual', label: 'Manual' }, { value: 'automatic', label: 'Automatic' },
      { value: 'hydrostatic', label: 'Hydrostatic' }, { value: 'powershift', label: 'Powershift' },
    ],
  }),

  // --- Capacity: each gated to the subtypes it belongs to ------------------
  defineField({
    id: 'rated_capacity_t', label: 'Rated capacity', input: 'number',
    section: 'specifications', order: 80, unit: 'tonnes',
    showWhen: { field: 'machinery_type', in: LIFTERS.concat(HAULERS) },
    validation: { min: 0, max: 2000 }, filterable: true, onCard: true,
  }),
  defineField({
    id: 'lifting_capacity_t', label: 'Lifting capacity', input: 'number',
    section: 'specifications', order: 90, unit: 'tonnes',
    showWhen: { field: 'machinery_type', in: LIFTERS },
    validation: { min: 0, max: 2000 }, filterable: true,
  }),
  defineField({
    id: 'payload_t', label: 'Payload', input: 'number',
    section: 'specifications', order: 100, unit: 'tonnes',
    showWhen: { field: 'machinery_type', in: HAULERS },
    validation: { min: 0, max: 500 }, filterable: true,
  }),
  defineField({
    id: 'reach_m', label: 'Reach', input: 'number',
    section: 'specifications', order: 110, unit: 'm',
    showWhen: { field: 'machinery_type', in: LIFTERS.concat(['excavator']) },
    validation: { min: 0, max: 200 }, filterable: true,
  }),
  defineField({
    id: 'digging_depth_m', label: 'Digging depth', input: 'number',
    section: 'specifications', order: 120, unit: 'm',
    showWhen: { field: 'machinery_type', in: DIGGERS },
    validation: { min: 0, max: 60 }, filterable: true,
  }),
  defineField({
    id: 'output_kva', label: 'Output', input: 'number',
    section: 'specifications', order: 130, unit: 'kva',
    showWhen: { field: 'machinery_type', in: POWERED },
    validation: { min: 0, max: 20000 }, filterable: true,
  }),
  defineField({
    id: 'operating_weight_kg', label: 'Operating weight', input: 'number',
    section: 'specifications', order: 140, unit: 'kg',
    validation: { min: 0, max: 1000000 }, filterable: true,
  }),
  defineField({
    id: 'axle_configuration', label: 'Axle configuration', input: 'text',
    section: 'specifications', order: 150,
    showWhen: { field: 'machinery_type', in: ROAD_GOING },
    validation: { maxLength: 30 },
  }),
  defineField({
    id: 'tyre_track_condition', label: 'Tyre / track condition', input: 'select',
    section: 'condition_history', order: 10,
    options: [
      { value: 'new', label: 'New' }, { value: 'good', label: 'Good' },
      { value: 'fair', label: 'Fair' }, { value: 'needs_replacement', label: 'Needs replacement' },
    ],
    filterable: true,
  }),

  // --- Condition and maintenance history ----------------------------------
  defineField({
    id: 'condition', label: 'Condition', input: 'select',
    section: 'condition_history', order: 20, requirement: 'required',
    options: [
      { value: 'new', label: 'New' }, { value: 'excellent', label: 'Excellent' },
      { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' },
      { value: 'for_parts', label: 'For parts' },
    ],
    filterable: true, onCard: true,
    storage: 'column', column: 'condition',
  }),
  defineField({
    id: 'service_history', label: 'Service history', input: 'select',
    section: 'condition_history', order: 30, requirement: 'required',
    options: [
      { value: 'full', label: 'Full' }, { value: 'partial', label: 'Partial' },
      { value: 'none', label: 'None' }, { value: 'unknown', label: 'Unknown' },
    ],
    allowUnknown: true, filterable: true, onCard: true,
  }),
  amenity('maintenance_records', 'Maintenance records available', 'condition_history', 40, {
    showWhen: { field: 'service_history', in: ['full', 'partial'] },
  }),
  defineField({
    id: 'last_service_date', label: 'Last service', input: 'date',
    section: 'condition_history', order: 50,
    showWhen: { field: 'service_history', in: ['full', 'partial'] },
  }),
  defineField({
    id: 'last_service_hours', label: 'Hours at last service', input: 'number',
    section: 'condition_history', order: 60, unit: 'hours',
    showWhen: { field: 'service_history', in: ['full', 'partial'] },
    validation: { min: 0, max: 200000 },
  }),
  defineField({
    id: 'rebuild_history', label: 'Rebuild / overhaul', input: 'select',
    section: 'condition_history', order: 70,
    options: [
      { value: 'none', label: 'None' }, { value: 'engine', label: 'Engine overhauled' },
      { value: 'hydraulics', label: 'Hydraulics rebuilt' }, { value: 'full', label: 'Full rebuild' },
    ],
    allowUnknown: true,
  }),
  defineField({
    id: 'damage_history', label: 'Damage history', input: 'select',
    section: 'condition_history', order: 80,
    options: [
      { value: 'none', label: 'None' }, { value: 'repaired', label: 'Damaged, repaired' },
      { value: 'unrepaired', label: 'Damaged, unrepaired' },
    ],
    allowUnknown: true, filterable: true,
  }),

  // --- Compliance and logistics -------------------------------------------
  defineField({
    id: 'inspection_status', label: 'Inspection', input: 'select',
    section: 'documents', order: 20,
    options: [
      { value: 'passed', label: 'Passed' }, { value: 'due', label: 'Due' },
      { value: 'not_inspected', label: 'Not inspected' },
    ],
    allowUnknown: true, filterable: true,
  }),
  defineField({
    id: 'certification_status', label: 'Certification', input: 'select',
    section: 'documents', order: 30,
    showWhen: { field: 'machinery_type', in: LIFTERS },
    options: [
      { value: 'current', label: 'Current' }, { value: 'expired', label: 'Expired' },
      { value: 'none', label: 'None' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'ownership_status', label: 'Ownership', input: 'select',
    section: 'documents', order: 40,
    options: [
      { value: 'owned_outright', label: 'Owned outright' },
      { value: 'financed', label: 'Financed' },
      { value: 'leased', label: 'Leased' },
    ],
  }),
  defineField({
    id: 'import_status', label: 'Import status', input: 'select',
    section: 'documents', order: 50,
    options: [
      { value: 'local', label: 'Locally sourced' },
      { value: 'imported_cleared', label: 'Imported, cleared' },
      { value: 'imported_uncleared', label: 'Imported, not cleared' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'warranty', label: 'Warranty', input: 'select', section: 'documents', order: 60,
    options: [
      { value: 'manufacturer', label: 'Manufacturer' }, { value: 'dealer', label: 'Dealer' },
      { value: 'none', label: 'None' },
    ],
  }),
  amenity('operator_manuals', 'Operator manuals included', 'documents', 70),
  defineField({
    id: 'attachments', label: 'Attachments included', input: 'multiselect',
    section: 'features', order: 10,
    showWhen: { field: 'machinery_type', in: DIGGERS.concat(['tractor', 'forklift']) },
    options: [
      { value: 'bucket', label: 'Bucket' }, { value: 'breaker', label: 'Hydraulic breaker' },
      { value: 'ripper', label: 'Ripper' }, { value: 'grapple', label: 'Grapple' },
      { value: 'auger', label: 'Auger' }, { value: 'forks', label: 'Pallet forks' },
      { value: 'blade', label: 'Blade' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'delivery_options', label: 'Transport / delivery', input: 'select',
    section: 'availability', order: 10,
    options: [
      { value: 'buyer_collects', label: 'Buyer collects' },
      { value: 'seller_delivers', label: 'Seller can deliver' },
      { value: 'negotiable', label: 'Negotiable' },
    ],
    filterable: true,
  }),
]);

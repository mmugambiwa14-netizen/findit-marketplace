import { amenity, defineField } from '../defineField.js';

/**
 * Vehicle fields (Part III §5).
 *
 * Mileage, service history and accident history are required to be prominent,
 * structured and filterable -- they are the facts a buyer judges a used vehicle
 * on, and burying them in a description is the exact failure Part III targets.
 * All three therefore carry `filterable: true` and appear on cards.
 *
 * `brand`, `model`, `year`, `mileage`, `fuel_type`, `transmission` and
 * `condition` map to the existing `car_details` columns.
 */

export const VEHICLE_SUBTYPES = Object.freeze([
  { value: 'car', label: 'Car' },
  { value: 'bakkie', label: 'Bakkie / pickup' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van / minibus' },
  { value: 'truck', label: 'Truck' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'trailer', label: 'Trailer' },
]);

const ELECTRIC = ['electric', 'hybrid', 'plug_in_hybrid'];
const COMBUSTION = ['petrol', 'diesel', 'lpg'];

export const VEHICLE_FIELDS = Object.freeze([
  // --- Identity -----------------------------------------------------------
  defineField({
    id: 'brand', label: 'Make', input: 'text', section: 'overview', order: 10,
    requirement: 'required', validation: { maxLength: 60 },
    searchable: true, filterable: true, onCard: true,
    storage: 'column', column: 'brand',
  }),
  defineField({
    id: 'model', label: 'Model', input: 'text', section: 'overview', order: 20,
    requirement: 'required', validation: { maxLength: 60 },
    searchable: true, filterable: true, onCard: true,
    storage: 'column', column: 'model',
  }),
  defineField({
    id: 'variant', label: 'Variant / trim', input: 'text', section: 'overview', order: 30,
    validation: { maxLength: 60 }, searchable: true,
  }),
  defineField({
    id: 'body_type', label: 'Body type', input: 'select', section: 'overview', order: 40,
    options: [
      { value: 'hatchback', label: 'Hatchback' }, { value: 'sedan', label: 'Sedan' },
      { value: 'suv', label: 'SUV' }, { value: 'bakkie', label: 'Bakkie' },
      { value: 'coupe', label: 'Coupe' }, { value: 'convertible', label: 'Convertible' },
      { value: 'wagon', label: 'Wagon' }, { value: 'minibus', label: 'Minibus' },
      { value: 'panel_van', label: 'Panel van' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'year', label: 'Model year', input: 'number', section: 'overview', order: 50,
    requirement: 'required', validation: { min: 1900, max: 2100, step: 1 },
    filterable: true, onCard: true,
    storage: 'column', column: 'year',
  }),
  defineField({
    id: 'registration_year', label: 'Registration year', input: 'number',
    section: 'overview', order: 60, validation: { min: 1900, max: 2100, step: 1 },
    allowUnknown: true,
  }),

  // --- Mileage: prominent and filterable ----------------------------------
  defineField({
    id: 'mileage', label: 'Mileage', input: 'number', section: 'specifications', order: 10,
    requirement: 'required', unit: 'km', validation: { min: 0, max: 3000000 },
    filterable: true, onCard: true,
    storage: 'column', column: 'mileage',
  }),
  defineField({
    id: 'mileage_unit', label: 'Mileage unit', input: 'select',
    section: 'specifications', order: 20,
    options: [{ value: 'km', label: 'Kilometres' }, { value: 'mi', label: 'Miles' }],
  }),

  // --- Drivetrain ---------------------------------------------------------
  defineField({
    id: 'transmission', label: 'Transmission', input: 'select',
    section: 'specifications', order: 30, requirement: 'required',
    options: [
      { value: 'manual', label: 'Manual' }, { value: 'automatic', label: 'Automatic' },
      { value: 'cvt', label: 'CVT' }, { value: 'dct', label: 'Dual clutch' },
    ],
    filterable: true, onCard: true,
    storage: 'column', column: 'transmission',
  }),
  defineField({
    id: 'fuel_type', label: 'Fuel / power', input: 'select',
    section: 'specifications', order: 40, requirement: 'required',
    options: [
      { value: 'petrol', label: 'Petrol' }, { value: 'diesel', label: 'Diesel' },
      { value: 'hybrid', label: 'Hybrid' }, { value: 'plug_in_hybrid', label: 'Plug-in hybrid' },
      { value: 'electric', label: 'Electric' }, { value: 'lpg', label: 'LPG' },
    ],
    filterable: true, onCard: true,
    storage: 'column', column: 'fuel_type',
  }),
  defineField({
    id: 'engine_size_cc', label: 'Engine size', input: 'number',
    section: 'specifications', order: 50, unit: 'cc',
    showWhen: { field: 'fuel_type', in: COMBUSTION.concat(['hybrid', 'plug_in_hybrid']) },
    validation: { min: 50, max: 20000 }, filterable: true,
  }),
  defineField({
    id: 'battery_capacity_kwh', label: 'Battery capacity', input: 'number',
    section: 'specifications', order: 60, unit: 'kwh',
    showWhen: { field: 'fuel_type', in: ELECTRIC },
    validation: { min: 1, max: 500 }, filterable: true,
  }),
  defineField({
    id: 'drivetrain', label: 'Drivetrain', input: 'select',
    section: 'specifications', order: 70,
    options: [
      { value: 'fwd', label: 'Front-wheel drive' }, { value: 'rwd', label: 'Rear-wheel drive' },
      { value: 'awd', label: 'All-wheel drive' }, { value: '4x4', label: '4x4' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'steering_side', label: 'Steering', input: 'select',
    section: 'specifications', order: 80,
    options: [{ value: 'right', label: 'Right-hand drive' }, { value: 'left', label: 'Left-hand drive' }],
    filterable: true,
  }),
  defineField({
    id: 'doors', label: 'Doors', input: 'number', section: 'specifications', order: 90,
    validation: { min: 1, max: 8, step: 1 },
  }),
  defineField({
    id: 'seats', label: 'Seats', input: 'number', section: 'specifications', order: 100,
    validation: { min: 1, max: 80, step: 1 }, filterable: true,
  }),
  defineField({
    id: 'exterior_colour', label: 'Exterior colour', input: 'text',
    section: 'specifications', order: 110, validation: { maxLength: 40 }, filterable: true,
  }),
  defineField({
    id: 'interior_colour', label: 'Interior colour', input: 'text',
    section: 'specifications', order: 120, validation: { maxLength: 40 },
  }),

  // --- Condition and history: the trust section ---------------------------
  defineField({
    id: 'condition', label: 'Condition', input: 'select',
    section: 'condition_history', order: 10, requirement: 'required',
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
    section: 'condition_history', order: 20, requirement: 'required',
    options: [
      { value: 'full', label: 'Full' }, { value: 'partial', label: 'Partial' },
      { value: 'none', label: 'None' }, { value: 'unknown', label: 'Unknown' },
    ],
    // "Unknown" is genuinely useful buyer information here, per Part III §10.
    allowUnknown: true, filterable: true, onCard: true,
  }),
  amenity('service_records_available', 'Service records available', 'condition_history', 30, {
    showWhen: { field: 'service_history', in: ['full', 'partial'] },
  }),
  defineField({
    id: 'last_service_date', label: 'Last service date', input: 'date',
    section: 'condition_history', order: 40,
    showWhen: { field: 'service_history', in: ['full', 'partial'] },
  }),
  defineField({
    id: 'last_service_mileage', label: 'Mileage at last service', input: 'number',
    section: 'condition_history', order: 50, unit: 'km',
    showWhen: { field: 'service_history', in: ['full', 'partial'] },
    validation: { min: 0, max: 3000000 },
  }),
  defineField({
    id: 'accident_history', label: 'Accident history', input: 'select',
    section: 'condition_history', order: 60, requirement: 'required',
    options: [
      { value: 'none', label: 'No accidents' },
      { value: 'minor', label: 'Minor, repaired' },
      { value: 'major', label: 'Major, repaired' },
      { value: 'unknown', label: 'Unknown' },
    ],
    allowUnknown: true, filterable: true, onCard: true,
  }),
  defineField({
    id: 'rebuilt_status', label: 'Rebuilt / write-off', input: 'select',
    section: 'condition_history', order: 70,
    options: [
      { value: 'no', label: 'Never written off' },
      { value: 'rebuilt', label: 'Rebuilt' },
      { value: 'written_off', label: 'Written off' },
    ],
    allowUnknown: true, filterable: true,
  }),
  defineField({
    id: 'previous_owners', label: 'Previous owners', input: 'number',
    section: 'condition_history', order: 80, validation: { min: 0, max: 50, step: 1 },
    allowUnknown: true,
  }),

  // --- Paperwork ----------------------------------------------------------
  defineField({
    id: 'import_status', label: 'Import status', input: 'select',
    section: 'documents', order: 10,
    options: [
      { value: 'locally_registered', label: 'Locally registered' },
      { value: 'imported_registered', label: 'Imported, registered' },
      { value: 'imported_unregistered', label: 'Imported, not yet registered' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'registration_status', label: 'Registration', input: 'select',
    section: 'documents', order: 20,
    options: [
      { value: 'current', label: 'Current' }, { value: 'expired', label: 'Expired' },
      { value: 'unregistered', label: 'Unregistered' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'roadworthy_status', label: 'Inspection / roadworthy', input: 'select',
    section: 'documents', order: 30,
    options: [
      { value: 'valid', label: 'Valid' }, { value: 'expired', label: 'Expired' },
      { value: 'not_tested', label: 'Not tested' },
    ],
    allowUnknown: true, filterable: true,
  }),
  defineField({
    id: 'finance_encumbrance', label: 'Finance or encumbrance', input: 'select',
    section: 'documents', order: 40,
    options: [
      { value: 'none', label: 'Settled / none' },
      { value: 'outstanding', label: 'Finance outstanding' },
    ],
    allowUnknown: true,
  }),
  defineField({
    id: 'warranty', label: 'Warranty', input: 'select', section: 'documents', order: 50,
    options: [
      { value: 'manufacturer', label: 'Manufacturer warranty' },
      { value: 'dealer', label: 'Dealer warranty' },
      { value: 'none', label: 'None' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'spare_keys', label: 'Spare keys', input: 'number',
    section: 'documents', order: 60, validation: { min: 0, max: 10, step: 1 },
  }),

  // --- Features -----------------------------------------------------------
  defineField({
    id: 'safety_features', label: 'Safety', input: 'multiselect',
    section: 'features', order: 10,
    options: [
      { value: 'abs', label: 'ABS' }, { value: 'airbags', label: 'Airbags' },
      { value: 'esp', label: 'Stability control' }, { value: 'park_sensors', label: 'Park sensors' },
      { value: 'reverse_camera', label: 'Reverse camera' }, { value: 'isofix', label: 'ISOFIX' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'comfort_features', label: 'Comfort', input: 'multiselect',
    section: 'features', order: 20,
    options: [
      { value: 'aircon', label: 'Air conditioning' }, { value: 'climate_control', label: 'Climate control' },
      { value: 'leather', label: 'Leather seats' }, { value: 'electric_windows', label: 'Electric windows' },
      { value: 'cruise_control', label: 'Cruise control' }, { value: 'sunroof', label: 'Sunroof' },
    ],
    filterable: true,
  }),
  defineField({
    id: 'technology_features', label: 'Technology', input: 'multiselect',
    section: 'features', order: 30,
    options: [
      { value: 'bluetooth', label: 'Bluetooth' }, { value: 'carplay', label: 'Apple CarPlay' },
      { value: 'android_auto', label: 'Android Auto' }, { value: 'navigation', label: 'Navigation' },
      { value: 'touchscreen', label: 'Touchscreen' },
    ],
    filterable: true,
  }),
]);

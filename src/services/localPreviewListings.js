import { localPreviewModeEnabled } from '@/lib/localPreview';

const LOCATION_ROWS = [
  ['Harare', -17.8252, 31.0335],
  ['Bulawayo', -20.1325, 28.6265],
  ['Mutare', -18.9707, 32.6709],
  ['Gweru', -19.4515, 29.8169],
  ['Masvingo', -20.0744, 30.8326],
  ['Chitungwiza', -18.0127, 31.0756],
  ['Kwekwe', -18.9281, 29.8149],
  ['Kadoma', -18.3333, 29.9167],
  ['Victoria Falls', -17.9243, 25.8567],
  ['Marondera', -18.1853, 31.5519],
  ['Chinhoyi', -17.3667, 30.2000],
  ['Kariba', -16.5167, 28.8000],
];

const LOCATIONS = Object.freeze(LOCATION_ROWS.map(([name, latitude, longitude], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 101).padStart(12, '0')}`,
  name,
  type: 'city',
  latitude,
  longitude,
})));

const SELLERS = Object.freeze([
  'Moyo Motors',
  'Open House Zimbabwe',
  'Tich Equipment',
  'Northside Marketplace',
  'Matobo Trading',
  'Eastern Highlands Sales',
  'Zambezi Auto',
  'City Homes',
  'Prime Plant Hire',
  'Sunrise Dealers',
  'Metro Property Desk',
  'Workhorse Machinery',
]);

const PROPERTY_TEMPLATES = Object.freeze([
  { category: 'house_sale', label: 'family house', bedrooms: 3, bathrooms: 2, size: 420, price: 112000 },
  { category: 'house_rent', label: 'solar-backed family home', bedrooms: 4, bathrooms: 2, size: 510, price: 1250 },
  { category: 'apartment_sale', label: 'modern two-bedroom apartment', bedrooms: 2, bathrooms: 2, size: 96, price: 78000 },
  { category: 'apartment_rent', label: 'furnished city apartment', bedrooms: 2, bathrooms: 1, size: 82, price: 720 },
  { category: 'townhouse', label: 'secure garden townhouse', bedrooms: 3, bathrooms: 2, size: 230, price: 148000 },
  { category: 'cluster', label: 'new cluster home', bedrooms: 3, bathrooms: 3, size: 205, price: 185000 },
  { category: 'cottage', label: 'quiet two-bedroom cottage', bedrooms: 2, bathrooms: 1, size: 135, price: 64000 },
  { category: 'warehouse', label: 'high-clearance warehouse', bedrooms: 0, bathrooms: 2, size: 850, price: 210000 },
  { category: 'office', label: 'central office suite', bedrooms: 0, bathrooms: 2, size: 180, price: 1450 },
  { category: 'residential_stand', label: 'serviced residential stand', bedrooms: 0, bathrooms: 0, size: 1200, price: 36000 },
  { category: 'farm', label: 'productive small farm', bedrooms: 4, bathrooms: 2, size: 24000, price: 260000 },
  { category: 'guesthouse', label: 'operating guesthouse', bedrooms: 8, bathrooms: 8, size: 1300, price: 395000 },
]);

const CAR_TEMPLATES = Object.freeze([
  { brand: 'Toyota', model: 'Hilux 2.8 GD-6 double cab', year: 2021, fuel: 'diesel', transmission: 'automatic', price: 28500, category: 'utility' },
  { brand: 'Honda', model: 'Fit Hybrid', year: 2019, fuel: 'hybrid', transmission: 'automatic', price: 9800, category: 'cars_sale' },
  { brand: 'Nissan', model: 'X-Trail 2.0', year: 2018, fuel: 'petrol', transmission: 'automatic', price: 16750, category: 'cars_sale' },
  { brand: 'Mazda', model: 'CX-5 Skyactiv', year: 2020, fuel: 'petrol', transmission: 'automatic', price: 21800, category: 'cars_sale' },
  { brand: 'Ford', model: 'Ranger Wildtrak', year: 2022, fuel: 'diesel', transmission: 'automatic', price: 42500, category: 'utility' },
  { brand: 'Toyota', model: 'Fortuner 2.8', year: 2020, fuel: 'diesel', transmission: 'automatic', price: 39500, category: 'cars_sale' },
  { brand: 'Mercedes-Benz', model: 'C200 Avantgarde', year: 2017, fuel: 'petrol', transmission: 'automatic', price: 23500, category: 'luxury_classic' },
  { brand: 'Volkswagen', model: 'Polo TSI', year: 2021, fuel: 'petrol', transmission: 'automatic', price: 17200, category: 'cars_sale' },
  { brand: 'Isuzu', model: 'D-Max 3.0', year: 2019, fuel: 'diesel', transmission: 'manual', price: 26750, category: 'utility' },
  { brand: 'Subaru', model: 'Forester XT', year: 2018, fuel: 'petrol', transmission: 'automatic', price: 19400, category: 'cars_sale' },
  { brand: 'Suzuki', model: 'Swift GLX', year: 2022, fuel: 'petrol', transmission: 'automatic', price: 14500, category: 'cars_sale' },
  { brand: 'Toyota', model: 'Hiace commuter', year: 2017, fuel: 'diesel', transmission: 'manual', price: 24500, category: 'minibus_kombi' },
]);

const MACHINERY_TEMPLATES = Object.freeze([
  { brand: 'Perkins', model: '45 kVA diesel generator', category: 'generators', type: 'industrial', price: 9500, year: 2019 },
  { brand: 'Caterpillar', model: '320D excavator', category: 'construction', type: 'excavator', price: 72000, year: 2016 },
  { brand: 'John Deere', model: '5075E tractor', category: 'agricultural', type: 'tractor', price: 38500, year: 2020 },
  { brand: 'JCB', model: '3CX backhoe loader', category: 'construction', type: 'backhoe', price: 58500, year: 2018 },
  { brand: 'Cummins', model: '100 kVA silent generator', category: 'generators', type: 'industrial', price: 17800, year: 2021 },
  { brand: 'Toyota Industries', model: '2.5 tonne forklift', category: 'material_handling', type: 'forklift', price: 14200, year: 2017 },
  { brand: 'Massey Ferguson', model: '290 agricultural tractor', category: 'agricultural', type: 'tractor', price: 24500, year: 2015 },
  { brand: 'Bomag', model: 'BW120 road roller', category: 'compaction', type: 'roller', price: 31900, year: 2018 },
  { brand: 'Atlas Copco', model: 'XAS 88 air compressor', category: 'construction', type: 'compressor', price: 12800, year: 2020 },
  { brand: 'SANY', model: '25 tonne mobile crane', category: 'lifting', type: 'crane', price: 118000, year: 2019 },
  { brand: 'New Holland', model: 'TC5.30 combine harvester', category: 'agricultural', type: 'harvester', price: 89000, year: 2017 },
  { brand: 'Hitachi', model: 'ZX200 mining excavator', category: 'mining', type: 'excavator', price: 84000, year: 2018 },
]);

function localAsset(filename) {
  const basePath = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${basePath}mock/${filename}`;
}

function listingId(index) {
  return `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function sellerId(index) {
  return `10000000-0000-4000-8000-${String((index % SELLERS.length) + 1).padStart(12, '0')}`;
}

function pointFor(index, location) {
  const latitudeOffset = ((index % 9) - 4) * 0.0062;
  const longitudeOffset = (((index * 7) % 9) - 4) * 0.0071;
  return {
    latitude: Number((location.latitude + latitudeOffset).toFixed(6)),
    longitude: Number((location.longitude + longitudeOffset).toFixed(6)),
  };
}

function commonFields(index, kind, location) {
  const sellerIndex = (index * 5 + kind.length) % SELLERS.length;
  return {
    id: listingId(index),
    kind,
    seller_id: sellerId(sellerIndex),
    seller_name: SELLERS[sellerIndex],
    contact_phone: `+26377${String(1200000 + index).slice(-7)}`,
    contact_whatsapp: `+26377${String(1200000 + index).slice(-7)}`,
    contact_email: `preview-${sellerIndex + 1}@findit.example`,
    currency: 'USD',
    deposit: null,
    agent_fee: null,
    additional_fees: null,
    accepts_offers: index % 4 !== 0,
    variants: [],
    status: 'available',
    created_via: 'single',
    views: 18 + ((index * 37) % 1800),
    created_at: new Date(Date.UTC(2026, 6, 28, 12) - index * 3_600_000).toISOString(),
    updated_at: new Date(Date.UTC(2026, 6, 28, 12) - index * 1_800_000).toISOString(),
    location: { id: location.id, name: location.name, type: location.type },
    ...pointFor(index, location),
  };
}

function createProperty(index) {
  const template = PROPERTY_TEMPLATES[index % PROPERTY_TEMPLATES.length];
  const location = LOCATIONS[(index * 5) % LOCATIONS.length];
  const rent = template.category.includes('rent') || template.category === 'office';
  const sequence = Math.floor((index % 120) / PROPERTY_TEMPLATES.length) + 1;
  return {
    ...commonFields(index, 'property', location),
    title: `${template.label[0].toUpperCase()}${template.label.slice(1)} in ${location.name}`,
    description: `Preview property ${sequence} with practical access, secure parking, reliable utilities and viewing arrangements available through the listed seller.`,
    price: Math.round(template.price * (0.88 + (sequence % 7) * 0.035)),
    photos: [localAsset('findit-property-preview.jpg')],
    category: template.category,
    listing_type: rent ? 'rent' : 'sale',
    car_details: null,
    property_details: {
      property_type: template.category,
      bedrooms: template.bedrooms,
      bathrooms: template.bathrooms,
      size_sqm: template.size + sequence * (template.size > 5000 ? 350 : 6),
      has_garage: index % 3 !== 0,
      has_garden: index % 4 !== 0,
      has_pool: index % 9 === 0,
    },
    machinery_details: null,
  };
}

function createCar(index) {
  const template = CAR_TEMPLATES[index % CAR_TEMPLATES.length];
  const location = LOCATIONS[(index * 7) % LOCATIONS.length];
  const sequence = Math.floor((index % 120) / CAR_TEMPLATES.length);
  const mileage = 28000 + ((index * 7913) % 185000);
  const condition = ['excellent', 'good', 'good', 'fair'][index % 4];
  return {
    ...commonFields(index, 'car', location),
    title: `${template.year - (sequence % 3)} ${template.brand} ${template.model}`,
    description: `Inspected preview vehicle with declared mileage, clear seller contact details and viewing available in ${location.name}. Service records can be requested before a test drive.`,
    price: Math.round(template.price * (0.9 + (sequence % 6) * 0.025)),
    photos: [localAsset('findit-tour-thumbnail.webp')],
    category: template.category,
    listing_type: 'sale',
    car_details: {
      brand: template.brand,
      model: template.model,
      year: template.year - (sequence % 3),
      mileage,
      fuel_type: template.fuel,
      transmission: template.transmission,
      condition,
      color: ['White', 'Silver', 'Black', 'Blue', 'Grey'][index % 5],
      full_service_history: index % 3 !== 0,
    },
    property_details: null,
    machinery_details: null,
  };
}

function createMachinery(index) {
  const template = MACHINERY_TEMPLATES[index % MACHINERY_TEMPLATES.length];
  const location = LOCATIONS[(index * 11 + 2) % LOCATIONS.length];
  const sequence = Math.floor((index % 120) / MACHINERY_TEMPLATES.length);
  return {
    ...commonFields(index, 'machinery', location),
    title: `${template.brand} ${template.model}`,
    description: `Working preview equipment with operating history supplied, recent service checks and an in-person inspection available in ${location.name}.`,
    price: Math.round(template.price * (0.86 + (sequence % 7) * 0.035)),
    photos: [localAsset('findit-machinery-preview.jpg')],
    category: template.category,
    listing_type: 'sale',
    car_details: null,
    property_details: null,
    machinery_details: {
      machinery_type: template.type,
      brand: template.brand,
      model: template.model,
      condition: ['excellent', 'good', 'good', 'fair'][index % 4],
      year: template.year - (sequence % 3),
      usage_hours: 620 + ((index * 173) % 7800),
    },
  };
}

const LISTINGS_PER_KIND = 120;
const LISTINGS = Object.freeze([
  ...Array.from({ length: LISTINGS_PER_KIND }, (_, index) => createCar(index)),
  ...Array.from({ length: LISTINGS_PER_KIND }, (_, offset) => createProperty(LISTINGS_PER_KIND + offset)),
  ...Array.from({ length: LISTINGS_PER_KIND }, (_, offset) => createMachinery((LISTINGS_PER_KIND * 2) + offset)),
]);

export const LOCAL_PREVIEW_LISTING_COUNT = LISTINGS.length;

export function localPreviewListingsEnabled() {
  return localPreviewModeEnabled();
}

export function localPreviewListingHasPeek(listing) {
  const suffix = Number(String(listing?.id || '').slice(-12));
  return Number.isInteger(suffix) && suffix > 0 && suffix % 6 === 1;
}

export function getLocalPreviewPeekListings() {
  return LISTINGS.filter(localPreviewListingHasPeek);
}

export function findLocalPreviewListing(kind, id) {
  return LISTINGS.find((listing) => listing.kind === kind && listing.id === id) ?? null;
}

export function filterLocalPreviewListings(request) {
  const query = request.query.toLowerCase();
  const rows = LISTINGS.filter((listing) => {
    const details = listing[`${listing.kind}_details`] || {};
    return listing.kind === request.kind
      && listing.price >= request.minPrice
      && listing.price <= request.maxPrice
      && (!query || `${listing.title} ${listing.description} ${listing.seller_name} ${listing.location.name}`.toLowerCase().includes(query))
      && (!request.category || listing.category === request.category)
      && (!request.locationId || listing.location.id === request.locationId)
      && (!request.minBedrooms || Number(details.bedrooms) >= request.minBedrooms)
      && (!request.brand || details.brand === request.brand)
      && (!request.condition || details.condition === request.condition)
      && (!request.fuelType || details.fuel_type === request.fuelType)
      && (!request.transmission || details.transmission === request.transmission);
  });
  return [...rows].sort((left, right) => {
    if (request.sort === 'price_asc') return left.price - right.price || left.id.localeCompare(right.id);
    if (request.sort === 'price_desc') return right.price - left.price || left.id.localeCompare(right.id);
    if (request.sort === 'most_viewed') return right.views - left.views || left.id.localeCompare(right.id);
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime() || left.id.localeCompare(right.id);
  });
}

function cursorValue(listing, sort) {
  if (sort === 'newest') return listing.created_at;
  if (sort === 'most_viewed') return String(listing.views);
  return String(listing.price);
}

export function paginateLocalPreviewListings(request) {
  const rows = filterLocalPreviewListings(request);
  const cursorIndex = request.cursor
    ? rows.findIndex((listing) => listing.id === request.cursor.id)
    : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const items = rows.slice(start, start + request.pageSize);
  const hasMore = start + items.length < rows.length;
  const last = hasMore ? items.at(-1) : null;
  return {
    items,
    nextCursor: last ? { id: last.id, value: cursorValue(last, request.sort) } : null,
  };
}

export function findLocalPreviewSuggestions(kind, query) {
  const needle = query.toLowerCase();
  return {
    listings: LISTINGS
      .filter((listing) => listing.kind === kind && listing.title.toLowerCase().includes(needle))
      .slice(0, 8)
      .map(({ id, title }) => ({ id, title })),
    locations: LOCATIONS
      .filter((location) => String(location.name).toLowerCase().includes(needle))
      .slice(0, 8)
      .map(({ id, name, type }) => ({ id, name, type })),
  };
}

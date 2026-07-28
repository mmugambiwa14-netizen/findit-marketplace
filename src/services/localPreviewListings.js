import { localPreviewModeEnabled } from '@/lib/localPreview';

const SELLER_ID = '10000000-0000-4000-8000-000000000001';

const LOCATIONS = Object.freeze({
  harare: { id: '00000000-0000-4000-8000-000000000101', name: 'Harare', type: 'city' },
  bulawayo: { id: '00000000-0000-4000-8000-000000000102', name: 'Bulawayo', type: 'city' },
  mutare: { id: '00000000-0000-4000-8000-000000000103', name: 'Mutare', type: 'city' },
});

const COMMON = Object.freeze({
  seller_id: SELLER_ID,
  seller_name: 'FindIt Preview Seller',
  contact_phone: '+263771234567',
  contact_whatsapp: '+263771234567',
  contact_email: 'preview-seller@findit.local',
  currency: 'USD',
  deposit: null,
  agent_fee: null,
  additional_fees: null,
  accepts_offers: true,
  variants: [],
  status: 'available',
  created_via: 'single',
  updated_at: '2026-07-28T00:00:00.000Z',
});

function localAsset(filename) {
  const basePath = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${basePath}mock/${filename}`;
}

const LISTINGS = Object.freeze([
  {
    ...COMMON,
    id: '20000000-0000-4000-8000-000000000001',
    kind: 'car',
    title: 'Toyota Hilux 2.8 GD-6 double cab',
    description: 'Clean local preview vehicle with service history, durable tyres, canopy, reverse camera and excellent long-distance condition.',
    price: 28500,
    photos: [localAsset('findit-tour-thumbnail.webp')],
    latitude: -17.825166,
    longitude: 31.03351,
    category: 'cars_sale',
    listing_type: 'sale',
    views: 37,
    created_at: '2026-07-28T00:00:00.000Z',
    location: LOCATIONS.harare,
    car_details: {
      brand: 'Toyota',
      model: 'Hilux',
      year: 2021,
      mileage: 64000,
      fuel_type: 'diesel',
      transmission: 'automatic',
      condition: 'excellent',
    },
    property_details: null,
    machinery_details: null,
  },
  {
    ...COMMON,
    id: '20000000-0000-4000-8000-000000000002',
    kind: 'property',
    title: 'Three bedroom family house in Hillside',
    description: 'Spacious local preview home with fitted kitchen, solar backup, borehole water, walled garden and secure parking.',
    price: 165000,
    photos: [localAsset('findit-property-preview.jpg')],
    latitude: -20.132507,
    longitude: 28.626479,
    category: 'house_sale',
    listing_type: 'sale',
    views: 22,
    created_at: '2026-07-27T00:00:00.000Z',
    location: LOCATIONS.bulawayo,
    car_details: null,
    property_details: {
      property_type: 'house',
      bedrooms: 3,
      bathrooms: 2,
      size_sqm: 420,
    },
    machinery_details: null,
  },
  {
    ...COMMON,
    id: '20000000-0000-4000-8000-000000000003',
    kind: 'machinery',
    title: 'Perkins diesel generator 45 kVA',
    description: 'Reliable standby generator for homes or small businesses, recently serviced and ready for inspection in Mutare.',
    price: 9500,
    photos: [localAsset('findit-machinery-preview.jpg')],
    latitude: -18.9707,
    longitude: 32.6709,
    category: 'generators',
    listing_type: 'sale',
    views: 14,
    created_at: '2026-07-26T00:00:00.000Z',
    location: LOCATIONS.mutare,
    car_details: null,
    property_details: null,
    machinery_details: {
      machinery_type: 'industrial',
      brand: 'Perkins',
      model: '45 kVA',
      condition: 'good',
      year: 2019,
      usage_hours: 1800,
    },
  },
]);

export function localPreviewListingsEnabled() {
  return localPreviewModeEnabled();
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
      && (!query || `${listing.title} ${listing.description}`.toLowerCase().includes(query))
      && (!request.category || listing.category === request.category)
      && (!request.locationId || listing.location.id === request.locationId)
      && (!request.minBedrooms || Number(details.bedrooms) >= request.minBedrooms)
      && (!request.brand || details.brand === request.brand)
      && (!request.condition || details.condition === request.condition)
      && (!request.fuelType || details.fuel_type === request.fuelType)
      && (!request.transmission || details.transmission === request.transmission);
  });
  return [...rows].sort((left, right) => {
    if (request.sort === 'price_asc') return left.price - right.price;
    if (request.sort === 'price_desc') return right.price - left.price;
    if (request.sort === 'most_viewed') return right.views - left.views;
    return new Date(right.created_at) - new Date(left.created_at);
  });
}

export function findLocalPreviewSuggestions(kind, query) {
  const needle = query.toLowerCase();
  return {
    listings: LISTINGS
      .filter((listing) => listing.kind === kind && listing.title.toLowerCase().includes(needle))
      .map(({ id, title }) => ({ id, title })),
    locations: Object.values(LOCATIONS)
      .filter((location) => location.name.toLowerCase().includes(needle)),
  };
}

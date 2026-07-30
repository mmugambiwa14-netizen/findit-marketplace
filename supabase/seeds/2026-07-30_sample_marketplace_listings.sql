-- FindIt staging sample catalogue.
-- Idempotent by deterministic UUID and safe to rerun.
-- This file is data-only and must not be promoted to production without an explicit release decision.

begin;

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  deposit, accepts_offers, variants, photos, location_id, latitude, longitude,
  category, listing_type, status, created_via, verified, views,
  country_code, public_latitude, public_longitude, public_location_label,
  location_visibility, created_at, updated_at
)
values
(
  'f1000000-0000-4000-8000-000000000001', 'property',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt Property Partners',
  'Modern Four-Bedroom Family Home',
  'Move-in-ready four-bedroom home in Borrowdale West with three bathrooms, an en-suite main bedroom, fitted kitchen, open-plan living and dining areas, double lock-up garage, borehole, 5,000-litre water tank, solar backup, landscaped garden and secure perimeter. The approximately 1,100 m² stand has title deeds available. Viewing is by appointment.',
  285000, 'USD', null, true, '[]'::jsonb,
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/modern-home.svg'),
  '00000000-0000-4000-8000-000000000101', -17.7808, 31.0913,
  'house_sale', 'sale', 'available', 'developer', true, 184,
  'ZW', -17.7808, 31.0913, 'Borrowdale West, Harare', 'city_only',
  now() - interval '8 minutes', now()
),
(
  'f1000000-0000-4000-8000-000000000002', 'property',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt Rentals',
  'Furnished Two-Bedroom City Apartment',
  'Bright, fully furnished two-bedroom apartment in Avondale with two bathrooms, a modern fitted kitchen, open-plan living and dining space, large windows, secure parking, backup electricity, borehole water, controlled access and fibre internet availability. Suitable for professionals, couples or a corporate tenant. Minimum twelve-month lease; utilities are excluded.',
  1200, 'USD', 1200, false, '[]'::jsonb,
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/city-apartment.svg'),
  '00000000-0000-4000-8000-000000000101', -17.7984, 31.0395,
  'apartment_rent', 'rent', 'available', 'developer', true, 129,
  'ZW', -17.7984, 31.0395, 'Avondale, Harare', 'city_only',
  now() - interval '7 minutes', now()
),
(
  'f1000000-0000-4000-8000-000000000003', 'car',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt Motors',
  '2021 Premium Seven-Seater SUV',
  'Clean and well-maintained seven-seater SUV with automatic transmission, petrol engine, leather interior, reverse camera, parking sensors, push-button start, climate control, alloy wheels and roof rails. Recently serviced and suitable for family, executive or long-distance use. Registration documents are available and an independent inspection is welcome.',
  42500, 'USD', null, true, '[]'::jsonb,
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/blue-suv.svg'),
  '00000000-0000-4000-8000-000000000101', -17.8309, 31.0752,
  'cars_sale', 'sale', 'available', 'developer', true, 241,
  'ZW', -17.8309, 31.0752, 'Eastlea, Harare', 'city_only',
  now() - interval '6 minutes', now()
),
(
  'f1000000-0000-4000-8000-000000000004', 'car',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt Auto Exchange',
  '2007 Silver Automatic Sedan',
  'Reliable and economical automatic sedan suitable for commuting or first-time ownership. It has a petrol engine, working air conditioning, power windows, central locking, alloy wheels, clean fabric interior and recently replaced tyres. The engine and transmission run well; minor age-related marks do not affect operation. Registration documents are available.',
  7800, 'USD', null, true, '[]'::jsonb,
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/silver-sedan.svg'),
  '00000000-0000-4000-8000-000000000102', -20.1609, 28.6075,
  'cars_sale', 'sale', 'available', 'developer', true, 97,
  'ZW', -20.1609, 28.6075, 'Hillside, Bulawayo', 'city_only',
  now() - interval '5 minutes', now()
),
(
  'f1000000-0000-4000-8000-000000000005', 'machinery',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt Heavy Equipment',
  'Heavy-Duty Bulldozer',
  'Heavy-duty tracked bulldozer for construction, mining, road development, land clearing and large-scale earthmoving. Features include an enclosed air-conditioned cabin, wide front blade, responsive hydraulic controls, work lights and a robust tracked undercarriage. The machine has recently received routine service and is available for operational inspection. Nationwide transport can be arranged separately.',
  96000, 'USD', null, true, '[]'::jsonb,
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/bulldozer.svg'),
  '00000000-0000-4000-8000-000000000101', -17.8737, 31.1200,
  'construction', 'sale', 'available', 'developer', true, 76,
  'ZW', -17.8737, 31.1200, 'Msasa Industrial Area, Harare', 'city_only',
  now() - interval '4 minutes', now()
),
(
  'f1000000-0000-4000-8000-000000000006', 'machinery',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt Heavy Equipment',
  '35-Tonne Tracked Excavator',
  'Powerful 35-tonne tracked excavator suited to quarrying, mining, demolition, trenching and major construction work. It has a heavy-duty bucket, strong hydraulic system, enclosed air-conditioned cabin, work lights, reverse camera and well-maintained undercarriage. Service history is available. The machine can be inspected under load and nationwide transport can be arranged.',
  135000, 'USD', null, true, '[]'::jsonb,
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/excavator.svg'),
  '00000000-0000-4000-8000-000000000101', -17.8648, 31.0093,
  'construction', 'sale', 'available', 'developer', true, 113,
  'ZW', -17.8648, 31.0093, 'Workington, Harare', 'city_only',
  now() - interval '3 minutes', now()
)
on conflict (id) do update set
  kind = excluded.kind,
  seller_id = excluded.seller_id,
  seller_name = excluded.seller_name,
  title = excluded.title,
  description = excluded.description,
  price = excluded.price,
  currency = excluded.currency,
  deposit = excluded.deposit,
  accepts_offers = excluded.accepts_offers,
  variants = excluded.variants,
  photos = excluded.photos,
  location_id = excluded.location_id,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  category = excluded.category,
  listing_type = excluded.listing_type,
  status = excluded.status,
  created_via = excluded.created_via,
  verified = excluded.verified,
  views = excluded.views,
  country_code = excluded.country_code,
  public_latitude = excluded.public_latitude,
  public_longitude = excluded.public_longitude,
  public_location_label = excluded.public_location_label,
  location_visibility = excluded.location_visibility,
  updated_at = now();

insert into public.property_details (listing_id, property_type, bedrooms, bathrooms, size_sqm)
values
  ('f1000000-0000-4000-8000-000000000001', 'house', 4, 3, 320),
  ('f1000000-0000-4000-8000-000000000002', 'apartment', 2, 2, 120)
on conflict (listing_id) do update set
  property_type = excluded.property_type,
  bedrooms = excluded.bedrooms,
  bathrooms = excluded.bathrooms,
  size_sqm = excluded.size_sqm;

insert into public.car_details (listing_id, brand, model, year, mileage, fuel_type, transmission, condition)
values
  ('f1000000-0000-4000-8000-000000000003', 'Atlas', 'X7 Seven-Seater', 2021, 68000, 'petrol', 'automatic', 'excellent'),
  ('f1000000-0000-4000-8000-000000000004', 'Cityline', '1.8 Sedan', 2007, 156000, 'petrol', 'automatic', 'good')
on conflict (listing_id) do update set
  brand = excluded.brand,
  model = excluded.model,
  year = excluded.year,
  mileage = excluded.mileage,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  condition = excluded.condition;

insert into public.machinery_details (listing_id, machinery_type, brand, model, condition, year, usage_hours)
values
  ('f1000000-0000-4000-8000-000000000005', 'construction', 'Industrial', 'D65-Class Bulldozer', 'good', 2017, 6400),
  ('f1000000-0000-4000-8000-000000000006', 'construction', 'Industrial', '35-Tonne Excavator', 'excellent', 2019, 5850)
on conflict (listing_id) do update set
  machinery_type = excluded.machinery_type,
  brand = excluded.brand,
  model = excluded.model,
  condition = excluded.condition,
  year = excluded.year,
  usage_hours = excluded.usage_hours;

insert into public.services (
  id, provider_id, provider_name, title, description, category, subcategory,
  subcategories, price, currency, pricing_type, photos, location_id,
  location_name, can_travel, status, verified, views, country_code,
  base_location_id, delivery_mode, service_radius_km, remote_available,
  fixed_premises, location_visibility, created_at, updated_at
)
values
(
  'f2000000-0000-4000-8000-000000000001',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt AutoCare',
  'Mobile Vehicle Diagnostics and Repairs',
  'Professional mobile and workshop-based diagnostics for cars, SUVs and light commercial vehicles. Services include computer fault-code scanning, engine assessment, battery and charging-system tests, minor roadside repairs, oil and filter changes, brake inspections and pre-purchase checks. Customers receive a clear diagnosis and quotation before major repair work begins.',
  'mechanic', 'Mobile diagnostics',
  '["Computer diagnostics","Engine fault assessment","Battery testing","Minor roadside repairs","Oil and filter changes","Pre-purchase inspections"]'::jsonb,
  25, 'USD', 'starting_from',
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/mechanic-service.svg'),
  '00000000-0000-4000-8000-000000000101', 'Harare', true,
  'active', true, 88, 'ZW', '00000000-0000-4000-8000-000000000101',
  'fixed_and_mobile', 45, false, true, 'city_only', now() - interval '2 minutes', now()
),
(
  'f2000000-0000-4000-8000-000000000002',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt PropertyCare',
  'Residential Property Maintenance Team',
  'Professional residential maintenance for homeowners, landlords and property managers across Harare, Ruwa and Chitungwiza. Work includes general repairs, plumbing, electrical fault checks, painting and touch-ups, door and lock repairs, ceiling and roofing inspections, gutter cleaning, furniture assembly and scheduled rental-property maintenance. Written quotations are provided before work begins.',
  'construction', 'Residential maintenance',
  '["General home repairs","Plumbing repairs","Electrical fault checks","Painting and touch-ups","Gutter cleaning","Rental property maintenance"]'::jsonb,
  30, 'USD', 'starting_from',
  jsonb_build_array('https://mmugambiwa14-netizen.github.io/findit-marketplace/demo/listings/property-maintenance.svg'),
  '00000000-0000-4000-8000-000000000101', 'Harare', true,
  'active', true, 64, 'ZW', '00000000-0000-4000-8000-000000000101',
  'travels_to_customer', 60, false, false, 'city_only', now() - interval '1 minute', now()
)
on conflict (id) do update set
  provider_id = excluded.provider_id,
  provider_name = excluded.provider_name,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  subcategory = excluded.subcategory,
  subcategories = excluded.subcategories,
  price = excluded.price,
  currency = excluded.currency,
  pricing_type = excluded.pricing_type,
  photos = excluded.photos,
  location_id = excluded.location_id,
  location_name = excluded.location_name,
  can_travel = excluded.can_travel,
  status = excluded.status,
  verified = excluded.verified,
  views = excluded.views,
  country_code = excluded.country_code,
  base_location_id = excluded.base_location_id,
  delivery_mode = excluded.delivery_mode,
  service_radius_km = excluded.service_radius_km,
  remote_available = excluded.remote_available,
  fixed_premises = excluded.fixed_premises,
  location_visibility = excluded.location_visibility,
  updated_at = now();

commit;

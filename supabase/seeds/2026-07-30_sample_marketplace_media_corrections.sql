-- Applied after the base sample catalogue by lexical seed order.
-- Keeps staging demonstrations truthful, recommendation-compatible and
-- independent from GitHub Pages assets.

begin;

update public.listings
set photos = case id
  when 'f1000000-0000-4000-8000-000000000001'::uuid then jsonb_build_array('https://images.pexels.com/photos/7587882/pexels-photo-7587882.jpeg?auto=compress&cs=tinysrgb&w=1600')
  when 'f1000000-0000-4000-8000-000000000002'::uuid then jsonb_build_array('https://images.pexels.com/photos/7534270/pexels-photo-7534270.jpeg?auto=compress&cs=tinysrgb&w=1600')
  when 'f1000000-0000-4000-8000-000000000003'::uuid then jsonb_build_array('https://images.pexels.com/photos/8868416/pexels-photo-8868416.jpeg?auto=compress&cs=tinysrgb&w=1600')
  when 'f1000000-0000-4000-8000-000000000004'::uuid then jsonb_build_array('https://images.pexels.com/photos/4753032/pexels-photo-4753032.jpeg?auto=compress&cs=tinysrgb&w=1600')
  when 'f1000000-0000-4000-8000-000000000005'::uuid then jsonb_build_array('https://images.pexels.com/photos/11973729/pexels-photo-11973729.jpeg?auto=compress&cs=tinysrgb&w=1600')
  when 'f1000000-0000-4000-8000-000000000006'::uuid then jsonb_build_array('https://images.pexels.com/photos/7910068/pexels-photo-7910068.jpeg?auto=compress&cs=tinysrgb&w=1600')
  else photos
end,
status = 'available',
contact_phone = '+263 77 000 0000',
contact_whatsapp = '+263 77 000 0000',
contact_email = 'demo-seller@findit.invalid',
views = 0,
updated_at = now()
where id::text like 'f1000000-%';

update public.services
set
  photos = jsonb_build_array('https://images.pexels.com/photos/3441895/pexels-photo-3441895.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  subcategory = 'maintenance_repair',
  subcategories = '["maintenance_repair","pre_purchase_inspection","roadside_assistance"]'::jsonb,
  contact_phone = '+263 77 000 0000',
  contact_whatsapp = '+263 77 000 0000',
  contact_email = 'demo-provider@findit.invalid',
  views = 0,
  status = 'active',
  updated_at = now()
where id = 'f2000000-0000-4000-8000-000000000001'::uuid;

update public.services
set
  photos = jsonb_build_array('https://images.pexels.com/photos/8853474/pexels-photo-8853474.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  subcategory = 'general_contracting',
  subcategories = '["general_contracting","plumbing","electrical_installation","painting_finishing","roofing"]'::jsonb,
  contact_phone = '+263 77 000 0000',
  contact_whatsapp = '+263 77 000 0000',
  contact_email = 'demo-provider@findit.invalid',
  views = 0,
  status = 'active',
  updated_at = now()
where id = 'f2000000-0000-4000-8000-000000000002'::uuid;

insert into public.services (
  id, provider_id, provider_name, title, description, category, subcategory,
  subcategories, price, currency, pricing_type, photos, location_id,
  location_name, can_travel, status, verified, views, country_code,
  base_location_id, delivery_mode, service_radius_km, remote_available,
  fixed_premises, location_visibility, contact_phone, contact_whatsapp,
  contact_email, created_at, updated_at
)
values (
  'f2000000-0000-4000-8000-000000000003',
  '97965916-11ee-4d94-894d-fe66f58a11ab', 'FindIt Equipment Support',
  'Heavy Equipment Field Repair and Transport',
  'Mobile diagnostics, maintenance and transport coordination for excavators, bulldozers, loaders and other heavy equipment. Site visits and inspection quotations are available across Harare and nearby industrial areas.',
  'construction', 'machinery_repair',
  '["machinery_repair","machinery_transport","operator_hire"]'::jsonb,
  80, 'USD', 'starting_from',
  jsonb_build_array('https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  '00000000-0000-4000-8000-000000000101', 'Harare', true,
  'active', true, 0, 'ZW', '00000000-0000-4000-8000-000000000101',
  'travels_to_customer', 100, false, false, 'city_only',
  '+263 77 000 0000', '+263 77 000 0000', 'demo-equipment@findit.invalid',
  now(), now()
)
on conflict (id) do update set
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
  country_code = excluded.country_code,
  base_location_id = excluded.base_location_id,
  delivery_mode = excluded.delivery_mode,
  service_radius_km = excluded.service_radius_km,
  contact_phone = excluded.contact_phone,
  contact_whatsapp = excluded.contact_whatsapp,
  contact_email = excluded.contact_email,
  updated_at = now();

commit;

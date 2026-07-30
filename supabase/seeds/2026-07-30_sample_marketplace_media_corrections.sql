-- Applied after the base sample catalogue by lexical seed order.
-- Keeps staging demonstrations truthful and independent from GitHub Pages assets.

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
contact_phone = '+263 77 000 0000',
contact_whatsapp = '+263 77 000 0000',
contact_email = 'demo-seller@findit.invalid',
views = 0,
updated_at = now()
where id::text like 'f1000000-%';

update public.services
set photos = case id
  when 'f2000000-0000-4000-8000-000000000001'::uuid then jsonb_build_array('https://images.pexels.com/photos/3441895/pexels-photo-3441895.jpeg?auto=compress&cs=tinysrgb&w=1600')
  when 'f2000000-0000-4000-8000-000000000002'::uuid then jsonb_build_array('https://images.pexels.com/photos/8853474/pexels-photo-8853474.jpeg?auto=compress&cs=tinysrgb&w=1600')
  else photos
end,
contact_phone = '+263 77 000 0000',
contact_whatsapp = '+263 77 000 0000',
contact_email = 'demo-provider@findit.invalid',
views = 0,
updated_at = now()
where id::text like 'f2000000-%';

commit;

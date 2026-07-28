-- 0016_v1_admin_operations.sql
-- Replaces the active V1 admin dashboard, marketplace moderation, user
-- controls, reports, category vocabulary and audit-log Base44 functions.
-- All writes are narrow SECURITY DEFINER operations that re-check the caller.

alter table public.audit_logs
  add column reason text,
  add column result text not null default 'success',
  add column correlation_id uuid not null default gen_random_uuid();

create index idx_audit_logs_correlation on public.audit_logs(correlation_id);

create table public.categories (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null check (slug ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  parent_id         uuid references public.categories(id) on delete restrict,
  marketplace_kind text not null check (marketplace_kind in ('property', 'car', 'machinery', 'service')),
  display_label     text not null check (length(trim(display_label)) between 2 and 80),
  description       text,
  sort_order        integer not null default 0 check (sort_order between 0 and 10000),
  is_active         boolean not null default true,
  is_protected      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique nulls not distinct (parent_id, slug)
);

create index idx_categories_parent_order
  on public.categories(parent_id, sort_order, display_label);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create or replace function public.protect_category_identity()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'categories are deactivated, not deleted'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.slug is distinct from old.slug
    or new.parent_id is distinct from old.parent_id
    or new.marketplace_kind is distinct from old.marketplace_kind
    or new.is_protected is distinct from old.is_protected
    or new.created_at is distinct from old.created_at
  then
    raise exception 'category identity fields are immutable'
      using errcode = '42501';
  end if;

  if old.is_protected and not new.is_active then
    raise exception 'protected top-level categories cannot be deactivated'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_categories_protect_identity
  before update or delete on public.categories
  for each row execute function public.protect_category_identity();

insert into public.categories (
  slug, marketplace_kind, display_label, sort_order, is_protected
)
values
  ('property', 'property', 'Property', 10, true),
  ('vehicles', 'car', 'Vehicles', 20, true),
  ('machinery', 'machinery', 'Machinery', 30, true),
  ('services', 'service', 'Services', 40, true);

with seed(slug, display_label, parent_slug, sort_order) as (
  values
    ('house_sale', 'House for Sale', 'property', 1),
    ('house_rent', 'House for Rent', 'property', 2),
    ('apartment_sale', 'Apartment for Sale', 'property', 3),
    ('apartment_rent', 'Apartment for Rent', 'property', 4),
    ('townhouse', 'Townhouse', 'property', 5),
    ('duplex', 'Duplex', 'property', 6),
    ('cottage', 'Cottage', 'property', 7),
    ('cluster', 'Cluster Home', 'property', 8),
    ('bachelor', 'Bachelor Flat', 'property', 9),
    ('penthouse', 'Penthouse', 'property', 10),
    ('studio_apartment', 'Studio Apartment', 'property', 11),
    ('granny_flat', 'Granny Flat', 'property', 12),
    ('retirement_home', 'Retirement Home', 'property', 13),
    ('assisted_living', 'Assisted Living Facility', 'property', 14),
    ('game_lodge_residence', 'Game Lodge Residence', 'property', 15),
    ('embassy_residence', 'Embassy / Diplomatic Housing', 'property', 16),
    ('bnb', 'B&B', 'property', 17),
    ('timeshare', 'Timeshare', 'property', 18),
    ('resort', 'Resort', 'property', 19),
    ('lodge', 'Lodge', 'property', 20),
    ('serviced_apartment', 'Serviced Apartment', 'property', 21),
    ('chalet', 'Chalet', 'property', 22),
    ('safari_camp', 'Safari Camp', 'property', 23),
    ('guest_farm', 'Guest Farm', 'property', 24),
    ('glamping_site', 'Glamping Site', 'property', 25),
    ('treehouse', 'Treehouse', 'property', 26),
    ('houseboat', 'Houseboat', 'property', 27),
    ('bush_camp', 'Bush Camp', 'property', 28),
    ('safari_tent', 'Safari Tent', 'property', 29),
    ('backpackers_hostel', 'Backpackers Hostel', 'property', 30),
    ('guesthouse', 'Guesthouse', 'property', 31),
    ('student_room', 'Student Room', 'property', 32),
    ('hostel', 'Hostel', 'property', 33),
    ('student_apartment', 'Student Apartment', 'property', 34),
    ('student_studio', 'Student Studio', 'property', 35),
    ('postgrad_accommodation', 'Postgraduate Accommodation', 'property', 36),
    ('shared_house', 'Shared Student House', 'property', 37),
    ('commuter_room', 'Commuter Room', 'property', 38),
    ('office', 'Office Space', 'property', 39),
    ('retail', 'Retail Space', 'property', 40),
    ('warehouse', 'Warehouse', 'property', 41),
    ('storage', 'Storage Unit', 'property', 42),
    ('parking', 'Parking Space', 'property', 43),
    ('factory', 'Factory', 'property', 44),
    ('workshop', 'Workshop', 'property', 45),
    ('showroom', 'Showroom', 'property', 46),
    ('restaurant_space', 'Restaurant Space', 'property', 47),
    ('coworking_space', 'Co-working Space', 'property', 48),
    ('data_centre', 'Data Centre', 'property', 49),
    ('petrol_station', 'Petrol Station', 'property', 50),
    ('car_wash_facility', 'Car Wash Facility', 'property', 51),
    ('medical_rooms', 'Medical Consulting Rooms', 'property', 52),
    ('dental_practice', 'Dental Practice', 'property', 53),
    ('veterinary_clinic', 'Veterinary Clinic', 'property', 54),
    ('salon_spa', 'Salon and Spa Space', 'property', 55),
    ('gym_studio', 'Gym and Fitness Studio', 'property', 56),
    ('takeaway_space', 'Takeaway Space', 'property', 57),
    ('hotel', 'Hotel', 'property', 58),
    ('motel', 'Motel', 'property', 59),
    ('guest_house_business', 'Guest House Business', 'property', 60),
    ('school_building', 'School Building', 'property', 61),
    ('childcare_facility', 'Childcare Facility', 'property', 62),
    ('place_of_worship', 'Place of Worship', 'property', 63),
    ('embassy_consulate_space', 'Embassy / Consulate Space', 'property', 64),
    ('land_sale', 'Land for Sale', 'property', 65),
    ('farm', 'Farm', 'property', 66),
    ('agricultural', 'Agricultural Land', 'property', 67),
    ('game_farm', 'Game Farm', 'property', 68),
    ('smallholding', 'Smallholding', 'property', 69),
    ('commercial_plot', 'Commercial Plot', 'property', 70),
    ('residential_stand', 'Residential Stand', 'property', 71),
    ('mining_claims', 'Mining Claims', 'property', 72),
    ('surveyed_stands', 'Surveyed Stands', 'property', 73),
    ('irrigation_land', 'Irrigation Scheme Land', 'property', 74),
    ('communal_land', 'Communal Land', 'property', 75),
    ('resettlement_farm', 'Resettlement Farm', 'property', 76),
    ('a2_farm', 'A2 Farm', 'property', 77),
    ('a1_farm', 'A1 Farm', 'property', 78),
    ('old_commercial_farm', 'Old Commercial Farm', 'property', 79),
    ('venue', 'Event Venue', 'property', 80),
    ('conference', 'Conference Centre', 'property', 81),
    ('wedding_venue', 'Wedding Venue', 'property', 82),
    ('party_venue', 'Party Venue', 'property', 83),
    ('outdoor_venue', 'Outdoor Venue', 'property', 84),
    ('sports_facility', 'Sports Facility', 'property', 85),
    ('stadium', 'Stadium', 'property', 86),
    ('exhibition_space', 'Exhibition Space', 'property', 87),
    ('filming_location', 'Filming Location', 'property', 88),
    ('drive_in_space', 'Drive-in Space', 'property', 89),
    ('property_other', 'Other Property', 'property', 90),
    ('cars_sale', 'Cars for Sale', 'vehicles', 1),
    ('cars_rent', 'Cars for Rent', 'vehicles', 2),
    ('minibus_kombi', 'Minibuses & Kombis', 'vehicles', 3),
    ('motorbike', 'Motorbikes', 'vehicles', 4),
    ('scooter', 'Scooters & Mopeds', 'vehicles', 5),
    ('bicycle', 'Bicycles', 'vehicles', 6),
    ('caravan_trailer', 'Caravans & Trailers', 'vehicles', 7),
    ('utility', 'Utility / Bakkies', 'vehicles', 8),
    ('van', 'Vans & Panel Vans', 'vehicles', 9),
    ('luxury_classic', 'Luxury & Classic', 'vehicles', 10),
    ('spare_parts', 'Spare Parts & Accessories', 'vehicles', 11),
    ('tyres_rims', 'Tyres & Rims', 'vehicles', 12),
    ('truck_lorry', 'Trucks & Lorries', 'vehicles', 13),
    ('bus_coach', 'Buses & Coaches', 'vehicles', 14),
    ('car_other', 'Other Vehicle', 'vehicles', 15),
    ('heavy_vehicles', 'Heavy Vehicles', 'machinery', 1),
    ('construction', 'Construction Equipment', 'machinery', 2),
    ('agricultural', 'Agricultural Machinery', 'machinery', 3),
    ('mining', 'Mining Equipment', 'machinery', 4),
    ('material_handling', 'Material Handling', 'machinery', 5),
    ('generators', 'Generators', 'machinery', 6),
    ('compaction', 'Compaction Equipment', 'machinery', 7),
    ('lifting', 'Lifting Equipment', 'machinery', 8),
    ('surface_prep', 'Surface Preparation', 'machinery', 9),
    ('welding', 'Welding & Fabrication', 'machinery', 10),
    ('boats', 'Boats & Marine', 'machinery', 11),
    ('machinery_other', 'Other Machinery', 'machinery', 12),
    ('property_developer', 'Property Developer', 'services', 1),
    ('mechanic', 'Mechanic', 'services', 2),
    ('construction', 'Construction', 'services', 3),
    ('geological', 'Geological & Surveying', 'services', 4)
)
insert into public.categories (
  slug, display_label, parent_id, marketplace_kind, sort_order
)
select
  seed.slug,
  seed.display_label,
  parent.id,
  parent.marketplace_kind,
  seed.sort_order
from seed
join public.categories parent
  on parent.parent_id is null and parent.slug = seed.parent_slug;

alter table public.categories enable row level security;

create policy "categories_public_read" on public.categories
  for select using (is_active or public.is_admin());

revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;

create or replace function public.require_admin_reason(p_reason text)
returns text as $$
declare
  normalized text := trim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if length(normalized) < 3 or length(normalized) > 1000 then
    raise exception 'an admin reason between 3 and 1000 characters is required'
      using errcode = '22023';
  end if;
  return normalized;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke all on function public.require_admin_reason(text) from public;

create or replace function public.record_admin_action(
  p_action text,
  p_target_id text,
  p_target_type text,
  p_reason text,
  p_before jsonb,
  p_after jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid as $$
declare
  audit_id uuid;
begin
  insert into public.audit_logs (
    admin_user_id,
    action_performed,
    target_record_id,
    target_record_type,
    reason,
    result,
    correlation_id,
    before_values,
    after_values
  ) values (
    auth.uid(),
    left(trim(p_action), 200),
    p_target_id,
    p_target_type,
    p_reason,
    'success',
    p_correlation_id,
    p_before,
    p_after
  ) returning id into audit_id;
  return audit_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.record_admin_action(text, text, text, text, jsonb, jsonb, uuid) from public;

create or replace function public.admin_dashboard_stats()
returns jsonb as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'active_listings', (select count(*) from public.listings where status in ('available', 'under_offer', 'rented')),
    'active_services', (select count(*) from public.services where status = 'active' and category <> 'legal'),
    'total_users', (select count(*) from public.users),
    'pending_reports', (select count(*) from public.reports where status = 'pending'),
    'new_users_today', (select count(*) from public.users where created_at >= current_date),
    'new_marketplace_today', (
      (select count(*) from public.listings where created_at >= current_date)
      + (select count(*) from public.services where created_at >= current_date and category <> 'legal')
    )
  );
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_marketplace_rows(
  p_query text default '',
  p_kind text default 'all',
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  item_id uuid,
  item_kind text,
  title text,
  price numeric,
  currency text,
  status text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  category text,
  created_at timestamptz,
  report_count bigint,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_kind not in ('all', 'property', 'car', 'machinery', 'service') then
    raise exception 'invalid marketplace kind' using errcode = '22023';
  end if;

  return query
  with marketplace as (
    select
      l.id as item_id,
      l.kind::text as item_kind,
      l.title,
      l.price,
      l.currency,
      l.status::text as status,
      l.seller_id as owner_id,
      coalesce(l.seller_name, u.full_name) as owner_name,
      u.email as owner_email,
      l.category,
      l.created_at,
      (select count(*) from public.reports r where r.listing_id = l.id) as report_count
    from public.listings l
    join public.users u on u.id = l.seller_id
    union all
    select
      s.id,
      'service',
      s.title,
      s.price,
      s.currency,
      s.status::text,
      s.provider_id,
      coalesce(s.provider_name, u.full_name),
      u.email,
      s.category::text,
      s.created_at,
      0::bigint
    from public.services s
    join public.users u on u.id = s.provider_id
    where s.category <> 'legal'
  ), filtered as (
    select marketplace.*
    from marketplace
    where (p_kind = 'all' or marketplace.item_kind = p_kind)
      and (p_status = 'all' or marketplace.status = p_status)
      and (
        trim(coalesce(p_query, '')) = ''
        or marketplace.title ilike '%' || trim(p_query) || '%'
        or marketplace.owner_name ilike '%' || trim(p_query) || '%'
        or marketplace.owner_email ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.item_id,
    filtered.item_kind,
    filtered.title,
    filtered.price,
    filtered.currency,
    filtered.status,
    filtered.owner_id,
    filtered.owner_name,
    filtered.owner_email,
    filtered.category,
    filtered.created_at,
    filtered.report_count,
    count(*) over() as total_count
  from filtered
  order by filtered.created_at desc, filtered.item_id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_moderate_marketplace_item(
  p_item_id uuid,
  p_kind text,
  p_action text,
  p_reason text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row jsonb;
  after_row jsonb;
  correlation uuid := gen_random_uuid();
begin
  if p_kind not in ('property', 'car', 'machinery', 'service')
    or p_action not in ('publish', 'pause', 'remove')
  then
    raise exception 'invalid moderation operation' using errcode = '22023';
  end if;

  if p_kind = 'service' then
    select to_jsonb(s) into before_row
    from public.services s
    where s.id = p_item_id and s.category <> 'legal'
    for update;
    if before_row is null then
      raise exception 'marketplace item not found' using errcode = 'P0002';
    end if;

    if p_action = 'remove' then
      delete from public.services where id = p_item_id;
      after_row := jsonb_build_object('removed', true);
    else
      update public.services
      set status = case when p_action = 'publish' then 'active'::service_status else 'paused'::service_status end
      where id = p_item_id
      returning to_jsonb(public.services.*) into after_row;
    end if;
  else
    select to_jsonb(l) into before_row
    from public.listings l
    where l.id = p_item_id and l.kind::text = p_kind
    for update;
    if before_row is null then
      raise exception 'marketplace item not found' using errcode = 'P0002';
    end if;

    if p_action = 'remove' then
      update public.reports
      set status = 'actioned', admin_notes = normalized_reason,
          reviewed_by = auth.uid(), reviewed_at = now()
      where listing_id = p_item_id and status in ('pending', 'reviewed');
      update public.reports set listing_id = null where listing_id = p_item_id;
      delete from public.listings where id = p_item_id;
      after_row := jsonb_build_object('removed', true);
    else
      update public.listings
      set status = case when p_action = 'publish' then 'available'::listing_status else 'draft'::listing_status end
      where id = p_item_id
      returning to_jsonb(public.listings.*) into after_row;
    end if;
  end if;

  perform public.record_admin_action(
    'marketplace.' || p_action,
    p_item_id::text,
    p_kind,
    normalized_reason,
    before_row,
    after_row,
    correlation
  );
  return after_row || jsonb_build_object('correlation_id', correlation);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_user_rows(
  p_query text default '',
  p_role text default 'all',
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  phone_verified boolean,
  role text,
  status text,
  super_admin boolean,
  ban_reason text,
  ban_until timestamptz,
  created_at timestamptz,
  listing_count bigint,
  service_count bigint,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_role not in ('all', 'user', 'admin')
    or p_status not in ('all', 'active', 'suspended', 'banned')
  then
    raise exception 'invalid user filter' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      u.*,
      (select count(*) from public.listings l where l.seller_id = u.id) as listing_count,
      (select count(*) from public.services s where s.provider_id = u.id and s.category <> 'legal') as service_count
    from public.users u
    where (p_role = 'all' or u.role = p_role)
      and (p_status = 'all' or u.status::text = p_status)
      and (
        trim(coalesce(p_query, '')) = ''
        or u.email ilike '%' || trim(p_query) || '%'
        or u.full_name ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.id,
    filtered.email,
    filtered.full_name,
    filtered.phone,
    filtered.phone_verified,
    filtered.role,
    filtered.status::text,
    filtered.super_admin,
    filtered.ban_reason,
    filtered.ban_until,
    filtered.created_at,
    filtered.listing_count,
    filtered.service_count,
    count(*) over()
  from filtered
  order by filtered.created_at desc, filtered.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text,
  p_reason text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row jsonb;
  after_row jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'super-admin access required' using errcode = '42501';
  end if;
  if p_role not in ('user', 'admin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'self role changes are not allowed' using errcode = '42501';
  end if;

  select to_jsonb(u) into before_row from public.users u where u.id = p_user_id for update;
  if before_row is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if coalesce((before_row ->> 'super_admin')::boolean, false) then
    raise exception 'super-admin roles cannot be changed here' using errcode = '42501';
  end if;

  update public.users set role = p_role where id = p_user_id
  returning to_jsonb(public.users.*) into after_row;
  perform public.record_admin_action(
    'user.role_changed', p_user_id::text, 'user', normalized_reason,
    before_row - array['phone_otp_code', 'phone_otp_pending'],
    after_row - array['phone_otp_code', 'phone_otp_pending']
  );
  return after_row - array['phone_otp_code', 'phone_otp_pending'];
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status user_status,
  p_reason text,
  p_ban_until timestamptz default null
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row jsonb;
  after_row jsonb;
begin
  if p_user_id = auth.uid() then
    raise exception 'self status changes are not allowed' using errcode = '42501';
  end if;

  select to_jsonb(u) into before_row from public.users u where u.id = p_user_id for update;
  if before_row is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if coalesce((before_row ->> 'super_admin')::boolean, false) and not public.is_super_admin() then
    raise exception 'only a super admin can change this account' using errcode = '42501';
  end if;
  if p_status = 'banned' and p_ban_until is not null and p_ban_until <= now() then
    raise exception 'ban expiry must be in the future' using errcode = '22023';
  end if;

  update public.users
  set status = p_status,
      ban_reason = case when p_status = 'active' then null else normalized_reason end,
      ban_until = case when p_status = 'banned' then p_ban_until else null end
  where id = p_user_id
  returning to_jsonb(public.users.*) into after_row;

  insert into public.app_alerts (user_id, title, message, type)
  values (
    p_user_id,
    case p_status
      when 'active' then 'Account restored'
      when 'suspended' then 'Account suspended'
      else 'Account banned'
    end,
    normalized_reason,
    'system'
  );

  perform public.record_admin_action(
    'user.status_changed', p_user_id::text, 'user', normalized_reason,
    before_row - array['phone_otp_code', 'phone_otp_pending'],
    after_row - array['phone_otp_code', 'phone_otp_pending']
  );
  return after_row - array['phone_otp_code', 'phone_otp_pending'];
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_report_rows(
  p_query text default '',
  p_status text default 'pending',
  p_kind text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  report_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  reason text,
  description text,
  reporter_id uuid,
  reporter_email text,
  status text,
  admin_notes text,
  reviewed_by uuid,
  reviewer_email text,
  reviewed_at timestamptz,
  created_at timestamptz,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_status not in ('all', 'pending', 'reviewed', 'dismissed', 'actioned')
    or p_kind not in ('all', 'property', 'vehicle', 'machinery', 'service')
  then
    raise exception 'invalid report filter' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select r.*, reporter.email as reporter_email, reviewer.email as reviewer_email
    from public.reports r
    join public.users reporter on reporter.id = r.reporter_id
    left join public.users reviewer on reviewer.id = r.reviewed_by
    where (p_status = 'all' or r.status::text = p_status)
      and (p_kind = 'all' or r.listing_type::text = p_kind)
      and (
        trim(coalesce(p_query, '')) = ''
        or r.listing_title ilike '%' || trim(p_query) || '%'
        or reporter.email ilike '%' || trim(p_query) || '%'
        or r.reason::text ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.id,
    filtered.listing_id,
    filtered.listing_type::text,
    filtered.listing_title,
    filtered.reason::text,
    filtered.description,
    filtered.reporter_id,
    filtered.reporter_email,
    filtered.status::text,
    filtered.admin_notes,
    filtered.reviewed_by,
    filtered.reviewer_email,
    filtered.reviewed_at,
    filtered.created_at,
    count(*) over()
  from filtered
  order by filtered.created_at desc, filtered.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_review_report(
  p_report_id uuid,
  p_status report_status,
  p_notes text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_notes);
  before_row jsonb;
  after_row jsonb;
  target_listing uuid;
begin
  if p_status not in ('reviewed', 'dismissed', 'actioned') then
    raise exception 'invalid report decision' using errcode = '22023';
  end if;

  select to_jsonb(r), r.listing_id into before_row, target_listing
  from public.reports r where r.id = p_report_id for update;
  if before_row is null then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if p_status = 'actioned' then
    if target_listing is null then
      raise exception 'reported listing is no longer available' using errcode = 'P0002';
    end if;
    update public.reports
    set status = 'actioned', admin_notes = normalized_reason,
        reviewed_by = auth.uid(), reviewed_at = now()
    where listing_id = target_listing and status in ('pending', 'reviewed');
    update public.reports set listing_id = null where listing_id = target_listing;
    delete from public.listings where id = target_listing;
  else
    update public.reports
    set status = p_status, admin_notes = normalized_reason,
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_report_id;
  end if;

  select to_jsonb(r) into after_row from public.reports r where r.id = p_report_id;
  perform public.record_admin_action(
    'report.' || p_status::text,
    p_report_id::text,
    'report',
    normalized_reason,
    before_row,
    after_row
  );
  return after_row;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_audit_rows(
  p_query text default '',
  p_target_type text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  audit_id uuid,
  admin_user_id uuid,
  admin_email text,
  action_performed text,
  target_record_id text,
  target_record_type text,
  reason text,
  result text,
  correlation_id uuid,
  created_at timestamptz,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select a.*, u.email as admin_email
    from public.audit_logs a
    join public.users u on u.id = a.admin_user_id
    where (p_target_type = 'all' or a.target_record_type = p_target_type)
      and (
        trim(coalesce(p_query, '')) = ''
        or u.email ilike '%' || trim(p_query) || '%'
        or a.action_performed ilike '%' || trim(p_query) || '%'
        or a.reason ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.id,
    filtered.admin_user_id,
    filtered.admin_email,
    filtered.action_performed,
    filtered.target_record_id,
    filtered.target_record_type,
    filtered.reason,
    filtered.result,
    filtered.correlation_id,
    filtered.created_at,
    count(*) over()
  from filtered
  order by filtered.created_at desc, filtered.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_category_rows()
returns table (
  category_id uuid,
  slug text,
  parent_id uuid,
  parent_slug text,
  marketplace_kind text,
  display_label text,
  sort_order integer,
  is_active boolean,
  is_protected boolean,
  listing_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.slug,
    c.parent_id,
    parent.slug,
    c.marketplace_kind,
    c.display_label,
    c.sort_order,
    c.is_active,
    c.is_protected,
    case
      when c.parent_id is null and c.marketplace_kind = 'service' then
        (select count(*) from public.services s where s.category <> 'legal')
      when c.parent_id is null then
        (select count(*) from public.listings l where l.kind::text = c.marketplace_kind)
      when c.marketplace_kind = 'service' then
        (select count(*) from public.services s where s.category::text = c.slug)
      else
        (select count(*) from public.listings l where l.kind::text = c.marketplace_kind and l.category = c.slug)
    end
  from public.categories c
  left join public.categories parent on parent.id = c.parent_id
  order by coalesce(parent.sort_order, c.sort_order), c.parent_id nulls first, c.sort_order, c.display_label;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_add_category(
  p_parent_id uuid,
  p_slug text,
  p_display_label text,
  p_sort_order integer,
  p_reason text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  parent_row public.categories%rowtype;
  inserted_row public.categories%rowtype;
begin
  if p_slug !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
    or length(trim(p_display_label)) not between 2 and 80
    or p_sort_order not between 0 and 10000
  then
    raise exception 'invalid category values' using errcode = '22023';
  end if;

  select * into parent_row from public.categories
  where id = p_parent_id and parent_id is null and is_protected and is_active
  for update;
  if not found then
    raise exception 'active top-level category not found' using errcode = 'P0002';
  end if;

  insert into public.categories (
    slug, parent_id, marketplace_kind, display_label, sort_order
  ) values (
    p_slug, parent_row.id, parent_row.marketplace_kind, trim(p_display_label), p_sort_order
  ) returning * into inserted_row;

  perform public.record_admin_action(
    'category.created', inserted_row.id::text, 'category', normalized_reason,
    null, to_jsonb(inserted_row)
  );
  return to_jsonb(inserted_row);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_update_category(
  p_category_id uuid,
  p_display_label text,
  p_sort_order integer,
  p_is_active boolean,
  p_reason text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row public.categories%rowtype;
  after_row public.categories%rowtype;
begin
  if length(trim(p_display_label)) not between 2 and 80
    or p_sort_order not between 0 and 10000
  then
    raise exception 'invalid category values' using errcode = '22023';
  end if;

  select * into before_row from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  if before_row.is_protected and not p_is_active then
    raise exception 'protected top-level categories cannot be deactivated' using errcode = '42501';
  end if;

  update public.categories
  set display_label = trim(p_display_label),
      sort_order = p_sort_order,
      is_active = p_is_active
  where id = p_category_id
  returning * into after_row;

  perform public.record_admin_action(
    'category.updated', p_category_id::text, 'category', normalized_reason,
    to_jsonb(before_row), to_jsonb(after_row)
  );
  return to_jsonb(after_row);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.admin_dashboard_stats() from public;
revoke all on function public.admin_marketplace_rows(text, text, text, integer, integer) from public;
revoke all on function public.admin_moderate_marketplace_item(uuid, text, text, text) from public;
revoke all on function public.admin_user_rows(text, text, text, integer, integer) from public;
revoke all on function public.admin_set_user_role(uuid, text, text) from public;
revoke all on function public.admin_set_user_status(uuid, user_status, text, timestamptz) from public;
revoke all on function public.admin_report_rows(text, text, text, integer, integer) from public;
revoke all on function public.admin_review_report(uuid, report_status, text) from public;
revoke all on function public.admin_audit_rows(text, text, integer, integer) from public;
revoke all on function public.admin_category_rows() from public;
revoke all on function public.admin_add_category(uuid, text, text, integer, text) from public;
revoke all on function public.admin_update_category(uuid, text, integer, boolean, text) from public;

grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_marketplace_rows(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_moderate_marketplace_item(uuid, text, text, text) to authenticated;
grant execute on function public.admin_user_rows(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, user_status, text, timestamptz) to authenticated;
grant execute on function public.admin_report_rows(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_review_report(uuid, report_status, text) to authenticated;
grant execute on function public.admin_audit_rows(text, text, integer, integer) to authenticated;
grant execute on function public.admin_category_rows() to authenticated;
grant execute on function public.admin_add_category(uuid, text, text, integer, text) to authenticated;
grant execute on function public.admin_update_category(uuid, text, integer, boolean, text) to authenticated;

-- 0038_v1_public_tours_catalogue.sql
-- Milestone 5: public, listing-backed Tours catalogue with deterministic
-- keyset pagination. The browser receives no private storage path directly;
-- the tour-feed Edge Function signs thumbnail and cover assets in one batch.

create index if not exists idx_listing_tour_slots_current
  on public.listing_tour_slots(current_tour_id)
  where current_tour_id is not null;

create index if not exists idx_services_title_trgm
  on public.services using gin (title gin_trgm_ops);
create index if not exists idx_services_location_name_trgm
  on public.services using gin (location_name gin_trgm_ops);
create index if not exists idx_services_provider_name_trgm
  on public.services using gin (provider_name gin_trgm_ops);
create index if not exists idx_locations_name_trgm
  on public.locations using gin (name gin_trgm_ops);
create index if not exists idx_listings_seller_name_trgm
  on public.listings using gin (seller_name gin_trgm_ops);
create index if not exists idx_users_full_name_trgm
  on public.users using gin (full_name gin_trgm_ops);

create or replace function public.public_tour_feed(
  p_category text default 'all',
  p_location text default '',
  p_query text default '',
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 8
)
returns table (
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  listing_type text,
  title text,
  price numeric,
  currency text,
  pricing_type text,
  public_location text,
  cover_storage_path text,
  thumbnail_storage_path text,
  duration_seconds numeric,
  availability text,
  summary_attributes jsonb,
  seller_id uuid,
  seller_display_name text,
  seller_type text,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_category text := lower(trim(coalesce(p_category, 'all')));
  normalized_location text := trim(coalesce(p_location, ''));
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_location text;
  escaped_query text;
begin
  if normalized_category not in ('all', 'property', 'car', 'machinery', 'service') then
    raise exception 'invalid Tour category' using errcode = '22023';
  end if;
  if char_length(normalized_location) > 120 or char_length(normalized_query) > 100 then
    raise exception 'Tour filters are too long' using errcode = '22023';
  end if;
  if p_limit not between 1 and 24 then
    raise exception 'Tour page size must be between 1 and 24' using errcode = '22023';
  end if;
  if (p_cursor_published_at is null) <> (p_cursor_id is null) then
    raise exception 'Tour cursor is incomplete' using errcode = '22023';
  end if;
  if not public.is_backend_feature_enabled('tours') then
    return;
  end if;

  -- Treat user-entered %, _ and backslash as literal characters while keeping
  -- ILIKE compatible with pg_trgm indexes on the underlying text columns.
  escaped_location := replace(replace(replace(normalized_location, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  with feed_rows as (
    select
      t.id as row_tour_id,
      'listing'::text as row_parent_type,
      l.id as row_parent_id,
      l.kind::text as row_listing_type,
      l.title as row_title,
      l.price as row_price,
      l.currency as row_currency,
      null::text as row_pricing_type,
      coalesce(location.name, '') as row_public_location,
      l.photos ->> 0 as row_cover_storage_path,
      t.thumbnail_storage_path as row_thumbnail_storage_path,
      t.duration_seconds as row_duration_seconds,
      l.status::text as row_availability,
      case l.kind
        when 'property' then to_jsonb(array_remove(array[
          case when property.bedrooms is not null then property.bedrooms::text || ' bed' end,
          case when property.bathrooms is not null then property.bathrooms::text || ' bath' end,
          case when property.size_sqm is not null then trim(to_char(property.size_sqm, 'FM999999990.##')) || ' m²' end
        ]::text[], null))
        when 'car' then to_jsonb(array_remove(array[
          case when car.year is not null then car.year::text end,
          case when car.mileage is not null then car.mileage::text || ' km' end,
          car.transmission::text
        ]::text[], null))
        when 'machinery' then to_jsonb(array_remove(array[
          case when machinery.year is not null then machinery.year::text end,
          case when machinery.usage_hours is not null then machinery.usage_hours::text || ' h' end,
          machinery.condition::text
        ]::text[], null))
      end as row_summary_attributes,
      l.seller_id as row_seller_id,
      coalesce(nullif(trim(l.seller_name), ''), nullif(trim(owner.full_name), ''), 'FindIt seller') as row_seller_display_name,
      'seller'::text as row_seller_type,
      t.published_at as row_published_at
    from public.listing_tour_slots slot
    join public.listing_tours t on t.id = slot.current_tour_id
    join public.listings l on l.id = slot.listing_id
    join public.users owner on owner.id = l.seller_id and owner.status = 'active'
    left join public.locations location on location.id = l.location_id
    left join public.property_details property on property.listing_id = l.id
    left join public.car_details car on car.listing_id = l.id
    left join public.machinery_details machinery on machinery.listing_id = l.id
    where slot.listing_id is not null
      and l.status in ('available', 'under_offer')
      and t.status = 'ready'
      and t.moderation_status = 'approved'
      and t.deleted_at is null
      and t.removed_at is null
      and t.published_at is not null
      and t.thumbnail_storage_path is not null
      and t.playback_storage_path is not null
      and public.is_tour_public_eligible(t.id)

    union all

    select
      t.id,
      'service'::text,
      service.id,
      'service'::text,
      service.title,
      service.price,
      service.currency,
      service.pricing_type::text,
      coalesce(service.location_name, ''),
      service.photos ->> 0,
      t.thumbnail_storage_path,
      t.duration_seconds,
      service.status::text,
      to_jsonb(array_remove(array[
        nullif(trim(service.subcategory), ''),
        case when service.can_travel then 'Can travel' end,
        category_label.label
      ]::text[], null)),
      service.provider_id,
      coalesce(nullif(trim(service.provider_name), ''), nullif(trim(owner.full_name), ''), 'FindIt service provider'),
      'service_provider'::text,
      t.published_at
    from public.listing_tour_slots slot
    join public.listing_tours t on t.id = slot.current_tour_id
    join public.services service on service.id = slot.service_id
    join public.users owner on owner.id = service.provider_id and owner.status = 'active'
    left join lateral (
      select case service.category::text
        when 'property_developer' then 'Property development'
        when 'mechanic' then 'Mechanic'
        when 'construction' then 'Construction'
        when 'geological' then 'Geological services'
        else 'Service'
      end as label
    ) category_label on true
    where slot.service_id is not null
      and service.status = 'active'
      and service.category <> 'legal'
      and t.status = 'ready'
      and t.moderation_status = 'approved'
      and t.deleted_at is null
      and t.removed_at is null
      and t.published_at is not null
      and t.thumbnail_storage_path is not null
      and t.playback_storage_path is not null
      and public.is_tour_public_eligible(t.id)
  ), filtered as (
    select *
    from feed_rows
    where (normalized_category = 'all' or row_listing_type = normalized_category)
      and (
        normalized_location = ''
        or row_public_location ilike '%' || escaped_location || '%' escape E'\\'
      )
      and (
        normalized_query = ''
        or row_title ilike '%' || escaped_query || '%' escape E'\\'
        or row_seller_display_name ilike '%' || escaped_query || '%' escape E'\\'
        or row_public_location ilike '%' || escaped_query || '%' escape E'\\'
      )
      and (
        p_cursor_published_at is null
        or (row_published_at, row_tour_id) < (p_cursor_published_at, p_cursor_id)
      )
  )
  select
    row_tour_id,
    row_parent_type,
    row_parent_id,
    row_listing_type,
    row_title,
    row_price,
    row_currency,
    row_pricing_type,
    row_public_location,
    row_cover_storage_path,
    row_thumbnail_storage_path,
    row_duration_seconds,
    row_availability,
    coalesce(row_summary_attributes, '[]'::jsonb),
    row_seller_id,
    row_seller_display_name,
    row_seller_type,
    row_published_at
  from filtered
  order by row_published_at desc, row_tour_id desc
  limit p_limit + 1;
end;
$$;

revoke all on function public.public_tour_feed(text, text, text, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.public_tour_feed(text, text, text, timestamptz, uuid, integer) to service_role;

comment on function public.public_tour_feed(text, text, text, timestamptz, uuid, integer) is
  'Service-only keyset read model for the public Tours catalogue. Returns p_limit + 1 rows so the signing boundary can derive a next cursor without offsets.';

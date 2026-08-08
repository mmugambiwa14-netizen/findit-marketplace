-- Public listing card search projection.
--
-- Keeps the same public marketplace filters, currency rules, suspension boundary,
-- keyset ordering and caller roles as public_listing_search_page_v2, but returns
-- only fields consumed by Search cards/map plus one cover image. The v2 function
-- remains installed and callable for compatibility and rollback.

create or replace function private.public_listing_search_card_page_v1(
  p_kind text,
  p_country_code text default 'ZW',
  p_currency text default '',
  p_query text default '',
  p_category text default '',
  p_location_id text default '',
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_bedrooms integer default null,
  p_brand text default '',
  p_condition text default '',
  p_fuel_type text default '',
  p_transmission text default '',
  p_sort text default 'newest',
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  kind text,
  seller_id uuid,
  seller_name text,
  has_contact_phone boolean,
  has_contact_whatsapp boolean,
  has_contact_email boolean,
  title text,
  price numeric,
  currency text,
  variants jsonb,
  photos jsonb,
  latitude numeric,
  longitude numeric,
  public_location_label text,
  category text,
  listing_type text,
  status text,
  views integer,
  created_at timestamptz,
  car_details jsonb,
  property_details jsonb,
  machinery_details jsonb,
  cursor_value text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  normalized_country text := upper(trim(coalesce(p_country_code, '')));
  normalized_currency text := upper(trim(coalesce(p_currency, '')));
  escaped_query text;
  cursor_time timestamptz;
  cursor_number numeric;
  cursor_views integer;
begin
  if p_kind not in ('property', 'car', 'machinery')
    or p_sort not in ('newest', 'price_asc', 'price_desc', 'most_viewed')
    or p_limit not between 1 and 50
    or normalized_country !~ '^[A-Z]{2}$'
    or char_length(normalized_query) > 100
    or char_length(coalesce(p_category, '')) > 80
    or char_length(coalesce(p_location_id, '')) > 64
    or char_length(coalesce(p_brand, '')) > 80
    or char_length(coalesce(p_condition, '')) > 40
    or char_length(coalesce(p_fuel_type, '')) > 40
    or char_length(coalesce(p_transmission, '')) > 40
    or (p_min_price is not null and p_min_price < 0)
    or (p_max_price is not null and p_max_price < 0)
    or (p_min_price is not null and p_max_price is not null and p_max_price < p_min_price)
    or ((p_min_price is not null or p_max_price is not null) and normalized_currency = '')
    or (p_sort in ('price_asc', 'price_desc') and normalized_currency = '')
    or ((p_cursor_value is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid public listing card search page' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.country_configs country
    where country.country_code = normalized_country
      and country.operational_state in ('active', 'browse_only')
  ) then
    raise exception 'invalid public listing card search market' using errcode = '22023';
  end if;

  if normalized_currency <> '' and not exists (
    select 1
    from public.country_configs country
    where country.country_code = normalized_country
      and normalized_currency = any(country.supported_listing_currencies)
  ) then
    raise exception 'invalid public listing card search currency' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  if p_cursor_value is not null then
    begin
      if p_sort = 'newest' then
        cursor_time := p_cursor_value::timestamptz;
      elsif p_sort in ('price_asc', 'price_desc') then
        cursor_number := p_cursor_value::numeric;
      else
        cursor_views := p_cursor_value::integer;
      end if;
    exception when others then
      raise exception 'invalid public listing card search cursor' using errcode = '22023';
    end;
  end if;

  return query
  select
    listing.id,
    listing.kind::text,
    listing.seller_id,
    listing.seller_name,
    listing.has_contact_phone,
    listing.has_contact_whatsapp,
    listing.has_contact_email,
    listing.title,
    coalesce(listing.native_price, listing.price),
    coalesce(nullif(listing.native_currency, ''), nullif(listing.currency, ''), 'USD'),
    listing.variants,
    case
      when jsonb_typeof(listing.photos) = 'array' then
        case
          when jsonb_array_length(listing.photos) > 0 then jsonb_build_array(listing.photos -> 0)
          else '[]'::jsonb
        end
      else '[]'::jsonb
    end,
    listing.public_latitude,
    listing.public_longitude,
    listing.public_location_label,
    listing.category,
    listing.listing_type,
    listing.status::text,
    listing.views,
    listing.created_at,
    case when car.listing_id is null then null else jsonb_build_object(
      'brand', car.brand,
      'model', car.model,
      'year', car.year,
      'mileage', car.mileage,
      'fuel_type', car.fuel_type,
      'transmission', car.transmission,
      'condition', car.condition
    ) end,
    case when property.listing_id is null then null else jsonb_build_object(
      'property_type', property.property_type,
      'bedrooms', property.bedrooms,
      'bathrooms', property.bathrooms,
      'size_sqm', property.size_sqm
    ) end,
    case when machinery.listing_id is null then null else jsonb_build_object(
      'machinery_type', machinery.machinery_type,
      'brand', machinery.brand,
      'model', machinery.model,
      'condition', machinery.condition,
      'year', machinery.year,
      'usage_hours', machinery.usage_hours
    ) end,
    case p_sort
      when 'newest' then listing.created_at::text
      when 'price_asc' then coalesce(listing.native_price, listing.price)::text
      when 'price_desc' then coalesce(listing.native_price, listing.price)::text
      else listing.views::text
    end
  from public.listings listing
  left join public.car_details car on car.listing_id = listing.id
  left join public.property_details property on property.listing_id = listing.id
  left join public.machinery_details machinery on machinery.listing_id = listing.id
  where listing.kind::text = p_kind
    and coalesce(listing.country_code, 'ZW') = normalized_country
    and listing.status in ('available', 'under_offer')
    and listing.content_suspended_at is null
    and (
      normalized_currency = ''
      or (
        coalesce(nullif(listing.native_currency, ''), nullif(listing.currency, ''), 'USD') = normalized_currency
        and (p_min_price is null or coalesce(listing.native_price, listing.price) >= p_min_price)
        and (p_max_price is null or coalesce(listing.native_price, listing.price) <= p_max_price)
      )
    )
    and (coalesce(p_category, '') = '' or listing.category = p_category)
    and (coalesce(p_location_id, '') = '' or listing.location_id::text = p_location_id)
    and (
      normalized_query = ''
      or listing.search_document @@ websearch_to_tsquery('simple'::regconfig, normalized_query)
      or listing.title ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (
      (p_kind = 'property' and property.listing_id is not null and (p_min_bedrooms is null or property.bedrooms >= p_min_bedrooms))
      or (p_kind = 'car' and car.listing_id is not null
        and (coalesce(p_brand, '') = '' or car.brand = p_brand)
        and (coalesce(p_condition, '') = '' or car.condition = p_condition)
        and (coalesce(p_fuel_type, '') = '' or car.fuel_type::text = p_fuel_type)
        and (coalesce(p_transmission, '') = '' or car.transmission::text = p_transmission))
      or (p_kind = 'machinery' and machinery.listing_id is not null
        and (coalesce(p_brand, '') = '' or machinery.brand = p_brand)
        and (coalesce(p_condition, '') = '' or machinery.condition::text = p_condition))
    )
    and (
      p_cursor_id is null
      or (p_sort = 'newest' and (listing.created_at, listing.id) < (cursor_time, p_cursor_id))
      or (p_sort = 'price_asc' and (coalesce(listing.native_price, listing.price), listing.id) > (cursor_number, p_cursor_id))
      or (p_sort = 'price_desc' and (coalesce(listing.native_price, listing.price), listing.id) < (cursor_number, p_cursor_id))
      or (p_sort = 'most_viewed' and (listing.views, listing.id) < (cursor_views, p_cursor_id))
    )
  order by
    case when p_sort = 'newest' then listing.created_at end desc,
    case when p_sort = 'price_asc' then coalesce(listing.native_price, listing.price) end asc,
    case when p_sort = 'price_desc' then coalesce(listing.native_price, listing.price) end desc,
    case when p_sort = 'most_viewed' then listing.views end desc,
    case when p_sort = 'price_asc' then listing.id end asc,
    case when p_sort <> 'price_asc' then listing.id end desc
  limit p_limit + 1;
end;
$$;

revoke all on function private.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) from public, anon, authenticated, service_role;

grant execute on function private.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) to anon, authenticated, service_role;

create or replace function public.public_listing_search_card_page_v1(
  p_kind text,
  p_country_code text default 'ZW',
  p_currency text default '',
  p_query text default '',
  p_category text default '',
  p_location_id text default '',
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_bedrooms integer default null,
  p_brand text default '',
  p_condition text default '',
  p_fuel_type text default '',
  p_transmission text default '',
  p_sort text default 'newest',
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  kind text,
  seller_id uuid,
  seller_name text,
  has_contact_phone boolean,
  has_contact_whatsapp boolean,
  has_contact_email boolean,
  title text,
  price numeric,
  currency text,
  variants jsonb,
  photos jsonb,
  latitude numeric,
  longitude numeric,
  public_location_label text,
  category text,
  listing_type text,
  status text,
  views integer,
  created_at timestamptz,
  car_details jsonb,
  property_details jsonb,
  machinery_details jsonb,
  cursor_value text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.public_listing_search_card_page_v1(
    p_kind,
    p_country_code,
    p_currency,
    p_query,
    p_category,
    p_location_id,
    p_min_price,
    p_max_price,
    p_min_bedrooms,
    p_brand,
    p_condition,
    p_fuel_type,
    p_transmission,
    p_sort,
    p_cursor_value,
    p_cursor_id,
    p_limit
  );
$$;

revoke all on function public.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) from public, anon, authenticated, service_role;

grant execute on function public.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) to anon, authenticated, service_role;

comment on function public.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) is 'Thin bounded public marketplace card search with seller-native currency, privacy-safe location, one cover image and keyset pagination.';

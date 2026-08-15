-- Restore the public/private listing boundary after 0048 enabled direct
-- PostgREST detail reads. Public callers receive only an explicit projection,
-- while legacy exact coordinates are retained behind owner/admin RLS.

insert into public.listing_private_locations (
  listing_id,
  owner_id,
  exact_latitude,
  exact_longitude,
  source
)
select
  id,
  seller_id,
  latitude,
  longitude,
  'manual'::public.location_source
from public.listings
where latitude is not null or longitude is not null
on conflict (listing_id) do update set
  exact_latitude = coalesce(listing_private_locations.exact_latitude, excluded.exact_latitude),
  exact_longitude = coalesce(listing_private_locations.exact_longitude, excluded.exact_longitude),
  updated_at = now();

create or replace function public.resolve_listing_public_location(p_location_id uuid)
returns table (
  latitude numeric,
  longitude numeric,
  label text
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive hierarchy as (
    select
      location.id,
      location.parent_id,
      location.name,
      location.type,
      location.latitude,
      location.longitude,
      location.is_active,
      0 as depth
    from public.locations location
    where location.id = p_location_id

    union all

    select
      parent.id,
      parent.parent_id,
      parent.name,
      parent.type,
      parent.latitude,
      parent.longitude,
      parent.is_active,
      child.depth + 1
    from hierarchy child
    join public.locations parent on parent.id = child.parent_id
    where child.depth < 8
  )
  select
    hierarchy.latitude,
    hierarchy.longitude,
    hierarchy.name
  from hierarchy
  where hierarchy.is_active
    and hierarchy.latitude is not null
    and hierarchy.longitude is not null
    and hierarchy.type::text in (
      'country',
      'province',
      'state',
      'region',
      'county',
      'city',
      'town',
      'district'
    )
  order by hierarchy.depth
  limit 1;
$$;

revoke all on function public.resolve_listing_public_location(uuid) from public, anon, authenticated;

update public.listings
set
  public_latitude = null,
  public_longitude = null,
  public_location = null;

with resolved as (
  select listing.id, public_location.latitude, public_location.longitude, public_location.label
  from public.listings listing
  join lateral public.resolve_listing_public_location(listing.location_id) public_location on true
)
update public.listings listing
set
  public_latitude = resolved.latitude,
  public_longitude = resolved.longitude,
  public_location_label = resolved.label,
  public_location = extensions.st_setsrid(
    extensions.st_makepoint(
      resolved.longitude::double precision,
      resolved.latitude::double precision
    ),
    4326
  )::extensions.geography
from resolved
where resolved.id = listing.id;

create or replace function public.enforce_listing_public_location()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  resolved record;
begin
  select *
  into resolved
  from public.resolve_listing_public_location(new.location_id);

  if found then
    new.public_latitude := resolved.latitude;
    new.public_longitude := resolved.longitude;
    new.public_location_label := resolved.label;
    new.public_location := extensions.st_setsrid(
      extensions.st_makepoint(
        resolved.longitude::double precision,
        resolved.latitude::double precision
      ),
      4326
    )::extensions.geography;
  else
    new.public_latitude := null;
    new.public_longitude := null;
    new.public_location := null;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_public_location() from public, anon, authenticated;

drop trigger if exists trg_listings_public_location_guard on public.listings;
create trigger trg_listings_public_location_guard
  before insert or update of location_id, public_latitude, public_longitude, public_location
  on public.listings
  for each row execute function public.enforce_listing_public_location();

create or replace function public.sync_listing_private_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.latitude is null and new.longitude is null then
    return new;
  end if;

  insert into public.listing_private_locations (
    listing_id,
    owner_id,
    exact_latitude,
    exact_longitude,
    source
  ) values (
    new.id,
    new.seller_id,
    new.latitude,
    new.longitude,
    'manual'::public.location_source
  )
  on conflict (listing_id) do update set
    owner_id = excluded.owner_id,
    exact_latitude = excluded.exact_latitude,
    exact_longitude = excluded.exact_longitude,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_listing_private_location() from public, anon, authenticated;

drop trigger if exists trg_listings_private_location_sync on public.listings;
create trigger trg_listings_private_location_sync
  after insert or update of latitude, longitude, seller_id
  on public.listings
  for each row execute function public.sync_listing_private_location();

create or replace function public.can_read_listing_context(
  p_listing_id uuid,
  p_seller_id uuid,
  p_content_suspended_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and (
    p_seller_id = auth.uid()
    or public.is_admin()
    or (
      p_content_suspended_at is null
      and (
        exists (
          select 1
          from public.saved_listings saved
          where saved.listing_id = p_listing_id
            and saved.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.conversations conversation
          where conversation.listing_id = p_listing_id
            and (
              conversation.buyer_id = auth.uid()
              or conversation.seller_id = auth.uid()
            )
        )
      )
    )
  );
$$;

revoke all on function public.can_read_listing_context(uuid, uuid, timestamptz) from public;
grant execute on function public.can_read_listing_context(uuid, uuid, timestamptz) to anon, authenticated, service_role;

drop policy if exists "listings_public_read_available" on public.listings;
create policy "listings_public_read_available" on public.listings
  for select
  to anon, authenticated
  using (
    (
      status in ('available', 'under_offer')
      and content_suspended_at is null
    )
    or public.can_read_listing_context(id, seller_id, content_suspended_at)
  );

drop function if exists public.can_read_listing_context(uuid, uuid);

revoke select on table public.listings from anon, authenticated;
grant select (
  id,
  kind,
  seller_id,
  seller_name,
  contact_phone,
  contact_whatsapp,
  contact_email,
  title,
  description,
  price,
  currency,
  native_price,
  native_currency,
  deposit,
  agent_fee,
  additional_fees,
  accepts_offers,
  variants,
  photos,
  location_id,
  country_code,
  public_latitude,
  public_longitude,
  public_location_label,
  location_visibility,
  category,
  listing_type,
  status,
  expires_at,
  created_via,
  views,
  created_at,
  updated_at
) on table public.listings to anon, authenticated;

revoke select on table public.locations from anon, authenticated;
grant select (
  id,
  name,
  type,
  parent_id,
  country_code,
  latitude,
  longitude,
  timezone,
  is_active,
  created_at
) on table public.locations to anon, authenticated;

drop policy if exists "locations_public_read" on public.locations;
create policy "locations_public_read" on public.locations
  for select
  using (
    (
      is_active
      and (provider_name is null or promoted_at is not null)
    )
    or public.is_admin()
  );

create or replace function public.owner_listing_notes(p_listing_ids uuid[])
returns table (
  id uuid,
  moderation_reason text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_user()
    or p_listing_ids is null
    or cardinality(p_listing_ids) not between 1 and 50
  then
    raise exception 'invalid owner listing note request' using errcode = '22023';
  end if;

  return query
  select listing.id, listing.moderation_reason, listing.submitted_at
  from public.listings listing
  where listing.seller_id = auth.uid()
    and listing.id = any(p_listing_ids);
end;
$$;

revoke all on function public.owner_listing_notes(uuid[]) from public, anon;
grant execute on function public.owner_listing_notes(uuid[]) to authenticated;

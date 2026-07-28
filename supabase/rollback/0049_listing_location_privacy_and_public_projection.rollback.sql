-- Roll back with the matching application revision. Exact-coordinate data
-- retained in listing_private_locations is deliberately not deleted.

drop function if exists public.owner_listing_notes(uuid[]);

revoke select on table public.listings from anon, authenticated;
grant select on table public.listings to anon, authenticated;

revoke select on table public.locations from anon, authenticated;
grant select on table public.locations to anon, authenticated;

drop policy if exists "listings_public_read_available" on public.listings;

create or replace function public.can_read_listing_context(
  p_listing_id uuid,
  p_seller_id uuid
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
    or exists (
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
  );
$$;

revoke all on function public.can_read_listing_context(uuid, uuid) from public;
grant execute on function public.can_read_listing_context(uuid, uuid) to anon, authenticated;

create policy "listings_public_read_available" on public.listings
  for select
  to anon, authenticated
  using (
    status in ('available', 'under_offer')
    or public.can_read_listing_context(id, seller_id)
  );

drop function if exists public.can_read_listing_context(uuid, uuid, timestamptz);

drop trigger if exists trg_listings_public_location_guard on public.listings;
drop function if exists public.enforce_listing_public_location();
drop function if exists public.resolve_listing_public_location(uuid);

drop trigger if exists trg_listings_private_location_sync on public.listings;
drop function if exists public.sync_listing_private_location();

drop policy if exists "locations_public_read" on public.locations;
create policy "locations_public_read" on public.locations
  for select using (is_active or public.is_admin());

update public.listings
set
  public_latitude = latitude,
  public_longitude = longitude,
  public_location = case
    when longitude is not null and latitude is not null
    then extensions.st_setsrid(
      extensions.st_makepoint(
        longitude::double precision,
        latitude::double precision
      ),
      4326
    )::extensions.geography
    else null
  end;

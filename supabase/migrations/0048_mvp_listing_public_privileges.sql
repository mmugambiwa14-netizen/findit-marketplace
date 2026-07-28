-- Direct detail pages read these tables through PostgREST. RLS remains the
-- visibility boundary for public and owner-only rows.
grant select on table public.listings to anon, authenticated;
grant select on table public.car_details to anon, authenticated;
grant select on table public.property_details to anon, authenticated;
grant select on table public.machinery_details to anon, authenticated;
grant select on table public.locations to anon, authenticated;

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

drop policy if exists "listings_public_read_available" on public.listings;
create policy "listings_public_read_available" on public.listings
  for select
  to anon, authenticated
  using (
    status in ('available', 'under_offer')
    or public.can_read_listing_context(id, seller_id)
  );

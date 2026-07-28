revoke select on table public.listings from anon, authenticated;
revoke select on table public.car_details from anon, authenticated;
revoke select on table public.property_details from anon, authenticated;
revoke select on table public.machinery_details from anon, authenticated;
revoke select on table public.locations from anon, authenticated;

drop policy if exists "listings_public_read_available" on public.listings;
create policy "listings_public_read_available" on public.listings
  for select using (
    status in ('available', 'under_offer')
    or (public.is_active_user() and seller_id = auth.uid())
    or public.is_admin()
    or (
      public.is_active_user()
      and exists (
        select 1
        from public.saved_listings saved
        where saved.listing_id = listings.id
          and saved.user_id = auth.uid()
      )
    )
    or (
      public.is_active_user()
      and exists (
        select 1
        from public.conversations conversation
        where conversation.listing_id = listings.id
          and (
            conversation.buyer_id = auth.uid()
            or conversation.seller_id = auth.uid()
          )
      )
    )
  );

drop function if exists public.can_read_listing_context(uuid, uuid);

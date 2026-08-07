-- Roll back public marketplace search v2.
-- The legacy v1 function remains installed throughout the forward migration, so
-- rollback only restores its browser execution grants and removes v2 objects.

grant execute on function public.public_listing_search_page(
  text, text, text, text, numeric, numeric, integer, text, text, text,
  text, text, text, uuid, integer
) to anon, authenticated;

grant execute on function private.public_listing_search_page(
  text, text, text, text, numeric, numeric, integer, text, text, text,
  text, text, text, uuid, integer
) to anon, authenticated;

revoke all on function public.public_listing_search_page_v2(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) from public, anon, authenticated, service_role;

drop function if exists public.public_listing_search_page_v2(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
);

revoke all on function private.public_listing_search_page_v2(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) from public, anon, authenticated, service_role;

drop function if exists private.public_listing_search_page_v2(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
);

drop index if exists public.idx_listings_public_currency_price_desc;
drop index if exists public.idx_listings_public_currency_price_asc;

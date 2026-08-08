-- Roll back the thin public listing card search projection.
-- public_listing_search_page_v2 remains installed throughout, so rollback only
-- removes the card-specific compatibility layer and restores no data.

revoke all on function public.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) from public, anon, authenticated, service_role;

drop function if exists public.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
);

revoke all on function private.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
) from public, anon, authenticated, service_role;

drop function if exists private.public_listing_search_card_page_v1(
  text, text, text, text, text, text, numeric, numeric, integer, text, text,
  text, text, text, text, uuid, integer
);

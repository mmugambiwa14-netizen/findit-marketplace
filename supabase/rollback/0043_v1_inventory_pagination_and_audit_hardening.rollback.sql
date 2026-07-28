-- Non-destructive rollback for inventory pagination indexes.

drop index if exists public.idx_listings_seller_keyset;
drop index if exists public.idx_saved_listings_user_keyset;
drop index if exists public.idx_services_provider_keyset;
drop index if exists public.idx_services_public_keyset;

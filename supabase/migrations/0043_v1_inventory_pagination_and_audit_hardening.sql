-- Extensive product-audit remediation: bounded keyset pagination for inventory surfaces.

create index if not exists idx_services_public_keyset
  on public.services(status, category, created_at desc, id desc)
  where category <> 'legal';

create index if not exists idx_services_provider_keyset
  on public.services(provider_id, created_at desc, id desc)
  where category <> 'legal';

create index if not exists idx_saved_listings_user_keyset
  on public.saved_listings(user_id, created_at desc, id desc);

create index if not exists idx_listings_seller_keyset
  on public.listings(seller_id, created_at desc, id desc);

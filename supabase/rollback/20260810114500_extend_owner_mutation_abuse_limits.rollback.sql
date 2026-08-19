begin;

drop trigger if exists trg_users_owner_abuse_budget on public.users;
drop trigger if exists trg_peek_request_supporters_abuse_budget on public.peek_request_supporters;
drop trigger if exists trg_services_owner_abuse_budget on public.services;
drop trigger if exists trg_listings_owner_abuse_budget on public.listings;

drop function if exists private.enforce_profile_owner_abuse_budget();
drop function if exists private.enforce_peek_support_abuse_budget();
drop function if exists private.enforce_service_owner_abuse_budget();
drop function if exists private.enforce_listing_owner_abuse_budget();

commit;

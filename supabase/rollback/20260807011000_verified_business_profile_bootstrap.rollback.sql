begin;

drop trigger if exists bootstrap_verified_business_profile on public.business_profiles;
drop function if exists public.bootstrap_business_profile_verification();

commit;

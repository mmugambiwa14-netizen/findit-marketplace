begin;

drop trigger if exists notify_business_category_state on public.business_category_approvals;
drop trigger if exists notify_business_application_state on public.business_applications;
drop function if exists public.notify_business_application_state();
drop trigger if exists bootstrap_verified_business_profile on public.business_profiles;
drop function if exists public.bootstrap_business_profile_verification();

commit;

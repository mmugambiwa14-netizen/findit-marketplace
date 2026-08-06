drop trigger if exists prevent_owner_business_verification_mutation on public.business_profiles;
drop function if exists public.prevent_owner_business_verification_mutation();
drop function if exists public.review_business_verification(uuid, text, text);
drop function if exists public.withdraw_business_verification(uuid);
drop function if exists public.submit_business_verification(uuid, text, text, text[], text);
drop table if exists public.business_verification_applications;

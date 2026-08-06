begin;

drop trigger if exists prevent_owner_business_verification_mutation on public.business_profiles;
drop function if exists public.prevent_owner_business_verification_mutation();
drop trigger if exists sync_verified_profile_from_category on public.business_category_approvals;
drop trigger if exists sync_verified_profile_from_application on public.business_applications;
drop function if exists public.sync_business_profile_verification_trigger();
drop function if exists public.sync_business_profile_verification(uuid);

drop view if exists public.business_profiles_public;
drop function if exists private.public_business_profiles();

create function private.public_business_profiles()
returns table (
  id uuid,
  user_id uuid,
  company_name text,
  business_type public.business_type,
  profile_type text,
  phone text,
  email text,
  website text,
  social_links jsonb,
  city text,
  address text,
  description text,
  avatar_url text,
  avatar_storage_path text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.user_id, profile.company_name, profile.business_type,
         profile.profile_type, profile.phone, profile.email, profile.website,
         profile.social_links, profile.city, profile.address, profile.description,
         profile.avatar_url, profile.avatar_storage_path, profile.created_at, profile.updated_at
  from public.business_profiles profile
  join public.users owner_user on owner_user.id = profile.user_id
  where owner_user.status = 'active'::public.user_status
    and profile.business_type <> 'legal_firm'::public.business_type;
$$;

revoke all on function private.public_business_profiles() from public;
grant execute on function private.public_business_profiles() to anon, authenticated, service_role;

create view public.business_profiles_public
with (security_barrier = true, security_invoker = true)
as select * from private.public_business_profiles();

revoke all on table public.business_profiles_public from public, anon, authenticated, service_role;
grant select on table public.business_profiles_public to anon, authenticated, service_role;

commit;

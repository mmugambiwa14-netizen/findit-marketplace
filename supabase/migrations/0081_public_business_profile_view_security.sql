-- 0081_public_business_profile_view_security.sql
-- Replace the public business-profile projection's implicit SECURITY DEFINER
-- view semantics with an explicit security-invoker view. The narrowly scoped
-- private function remains outside PostgREST's exposed schemas and returns only
-- the already approved public columns.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.public_business_profiles()
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
as $function$
  select
    profile.id,
    profile.user_id,
    profile.company_name,
    profile.business_type,
    profile.profile_type,
    profile.phone,
    profile.email,
    profile.website,
    profile.social_links,
    profile.city,
    profile.address,
    profile.description,
    profile.avatar_url,
    profile.avatar_storage_path,
    profile.created_at,
    profile.updated_at
  from public.business_profiles as profile
  join public.users as owner_user
    on owner_user.id = profile.user_id
  where owner_user.status = 'active'::public.user_status
    and profile.business_type <> 'legal_firm'::public.business_type;
$function$;

revoke all on function private.public_business_profiles() from public;
grant execute on function private.public_business_profiles() to anon, authenticated, service_role;

create or replace view public.business_profiles_public
with (security_barrier = true, security_invoker = true)
as
select *
from private.public_business_profiles();

revoke all on table public.business_profiles_public from public, anon, authenticated, service_role;
grant select on table public.business_profiles_public to anon, authenticated, service_role;

comment on function private.public_business_profiles() is
  'Non-exposed, least-column public business-profile projection used by the security-invoker API view.';

comment on view public.business_profiles_public is
  'Public active business and dealer profiles. Security-invoker view backed by a non-exposed least-column function.';

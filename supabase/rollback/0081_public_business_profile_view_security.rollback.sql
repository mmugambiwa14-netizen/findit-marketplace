-- Restore the prior direct projection while preserving least-privilege view
-- grants. This rollback intentionally reintroduces the former view execution
-- model and is suitable only for a controlled forward-fix decision.

create or replace view public.business_profiles_public
with (security_barrier = true, security_invoker = false)
as
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

revoke all on table public.business_profiles_public from public, anon, authenticated, service_role;
grant select on table public.business_profiles_public to anon, authenticated, service_role;

drop function if exists private.public_business_profiles();
revoke usage on schema private from anon, authenticated, service_role;

comment on view public.business_profiles_public is
  'Public active business and dealer profiles using the pre-0081 direct projection.';

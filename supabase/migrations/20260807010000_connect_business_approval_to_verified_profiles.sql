begin;

create or replace function public.sync_business_profile_verification(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_application_status text;
  v_has_approved boolean;
  v_has_pending boolean;
begin
  select user_id, status
    into v_user_id, v_application_status
  from public.business_applications
  where id = p_application_id;

  if v_user_id is null then return; end if;

  select exists (
    select 1 from public.business_category_approvals
    where business_application_id = p_application_id and status = 'approved'
  ), exists (
    select 1 from public.business_category_approvals
    where business_application_id = p_application_id and status = 'pending'
  ) into v_has_approved, v_has_pending;

  update public.business_profiles
  set verified = v_has_approved,
      verification_status = case
        when v_has_approved then 'verified'::public.business_verification_status
        when v_application_status = 'rejected' then 'rejected'::public.business_verification_status
        when v_application_status in ('submitted', 'reviewing', 'needs_information') or v_has_pending
          then 'pending'::public.business_verification_status
        else 'none'::public.business_verification_status
      end,
      updated_at = now()
  where user_id = v_user_id;
end;
$$;

revoke all on function public.sync_business_profile_verification(uuid) from public, anon, authenticated;
grant execute on function public.sync_business_profile_verification(uuid) to service_role;

create or replace function public.sync_business_profile_verification_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
begin
  if tg_table_name = 'business_applications' then
    v_application_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_application_id := case when tg_op = 'DELETE' then old.business_application_id else new.business_application_id end;
  end if;

  perform public.sync_business_profile_verification(v_application_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.sync_business_profile_verification_trigger() from public, anon, authenticated;

drop trigger if exists sync_verified_profile_from_application on public.business_applications;
create trigger sync_verified_profile_from_application
after insert or update of status on public.business_applications
for each row execute function public.sync_business_profile_verification_trigger();

drop trigger if exists sync_verified_profile_from_category on public.business_category_approvals;
create trigger sync_verified_profile_from_category
after insert or update of status or delete on public.business_category_approvals
for each row execute function public.sync_business_profile_verification_trigger();

create or replace function public.prevent_owner_business_verification_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.user_id and not public.is_admin() then
    if new.verified is distinct from old.verified
       or new.verification_status is distinct from old.verification_status
       or new.registration_number is distinct from old.registration_number
       or new.issuing_body is distinct from old.issuing_body then
      raise exception 'Business verification fields are admin controlled';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_owner_business_verification_mutation() from public, anon, authenticated;

drop trigger if exists prevent_owner_business_verification_mutation on public.business_profiles;
create trigger prevent_owner_business_verification_mutation
before update on public.business_profiles
for each row execute function public.prevent_owner_business_verification_mutation();

create or replace function private.public_business_profiles()
returns table (
  id uuid,
  user_id uuid,
  company_name text,
  business_type public.business_type,
  profile_type text,
  verified boolean,
  verification_status public.business_verification_status,
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
         profile.profile_type, profile.verified, profile.verification_status,
         profile.phone, profile.email, profile.website, profile.social_links,
         profile.city, profile.address, profile.description, profile.avatar_url,
         profile.avatar_storage_path, profile.created_at, profile.updated_at
  from public.business_profiles profile
  join public.users owner_user on owner_user.id = profile.user_id
  where owner_user.status = 'active'::public.user_status
    and profile.business_type <> 'legal_firm'::public.business_type;
$$;

revoke all on function private.public_business_profiles() from public;
grant execute on function private.public_business_profiles() to anon, authenticated, service_role;

create or replace view public.business_profiles_public
with (security_barrier = true, security_invoker = true)
as select * from private.public_business_profiles();

revoke all on table public.business_profiles_public from public, anon, authenticated, service_role;
grant select on table public.business_profiles_public to anon, authenticated, service_role;

commit;

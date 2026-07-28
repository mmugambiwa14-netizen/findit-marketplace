-- 0017_v1_business_profiles.sql
-- Activates the lightweight V1 business/dealer profile contract. A dealer is
-- a presentation of the same profile and is never an authorization role.

alter table public.business_profiles
  add column social_links jsonb not null default '{}'::jsonb,
  add column profile_type text generated always as (
    case when business_type = 'car_dealership' then 'dealer' else 'business' end
  ) stored;

do $$
begin
  if exists (
    select 1
      from public.business_profiles
     group by user_id
    having count(*) > 1
  ) then
    raise exception 'business profile migration requires duplicate-owner reconciliation';
  end if;
end;
$$;

create unique index business_profiles_one_per_owner
  on public.business_profiles(user_id);

create or replace function public.valid_business_social_links(value jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1
        from jsonb_each_text(value) as link(key, url)
       where link.key not in ('facebook', 'instagram', 'linkedin', 'x')
          or link.url !~* '^https?://[^[:space:]]+$'
    );
$$;

revoke all on function public.valid_business_social_links(jsonb) from public;

alter table public.business_profiles
  add constraint business_profiles_v1_type
    check (business_type <> 'legal_firm') not valid,
  add constraint business_profiles_company_name_length
    check (char_length(btrim(company_name)) between 2 and 100) not valid,
  add constraint business_profiles_contact_required
    check (
      nullif(btrim(coalesce(phone, '')), '') is not null
      or nullif(btrim(coalesce(email, '')), '') is not null
    ) not valid,
  add constraint business_profiles_website_http
    check (website is null or website ~* '^https?://[^[:space:]]+$') not valid,
  add constraint business_profiles_social_links_valid
    check (public.valid_business_social_links(social_links));

drop policy if exists "business_profiles_owner_write" on public.business_profiles;
drop policy if exists "business_profiles_owner_update" on public.business_profiles;

create policy "business_profiles_owner_write" on public.business_profiles
  for insert with check (
    public.is_active_user()
    and user_id = auth.uid()
    and business_type <> 'legal_firm'
    and registration_number is null
    and issuing_body is null
    and verified = false
    and verification_status = 'none'
  );

create policy "business_profiles_owner_update" on public.business_profiles
  for update using (
    public.is_active_user() and (user_id = auth.uid() or public.is_admin())
  ) with check (
    public.is_active_user()
    and (user_id = auth.uid() or public.is_admin())
    and business_type <> 'legal_firm'
  );

drop view if exists public.business_profiles_public;
create view public.business_profiles_public with (security_barrier = true) as
  select
    bp.id,
    bp.user_id,
    bp.company_name,
    bp.business_type,
    bp.profile_type,
    bp.phone,
    bp.email,
    bp.website,
    bp.social_links,
    bp.city,
    bp.address,
    bp.description,
    bp.avatar_url,
    bp.created_at,
    bp.updated_at
  from public.business_profiles bp
  join public.users owner on owner.id = bp.user_id
  where owner.status = 'active'
    and bp.business_type <> 'legal_firm';

revoke all on public.business_profiles_public from public;
grant select on public.business_profiles_public to anon, authenticated;
revoke select on public.business_profiles from anon;

comment on column public.business_profiles.profile_type is
  'Generated V1 presentation type. Dealer is not a user role.';
comment on column public.business_profiles.social_links is
  'Validated optional public links; allowed keys: facebook, instagram, linkedin, x.';

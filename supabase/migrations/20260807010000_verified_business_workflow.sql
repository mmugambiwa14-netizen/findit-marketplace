-- Verified business application and review workflow.
-- Verification is an administrative decision, never an owner-editable profile field.

create table if not exists public.business_verification_applications (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  registration_number text not null,
  issuing_body text not null,
  evidence_paths text[] not null default '{}',
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  decision_reason text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_verification_registration_length check (char_length(btrim(registration_number)) between 2 and 100),
  constraint business_verification_issuer_length check (char_length(btrim(issuing_body)) between 2 and 120),
  constraint business_verification_note_length check (note is null or char_length(note) <= 1000),
  constraint business_verification_reason_length check (decision_reason is null or char_length(btrim(decision_reason)) between 3 and 1000),
  constraint business_verification_decision_consistency check (
    (status = 'pending' and decided_by is null and decided_at is null and decision_reason is null)
    or (status = 'withdrawn' and decided_by is null and decided_at is null)
    or (status in ('approved', 'rejected') and decided_by is not null and decided_at is not null and decision_reason is not null)
  )
);

create unique index if not exists business_verification_one_pending_per_profile
  on public.business_verification_applications(business_profile_id)
  where status = 'pending';

create index if not exists business_verification_admin_queue
  on public.business_verification_applications(status, created_at desc, id desc);

alter table public.business_verification_applications enable row level security;

revoke all on public.business_verification_applications from public, anon, authenticated;
grant select on public.business_verification_applications to authenticated;

create policy business_verification_owner_read
  on public.business_verification_applications
  for select to authenticated
  using (applicant_id = auth.uid() or public.is_admin());

create or replace function public.submit_business_verification(
  p_business_profile_id uuid,
  p_registration_number text,
  p_issuing_body text,
  p_evidence_paths text[] default '{}',
  p_note text default null
)
returns public.business_verification_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.business_profiles;
  v_application public.business_verification_applications;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into v_profile
  from public.business_profiles
  where id = p_business_profile_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'business profile not found' using errcode = 'P0002';
  end if;

  if v_profile.verified then
    raise exception 'business is already verified' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.business_verification_applications
    where business_profile_id = p_business_profile_id and status = 'pending'
  ) then
    raise exception 'verification application already pending' using errcode = '23505';
  end if;

  if cardinality(coalesce(p_evidence_paths, '{}')) > 10 then
    raise exception 'too many evidence files' using errcode = '22023';
  end if;

  insert into public.business_verification_applications (
    business_profile_id, applicant_id, registration_number, issuing_body, evidence_paths, note
  ) values (
    p_business_profile_id,
    auth.uid(),
    btrim(p_registration_number),
    btrim(p_issuing_body),
    coalesce(p_evidence_paths, '{}'),
    nullif(btrim(coalesce(p_note, '')), '')
  ) returning * into v_application;

  update public.business_profiles
  set verification_status = 'pending', updated_at = now()
  where id = p_business_profile_id;

  return v_application;
end;
$$;

create or replace function public.withdraw_business_verification(p_application_id uuid)
returns public.business_verification_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_application public.business_verification_applications;
begin
  update public.business_verification_applications
  set status = 'withdrawn', updated_at = now()
  where id = p_application_id
    and applicant_id = auth.uid()
    and status = 'pending'
  returning * into v_application;

  if not found then
    raise exception 'pending application not found' using errcode = 'P0002';
  end if;

  update public.business_profiles
  set verification_status = 'none', updated_at = now()
  where id = v_application.business_profile_id;

  return v_application;
end;
$$;

create or replace function public.review_business_verification(
  p_application_id uuid,
  p_decision text,
  p_reason text
)
returns public.business_verification_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_application public.business_verification_applications;
  v_approved boolean;
begin
  if not public.is_admin() then
    raise exception 'admin required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid verification decision' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'decision reason required' using errcode = '22023';
  end if;

  update public.business_verification_applications
  set status = p_decision,
      decision_reason = btrim(p_reason),
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now()
  where id = p_application_id and status = 'pending'
  returning * into v_application;

  if not found then
    raise exception 'pending application not found' using errcode = 'P0002';
  end if;

  v_approved := p_decision = 'approved';
  update public.business_profiles
  set verified = v_approved,
      verification_status = p_decision,
      registration_number = case when v_approved then v_application.registration_number else null end,
      issuing_body = case when v_approved then v_application.issuing_body else null end,
      updated_at = now()
  where id = v_application.business_profile_id;

  return v_application;
end;
$$;

revoke all on function public.submit_business_verification(uuid, text, text, text[], text) from public;
revoke all on function public.withdraw_business_verification(uuid) from public;
revoke all on function public.review_business_verification(uuid, text, text) from public;
grant execute on function public.submit_business_verification(uuid, text, text, text[], text) to authenticated;
grant execute on function public.withdraw_business_verification(uuid) to authenticated;
grant execute on function public.review_business_verification(uuid, text, text) to authenticated;

-- Owners may update ordinary profile fields, but these fields are controlled only
-- by the security-definer workflow above.
create or replace function public.prevent_owner_business_verification_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.user_id and not public.is_admin() then
    if new.verified is distinct from old.verified
       or new.verification_status is distinct from old.verification_status
       or new.registration_number is distinct from old.registration_number
       or new.issuing_body is distinct from old.issuing_body then
      raise exception 'business verification fields are admin controlled' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_owner_business_verification_mutation() from public;

drop trigger if exists prevent_owner_business_verification_mutation on public.business_profiles;
create trigger prevent_owner_business_verification_mutation
before update on public.business_profiles
for each row execute function public.prevent_owner_business_verification_mutation();

comment on table public.business_verification_applications is
  'Auditable owner application and admin decision history for verified business profiles.';

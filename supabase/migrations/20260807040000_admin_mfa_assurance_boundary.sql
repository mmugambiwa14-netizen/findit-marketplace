begin;

-- Browser MFA routing is a UX boundary, not authorization. Once an
-- administrator has a verified factor, require an aal2 access token inside the
-- existing central authorization helpers so every dependent RLS policy and RPC
-- inherits the same server-side control.
create or replace function private.has_verified_mfa_factor(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from auth.mfa_factors factor
      where factor.user_id = p_user_id
        and factor.status = 'verified'
    );
$$;

create or replace function private.has_required_admin_assurance(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user_id is null then false
    -- Do not lock an administrator out of the enrolment path before a factor
    -- exists. As soon as a verified factor exists, aal2 becomes mandatory.
    when not private.has_verified_mfa_factor(p_user_id) then true
    else coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  end;
$$;

revoke all on function private.has_verified_mfa_factor(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.has_required_admin_assurance(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users user_record
    where user_record.id = auth.uid()
      and user_record.status = 'active'
      and user_record.role = 'admin'
      and user_record.super_admin = true
      and (
        public.is_founder_identity(user_record.email)
        or session_user = 'postgres'
      )
      and private.has_required_admin_assurance(user_record.id)
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

-- CREATE OR REPLACE preserves the locked grants established by migration 0088.
-- Revoke PUBLIC explicitly as a fail-safe against future ACL drift.
revoke all on function private.is_admin() from public;
revoke all on function private.is_super_admin() from public;

commit;

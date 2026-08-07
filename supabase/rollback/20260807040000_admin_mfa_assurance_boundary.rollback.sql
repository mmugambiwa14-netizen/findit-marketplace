begin;

-- Restore the pre-F-027 founder-admin authorization semantics.
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

revoke all on function private.is_admin() from public;
revoke all on function private.is_super_admin() from public;

drop function if exists private.has_required_admin_assurance(uuid);
drop function if exists private.has_verified_mfa_factor(uuid);

commit;

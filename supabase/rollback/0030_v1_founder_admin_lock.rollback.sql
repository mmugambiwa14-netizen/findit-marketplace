-- Rollback for 0030_v1_founder_admin_lock.sql.
-- This restores delegable admin semantics. It cannot reconstruct roles that
-- 0030 demoted; restore those from the pre-migration backup if required.

drop trigger if exists trg_users_founder_admin_identity on public.users;
drop function if exists public.protect_founder_admin_identity();

create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and status = 'active'
      and (role = 'admin' or super_admin = true)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and status = 'active'
      and super_admin = true
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text,
  p_reason text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row jsonb;
  after_row jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'super-admin access required' using errcode = '42501';
  end if;
  if p_role not in ('user', 'admin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'self role changes are not allowed' using errcode = '42501';
  end if;

  select to_jsonb(u) into before_row
  from public.users u
  where u.id = p_user_id
  for update;

  if before_row is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if coalesce((before_row ->> 'super_admin')::boolean, false) then
    raise exception 'super-admin roles cannot be changed here' using errcode = '42501';
  end if;

  update public.users set role = p_role where id = p_user_id
  returning to_jsonb(public.users.*) into after_row;

  perform public.record_admin_action(
    'user.role_changed',
    p_user_id::text,
    'user',
    normalized_reason,
    before_row - array['phone_otp_code', 'phone_otp_pending'],
    after_row - array['phone_otp_code', 'phone_otp_pending']
  );
  return after_row - array['phone_otp_code', 'phone_otp_pending'];
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.admin_set_user_role(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text, text) to authenticated;

drop function if exists public.is_founder_identity(text);

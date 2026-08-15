-- 0030_v1_founder_admin_lock.sql
-- FindIt is operated by one founder in V1. Administrative authorization is
-- bound to the founder's normalized-email SHA-256, not a public email literal.
-- Direct postgres sessions remain available for deterministic SQL tests and
-- disaster recovery; browser/PostgREST sessions cannot delegate admin access.

create or replace function public.is_founder_identity(p_email text)
returns boolean as $$
  select encode(
    extensions.digest(
      convert_to(lower(trim(coalesce(p_email, ''))), 'UTF8'),
      'sha256'
    ),
    'hex'
  ) = '2a3e85c734b16b94fe07e97c135c455badf69aa7f86b207160b1b0aff560e724';
$$ language sql immutable security definer set search_path = public, extensions;

revoke all on function public.is_founder_identity(text) from public, anon, authenticated;

-- Reconcile current data before enforcing the founder boundary.
update public.users
set role = 'user',
    super_admin = false
where not public.is_founder_identity(email)
  and (role <> 'user' or super_admin);

update public.users
set role = 'admin',
    super_admin = true,
    status = 'active',
    ban_reason = null,
    ban_until = null
where public.is_founder_identity(email);

-- Future signups deterministically bootstrap the founder account without
-- embedding the address in readable source.
create or replace function public.handle_new_auth_user()
returns trigger as $$
declare
  v_is_founder boolean := public.is_founder_identity(new.email);
begin
  insert into public.users (
    id, email, full_name, phone, role, super_admin
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', '')
    ),
    new.raw_user_meta_data ->> 'phone',
    case when v_is_founder then 'admin' else 'user' end,
    v_is_founder
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.protect_founder_admin_identity()
returns trigger as $$
begin
  -- SQL test and recovery sessions are an explicit trusted boundary. Hosted
  -- API requests use the authenticator session role and cannot take this path.
  if session_user = 'postgres' then
    return new;
  end if;

  if public.is_founder_identity(new.email) then
    new.role := 'admin';
    new.super_admin := true;
  elsif new.role = 'admin' or new.super_admin then
    raise exception 'the FindIt founder is the only administrative identity'
      using errcode = '42501';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public, extensions;

drop trigger if exists trg_users_founder_admin_identity on public.users;
create trigger trg_users_founder_admin_identity
  before insert or update of email, role, super_admin on public.users
  for each row execute function public.protect_founder_admin_identity();

revoke all on function public.protect_founder_admin_identity() from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and status = 'active'
      and role = 'admin'
      and super_admin = true
      and (
        public.is_founder_identity(email)
        or session_user = 'postgres'
      )
  );
$$ language sql stable security definer set search_path = public, extensions;

create or replace function public.is_super_admin()
returns boolean as $$
  select public.is_admin();
$$ language sql stable security definer set search_path = public, extensions;

-- Restate the browser/server grants without revoking the functions' standard
-- PUBLIC/owner ACL. This yields the same locked pre-0088 fingerprint whether
-- Supabase supplies the grants through default privileges or not.
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_super_admin() to anon, authenticated, service_role;

-- Keep the function signature for old clients and rollback compatibility, but
-- remove application-level role delegation. Direct postgres sessions can still
-- exercise the historical path in transactional database tests.
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
  if session_user <> 'postgres' then
    raise exception 'admin role delegation is disabled in founder-operated V1'
      using errcode = '42501';
  end if;
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

  update public.users
  set role = p_role
  where id = p_user_id
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
$$ language plpgsql security definer set search_path = public, extensions;

revoke all on function public.admin_set_user_role(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text, text) to authenticated;

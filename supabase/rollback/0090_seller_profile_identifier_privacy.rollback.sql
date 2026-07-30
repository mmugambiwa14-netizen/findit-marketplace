-- Roll back migration 0090 by removing the UUID seller profile boundary and
-- restoring the previous public email lookup exactly.

begin;

do $rollback$
declare
  public_uuid_count integer;
  private_uuid_count integer;
  restored_text_count integer;
begin
  select count(*)::integer into public_uuid_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
    and not function_record.prosecdef
    and function_record.proconfig = array['search_path=""']::text[];

  if public_uuid_count <> 1 then
    raise exception '0090 rollback expected one public UUID wrapper, found %', public_uuid_count;
  end if;

  select count(*)::integer into private_uuid_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
    and function_record.prosecdef
    and function_record.proconfig = array['search_path=""']::text[];

  if private_uuid_count <> 1 then
    raise exception '0090 rollback expected one private UUID implementation, found %', private_uuid_count;
  end if;

  drop function public.get_public_seller_profile(uuid);
  drop function private.get_public_seller_profile(uuid);

  create function public.get_public_seller_profile(seller_email text)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select jsonb_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'bio', u.bio,
      'avatar_url', u.avatar_url
    )
    from public.users u
    where u.status = 'active'
      and seller_email is not null
      and length(seller_email) <= 254
      and lower(u.email) = lower(trim(seller_email))
    limit 1;
  $$;

  revoke all on function public.get_public_seller_profile(text)
    from public, anon, authenticated, service_role;
  grant execute on function public.get_public_seller_profile(text)
    to postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_text_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_record.provolatile = 's'
    and function_record.prosecdef
    and function_record.proconfig = array['search_path=public']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '082229bceba5a21b0ea13b80a41c7a7c';

  if restored_text_count <> 1 then
    raise exception '0090 rollback did not restore the legacy seller profile function';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_record.proname = 'get_public_seller_profile'
      and (
        function_schema.nspname = 'private'
        or pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      )
  ) then
    raise exception '0090 rollback left UUID seller profile functions behind';
  end if;
end
$rollback$;

commit;

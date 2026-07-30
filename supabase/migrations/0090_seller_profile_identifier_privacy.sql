-- 0090_seller_profile_identifier_privacy.sql
--
-- Eliminate public seller lookup by account email. Public seller profiles now
-- use opaque user UUIDs and are returned only for active users with at least
-- one publicly eligible listing. The privileged implementation lives in the
-- non-exposed private schema; public keeps a SECURITY INVOKER RPC wrapper.

create temporary table findit_0090_expected_function (
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null
) on commit drop;

insert into findit_0090_expected_function values (
  '082229bceba5a21b0ea13b80a41c7a7c',
  array['search_path=public']::text[],
  '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
);

do $migration$
declare
  mismatch_count integer;
  private_count integer;
  public_count integer;
  legacy_count integer;
begin
  if (select count(*) from findit_0090_expected_function) <> 1 then
    raise exception '0090 expected exactly one legacy seller profile fingerprint';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('get_public_seller_profile(' in coalesce(policy.qual, '')) > 0
       or position('get_public_seller_profile(' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception '0090 refused because the legacy seller profile function has a policy dependency';
  end if;

  if exists (
    select 1
    from pg_proc caller
    where position('get_public_seller_profile(' in caller.prosrc) > 0
      and not (
        caller.proname = 'get_public_seller_profile'
        and pg_get_function_identity_arguments(caller.oid) = 'seller_email text'
      )
  ) then
    raise exception '0090 refused because the legacy seller profile function has a stored caller';
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
    raise exception '0090 refused because the UUID seller profile boundary already exists';
  end if;

  select count(*)::integer into mismatch_count
  from findit_0090_expected_function expected
  left join pg_proc function_record
    on function_record.proname = 'get_public_seller_profile'
   and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> 'sql'
     or pg_get_function_result(function_record.oid) <> 'jsonb'
     or function_record.provolatile <> 's'
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0090 refused because the legacy seller profile fingerprint drifted';
  end if;

  create function private.get_public_seller_profile(p_seller_id uuid)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select jsonb_build_object(
      'id', seller.id,
      'full_name', seller.full_name,
      'bio', seller.bio,
      'avatar_url', seller.avatar_url
    )
    from public.users seller
    where p_seller_id is not null
      and seller.id = p_seller_id
      and seller.status = 'active'
      and exists (
        select 1
        from public.listings listing
        left join public.locations location on location.id = listing.location_id
        where listing.seller_id = seller.id
          and listing.status in ('available', 'under_offer')
          and listing.content_suspended_at is null
          and private.is_country_browsable(
            coalesce(listing.country_code, location.country_code, 'ZW')
          )
      )
    limit 1;
  $$;

  revoke all on function private.get_public_seller_profile(uuid)
    from public, anon, authenticated, service_role;
  grant execute on function private.get_public_seller_profile(uuid)
    to anon, authenticated, service_role;

  create function public.get_public_seller_profile(p_seller_id uuid)
  returns jsonb
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.get_public_seller_profile(p_seller_id);
  $$;

  revoke all on function public.get_public_seller_profile(uuid)
    from public, anon, authenticated, service_role;
  grant execute on function public.get_public_seller_profile(uuid)
    to anon, authenticated, service_role;

  drop function public.get_public_seller_profile(text);

  select count(*)::integer into legacy_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text';

  if legacy_count <> 0 then
    raise exception '0090 left % legacy email seller profile functions', legacy_count;
  end if;

  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_record.provolatile = 's'
    and function_record.prosecdef
    and function_record.proconfig = array['search_path=""']::text[]
    and position('seller.id = p_seller_id' in function_record.prosrc) > 0
    and position('seller.status = ''active''' in function_record.prosrc) > 0
    and position('listing.status in (''available'', ''under_offer'')' in function_record.prosrc) > 0
    and position('listing.content_suspended_at is null' in function_record.prosrc) > 0
    and position('private.is_country_browsable(' in function_record.prosrc) > 0
    and position('seller.email' in function_record.prosrc) = 0;

  if private_count <> 1 then
    raise exception '0090 did not create the locked private seller profile implementation';
  end if;

  select count(*)::integer into public_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_record.provolatile = 's'
    and not function_record.prosecdef
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.get_public_seller_profile(p_seller_id)' in function_record.prosrc) > 0;

  if public_count <> 1 then
    raise exception '0090 did not create the locked public seller profile wrapper';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(
      function_record.proacl,
      acldefault('f', function_record.proowner)
    )) privilege
    where function_schema.nspname in ('public', 'private')
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0090 left a PUBLIC execute grant on the seller profile boundary';
  end if;
end
$migration$;

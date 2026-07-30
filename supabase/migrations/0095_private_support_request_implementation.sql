-- 0095_private_support_request_implementation.sql
--
-- Move the anonymous support-submission SECURITY DEFINER implementation into the
-- non-exposed private schema. Preserve the public RPC signature, default argument,
-- rate limits and compact confirmation response through a SECURITY INVOKER wrapper.

create temporary table findit_0095_expected_function (
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null
) on commit drop;

insert into findit_0095_expected_function values (
  '50b7df2c3d206e62dec244acf5f682d1',
  array['search_path=public']::text[],
  '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
);

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  private_count integer;
  public_count integer;
begin
  if (select count(*) from findit_0095_expected_function) <> 1 then
    raise exception '0095 expected exactly one support request fingerprint';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'submit_support_request'
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_category text, p_contact_email text, p_message text, p_related_reference text'
  ) then
    raise exception '0095 refused because a private support request implementation already exists';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('submit_support_request(' in coalesce(policy.qual, '')) > 0
       or position('submit_support_request(' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception '0095 refused because the support request function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where position('submit_support_request(' in caller.prosrc) > 0
    and not (
      caller_schema.nspname = 'public'
      and caller.proname = 'submit_support_request'
      and pg_get_function_identity_arguments(caller.oid) =
        'p_category text, p_contact_email text, p_message text, p_related_reference text'
    );

  if caller_count <> 0 then
    raise exception '0095 refused because % stored support request callers exist', caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0095_expected_function expected
  left join pg_proc function_record
    on function_record.proname = 'submit_support_request'
   and pg_get_function_identity_arguments(function_record.oid) =
      'p_category text, p_contact_email text, p_message text, p_related_reference text'
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> 'plpgsql'
     or pg_get_function_result(function_record.oid) <> 'jsonb'
     or function_record.provolatile <> 'v'
     or not function_record.prosecdef
     or function_record.pronargdefaults <> 1
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0095 refused because the support request fingerprint drifted';
  end if;

  alter function public.submit_support_request(text, text, text, text) set schema private;
  alter function private.submit_support_request(text, text, text, text) set search_path = '';

  revoke all on function private.submit_support_request(text, text, text, text)
    from public, anon, authenticated, service_role;
  grant execute on function private.submit_support_request(text, text, text, text)
    to anon, authenticated, service_role;

  create function public.submit_support_request(
    p_category text,
    p_contact_email text,
    p_message text,
    p_related_reference text default null
  )
  returns jsonb
  language sql
  volatile
  security invoker
  set search_path = ''
  as $$
    select private.submit_support_request(
      p_category,
      p_contact_email,
      p_message,
      p_related_reference
    );
  $$;

  revoke all on function public.submit_support_request(text, text, text, text)
    from public, anon, authenticated, service_role;
  grant execute on function public.submit_support_request(text, text, text, text)
    to anon, authenticated, service_role;

  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'submit_support_request'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_category text, p_contact_email text, p_message text, p_related_reference text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.pronargdefaults = 1
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '50b7df2c3d206e62dec244acf5f682d1';

  select count(*)::integer into public_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'submit_support_request'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_category text, p_contact_email text, p_message text, p_related_reference text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.pronargdefaults = 1
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.submit_support_request(' in function_record.prosrc) > 0;

  if private_count <> 1 or public_count <> 1 then
    raise exception '0095 did not create the locked support request boundary';
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
      and function_record.proname = 'submit_support_request'
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_category text, p_contact_email text, p_message text, p_related_reference text'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0095 left a PUBLIC execute grant on a support request function';
  end if;

  if not (
    has_function_privilege('anon', 'public.submit_support_request(text,text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.submit_support_request(text,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.submit_support_request(text,text,text,text)', 'EXECUTE')
    and has_function_privilege('anon', 'private.submit_support_request(text,text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.submit_support_request(text,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'private.submit_support_request(text,text,text,text)', 'EXECUTE')
  ) then
    raise exception '0095 did not preserve required support request execution grants';
  end if;
end
$migration$;

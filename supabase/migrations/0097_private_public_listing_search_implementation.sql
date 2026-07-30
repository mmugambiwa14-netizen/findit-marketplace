-- 0097_private_public_listing_search_implementation.sql
--
-- Move the final anonymous-callable SECURITY DEFINER implementation into the
-- non-exposed private schema. Preserve the full keyset-search RPC identity,
-- fourteen defaults, stable volatility and exact 31-column result projection
-- through a public SECURITY INVOKER wrapper.

create temporary table findit_0097_expected_function (
  normalized_body_md5 text not null,
  result_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null
) on commit drop;

insert into findit_0097_expected_function values (
  '2fa173e978e3d5142ef72c6266e9dc20',
  'fa68a2b80d7a4dd1844ef87566d01e12',
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
  if (select count(*) from findit_0097_expected_function) <> 1 then
    raise exception '0097 expected exactly one public listing search fingerprint';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'public_listing_search_page'
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
  ) then
    raise exception '0097 refused because a private public-listing search implementation already exists';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('public_listing_search_page(' in coalesce(policy.qual, '')) > 0
       or position('public_listing_search_page(' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception '0097 refused because the public listing search function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where position('public_listing_search_page(' in caller.prosrc) > 0
    and not (
      caller_schema.nspname = 'public'
      and caller.proname = 'public_listing_search_page'
      and pg_get_function_identity_arguments(caller.oid) =
        'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
    );

  if caller_count <> 0 then
    raise exception '0097 refused because % stored public listing search callers exist', caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0097_expected_function expected
  left join pg_proc function_record
    on function_record.proname = 'public_listing_search_page'
   and pg_get_function_identity_arguments(function_record.oid) =
      'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> 'plpgsql'
     or md5(pg_get_function_result(function_record.oid)) <> expected.result_md5
     or function_record.provolatile <> 's'
     or not function_record.prosecdef
     or function_record.pronargdefaults <> 14
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0097 refused because the public listing search fingerprint drifted';
  end if;

  alter function public.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) set schema private;

  alter function private.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) set search_path = '';

  revoke all on function private.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) from public, anon, authenticated, service_role;

  grant execute on function private.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) to anon, authenticated, service_role;

  create function public.public_listing_search_page(
    p_kind text,
    p_query text default '',
    p_category text default '',
    p_location_id text default '',
    p_min_price numeric default 0,
    p_max_price numeric default 500000,
    p_min_bedrooms integer default null,
    p_brand text default '',
    p_condition text default '',
    p_fuel_type text default '',
    p_transmission text default '',
    p_sort text default 'newest',
    p_cursor_value text default null,
    p_cursor_id uuid default null,
    p_limit integer default 24
  )
  returns table (
    id uuid,
    kind text,
    seller_id uuid,
    seller_name text,
    contact_phone text,
    contact_whatsapp text,
    contact_email text,
    title text,
    description text,
    price numeric,
    currency text,
    deposit numeric,
    agent_fee numeric,
    additional_fees numeric,
    accepts_offers boolean,
    variants jsonb,
    photos jsonb,
    latitude numeric,
    longitude numeric,
    category text,
    listing_type text,
    status text,
    created_via text,
    views integer,
    created_at timestamptz,
    updated_at timestamptz,
    location jsonb,
    car_details jsonb,
    property_details jsonb,
    machinery_details jsonb,
    cursor_value text
  )
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select *
    from private.public_listing_search_page(
      p_kind,
      p_query,
      p_category,
      p_location_id,
      p_min_price,
      p_max_price,
      p_min_bedrooms,
      p_brand,
      p_condition,
      p_fuel_type,
      p_transmission,
      p_sort,
      p_cursor_value,
      p_cursor_id,
      p_limit
    );
  $$;

  revoke all on function public.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) from public, anon, authenticated, service_role;

  grant execute on function public.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) to anon, authenticated, service_role;

  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'public_listing_search_page'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
    and md5(pg_get_function_result(function_record.oid)) = 'fa68a2b80d7a4dd1844ef87566d01e12'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.pronargdefaults = 14
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '2fa173e978e3d5142ef72c6266e9dc20';

  select count(*)::integer into public_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'public_listing_search_page'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
    and md5(pg_get_function_result(function_record.oid)) = 'fa68a2b80d7a4dd1844ef87566d01e12'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.pronargdefaults = 14
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.public_listing_search_page(' in function_record.prosrc) > 0;

  if private_count <> 1 or public_count <> 1 then
    raise exception '0097 did not create the locked public listing search boundary';
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
      and function_record.proname = 'public_listing_search_page'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0097 left a PUBLIC execute grant on a public listing search function';
  end if;

  if not (
    has_function_privilege(
      'anon',
      'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'anon',
      'private.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'private.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'private.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
      'EXECUTE'
    )
  ) then
    raise exception '0097 did not preserve required public listing search execution grants';
  end if;
end
$migration$;

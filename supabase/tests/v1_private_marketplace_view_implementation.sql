begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'private'
      and function_record.proname = 'record_marketplace_view'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
      and pg_get_function_result(function_record.oid) = 'bigint'
      and function_language.lanname = 'plpgsql'
      and function_record.prosecdef
      and function_record.provolatile = 'v'
      and function_record.proconfig = array['search_path=""']::text[]
      and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '16ed1360668ed6295a3d8ed0e219f55c'
  ),
  1::bigint,
  'one locked volatile SECURITY DEFINER marketplace view implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'public'
      and function_record.proname = 'record_marketplace_view'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
      and pg_get_function_result(function_record.oid) = 'bigint'
      and function_language.lanname = 'sql'
      and not function_record.prosecdef
      and function_record.provolatile = 'v'
      and function_record.proconfig = array['search_path=""']::text[]
      and position('private.record_marketplace_view(p_parent_type, p_parent_id)' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public marketplace view RPC is a locked volatile SECURITY INVOKER wrapper'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(
      function_record.proacl,
      acldefault('f', function_record.proowner)
    )) privilege
    where function_schema.nspname in ('public', 'private')
      and function_record.proname = 'record_marketplace_view'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on either marketplace view function'
);

select extensions.ok(
  has_function_privilege('anon', 'public.record_marketplace_view(text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.record_marketplace_view(text,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.record_marketplace_view(text,uuid)', 'EXECUTE'),
  'public marketplace view wrapper preserves browser and service execution grants'
);

select extensions.ok(
  has_function_privilege('anon', 'private.record_marketplace_view(text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.record_marketplace_view(text,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'private.record_marketplace_view(text,uuid)', 'EXECUTE'),
  'private marketplace view implementation preserves required execution grants'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where position('record_marketplace_view(' in caller.prosrc) > 0
      and not (
        caller_schema.nspname in ('public', 'private')
        and caller.proname = 'record_marketplace_view'
        and pg_get_function_identity_arguments(caller.oid) = 'p_parent_type text, p_parent_id uuid'
      )
  ),
  0::bigint,
  'no stored function depends on the public marketplace view RPC identity'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where position('record_marketplace_view(' in coalesce(policy.qual, '')) > 0
       or position('record_marketplace_view(' in coalesce(policy.with_check, '')) > 0
  ),
  0::bigint,
  'no RLS policy depends on the public marketplace view RPC identity'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('92000000-0000-4000-8000-000000000001', 'view-owner@example.test', '{"full_name":"View Owner"}', now(), now()),
  ('92000000-0000-4000-8000-000000000002', 'view-visitor@example.test', '{"full_name":"View Visitor"}', now(), now());

update public.users
set full_name = case id
      when '92000000-0000-4000-8000-000000000001'::uuid then 'View Owner'
      else 'View Visitor'
    end,
    status = 'active'
where id in (
  '92000000-0000-4000-8000-000000000001'::uuid,
  '92000000-0000-4000-8000-000000000002'::uuid
);

insert into public.locations (id, name, type, country_code)
values ('92000000-0000-4000-8000-000000000010', 'View Counter Test City', 'city', 'ZW');

insert into public.listings (
  id, kind, seller_id, title, price, currency, status, location_id, country_code, views
)
values
  ('92000000-0000-4000-8000-000000000011', 'property', '92000000-0000-4000-8000-000000000001', 'Public counter listing', 100, 'USD', 'available', '92000000-0000-4000-8000-000000000010', 'ZW', 5),
  ('92000000-0000-4000-8000-000000000012', 'property', '92000000-0000-4000-8000-000000000001', 'Paused counter listing', 100, 'USD', 'paused', '92000000-0000-4000-8000-000000000010', 'ZW', 9);

insert into public.services (
  id, provider_id, title, category, status, location_id, views
)
values
  ('92000000-0000-4000-8000-000000000021', '92000000-0000-4000-8000-000000000001', 'Active counter service', 'mechanic', 'active', '92000000-0000-4000-8000-000000000010', 7),
  ('92000000-0000-4000-8000-000000000022', '92000000-0000-4000-8000-000000000001', 'Paused counter service', 'mechanic', 'paused', '92000000-0000-4000-8000-000000000010', 11);

set local role anon;

select extensions.is(
  public.record_marketplace_view('listing', '92000000-0000-4000-8000-000000000011'::uuid),
  6::bigint,
  'anonymous listing view increments and returns the new counter'
);

select extensions.is(
  private.record_marketplace_view('service', '92000000-0000-4000-8000-000000000021'::uuid),
  8::bigint,
  'anonymous direct private service view preserves wrapper semantics'
);

select extensions.is(
  public.record_marketplace_view('listing', '92000000-0000-4000-8000-000000000012'::uuid),
  null::bigint,
  'paused listings do not expose or increment a view count'
);

select extensions.is(
  public.record_marketplace_view('service', '92000000-0000-4000-8000-000000000022'::uuid),
  null::bigint,
  'paused services do not expose or increment a view count'
);

select extensions.is(
  public.record_marketplace_view('listing', '92000000-0000-4000-8000-000000000099'::uuid),
  null::bigint,
  'unknown marketplace parents return no counter'
);

select extensions.throws_ok(
  $$select public.record_marketplace_view('unsupported', '92000000-0000-4000-8000-000000000011'::uuid)$$,
  '22023',
  'unsupported marketplace parent type',
  'unsupported marketplace parent types preserve the canonical safe error'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);

select extensions.is(
  public.record_marketplace_view('listing', '92000000-0000-4000-8000-000000000011'::uuid),
  6::bigint,
  'listing owners receive the current counter without incrementing their own listing'
);

select extensions.is(
  public.record_marketplace_view('service', '92000000-0000-4000-8000-000000000021'::uuid),
  8::bigint,
  'service providers receive the current counter without incrementing their own service'
);

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);

select extensions.is(
  public.record_marketplace_view('listing', '92000000-0000-4000-8000-000000000011'::uuid),
  7::bigint,
  'a different authenticated user increments the listing counter'
);

select extensions.is(
  private.record_marketplace_view('service', '92000000-0000-4000-8000-000000000021'::uuid),
  9::bigint,
  'a different authenticated user increments the service counter through the private implementation'
);

reset role;

select extensions.is(
  (select views::bigint from public.listings where id = '92000000-0000-4000-8000-000000000011'),
  7::bigint,
  'listing counter persisted exactly two non-owner views'
);

select extensions.is(
  (select views::bigint from public.services where id = '92000000-0000-4000-8000-000000000021'),
  9::bigint,
  'service counter persisted exactly two non-owner views'
);

select extensions.is(
  (select views::bigint from public.listings where id = '92000000-0000-4000-8000-000000000012'),
  9::bigint,
  'paused listing counter remains unchanged'
);

select extensions.is(
  (select views::bigint from public.services where id = '92000000-0000-4000-8000-000000000022'),
  11::bigint,
  'paused service counter remains unchanged'
);

select extensions.finish();
rollback;

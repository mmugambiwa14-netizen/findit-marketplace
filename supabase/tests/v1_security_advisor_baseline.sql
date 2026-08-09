begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_row
    join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
    where function_schema.nspname = 'public'
      and function_row.prosecdef
      and has_function_privilege('anon', function_row.oid, 'EXECUTE')
  ),
  0::bigint,
  'anonymous clients cannot execute public SECURITY DEFINER functions'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_row
    join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
    where function_schema.nspname = 'public'
      and function_row.prosecdef
      and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
  ),
  0::bigint,
  'authenticated clients cannot execute public SECURITY DEFINER functions'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_language wrapper_language on wrapper_language.oid = wrapper.prolang
    where wrapper_schema.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and not wrapper.prosecdef
      and wrapper_language.lanname = 'sql'
      and wrapper.proconfig = array['search_path=""']::text[]
  ),
  57::bigint,
  'all authenticated compatibility RPCs remain public SQL invoker wrappers'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc implementation
    join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
    where implementation_schema.nspname = 'private'
      and implementation.prosecdef
      and exists (
        select 1
        from pg_proc wrapper
        join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
        where wrapper_schema.nspname = 'public'
          and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
          and wrapper.proname = implementation.proname
          and pg_get_function_identity_arguments(wrapper.oid)
            = pg_get_function_identity_arguments(implementation.oid)
      )
  ),
  57::bigint,
  'all authenticated privileged implementations remain in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_row
    join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
    cross join lateral aclexplode(coalesce(function_row.proacl, acldefault('f', function_row.proowner))) privilege
    where function_schema.nspname in ('public', 'private')
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no public or private function grants EXECUTE to PUBLIC'
);

with rls_without_policy as (
  select table_row.oid, table_schema.nspname as schema_name, table_row.relname as table_name
  from pg_class table_row
  join pg_namespace table_schema on table_schema.oid = table_row.relnamespace
  where table_schema.nspname = 'public'
    and table_row.relkind in ('r', 'p')
    and table_row.relrowsecurity
    and not exists (
      select 1
      from pg_policy policy
      where policy.polrelid = table_row.oid
    )
), browser_exposure as (
  select schema_name, table_name
  from rls_without_policy
  where has_table_privilege(
      'anon',
      format('%I.%I', schema_name, table_name),
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    )
    or has_table_privilege(
      'authenticated',
      format('%I.%I', schema_name, table_name),
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    )
)
select extensions.is(
  (select count(*)::bigint from browser_exposure),
  0::bigint,
  'RLS tables without policies remain browser-inaccessible and fail closed'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_class table_row
    join pg_namespace table_schema on table_schema.oid = table_row.relnamespace
    where table_schema.nspname = 'private'
      and table_row.relname in (
        'abuse_rate_limit_buckets',
        'location_registry_country_syncs',
        'location_registry_admin1_syncs'
      )
      and table_row.relrowsecurity
  ),
  3::bigint,
  'private synchronization tables retain defense-in-depth RLS'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policy policy_row
    join pg_class table_row on table_row.oid = policy_row.polrelid
    join pg_namespace table_schema on table_schema.oid = table_row.relnamespace
    where table_schema.nspname = 'public'
      and table_row.relname = 'discover_category_count_snapshots'
      and policy_row.polname = 'discover_category_count_snapshots_public_read'
  ),
  1::bigint,
  'category-count projection exposes one intentional public read policy'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_row
    join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
    where function_schema.nspname = 'public'
      and function_row.oid = 'public.discover_category_counts()'::regprocedure
      and not function_row.prosecdef
      and has_function_privilege('anon', function_row.oid, 'EXECUTE')
      and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
  ),
  1::bigint,
  'category-count RPC remains an invoker boundary over the aggregate projection'
);

select extensions.is(
  (
    select configuration ->> 'renderer'
    from public.marketplace_operational_controls
    where control_key = 'maps' and enabled and state = 'enabled'
  ),
  'maplibre-gl',
  'maps operational metadata retains the certified renderer'
);

select extensions.is(
  (
    select configuration ->> 'tile_provider'
    from public.marketplace_operational_controls
    where control_key = 'maps' and enabled and state = 'enabled'
  ),
  'maptiler-cloud',
  'maps operational metadata retains the certified provider'
);

select extensions.is(
  (
    select configuration ->> 'public_location_precision'
    from public.marketplace_operational_controls
    where control_key = 'maps' and enabled and state = 'enabled'
  ),
  'city',
  'maps operational metadata remains city-precision only'
);

select extensions.is(
  (
    select configuration -> 'exact_coordinates_exposed'
    from public.marketplace_operational_controls
    where control_key = 'maps' and enabled and state = 'enabled'
  ),
  'false'::jsonb,
  'maps operational metadata forbids exact public coordinates'
);

select * from extensions.finish();
rollback;

begin;

-- Close authenticated SECURITY DEFINER drift introduced after the 0101 and
-- 20260805073000 private implementation boundaries. The exact final-schema
-- catalogue is locked before any rewrite so an unexpected new privileged RPC
-- fails migration rather than being moved implicitly.
create temporary table findit_20260807042000_expected (
  function_oid regprocedure primary key
) on commit drop;

insert into findit_20260807042000_expected(function_oid)
values
  ('public.get_my_publishing_access()'::regprocedure),
  ('public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])'::regprocedure),
  ('public.submit_managed_listing_request(text,text,text,text,text,text,text,text)'::regprocedure),
  ('public.can_publish_in_category(text)'::regprocedure),
  ('public.admin_list_business_applications(text,integer,timestamptz)'::regprocedure),
  ('public.admin_review_business_application(uuid,text,text)'::regprocedure),
  ('public.admin_review_business_category(uuid,text,text)'::regprocedure),
  ('public.admin_list_managed_listing_requests(text,integer,timestamptz)'::regprocedure),
  ('public.admin_update_managed_listing_request(uuid,text,text,uuid)'::regprocedure),
  ('public.respond_to_business_application(uuid,text)'::regprocedure),
  ('public.request_additional_business_categories(text[])'::regprocedure),
  ('public.get_my_managed_listing_requests()'::regprocedure),
  ('public.accept_peek_request(uuid)'::regprocedure),
  ('public.cancel_peek_request_fulfilment(uuid,text)'::regprocedure),
  ('public.queue_response_peek_binding(uuid,uuid)'::regprocedure),
  ('public.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure),
  ('public.owner_transition_listing(uuid,text)'::regprocedure);

create temporary table findit_20260807042000_snapshot on commit drop as
select
  p.oid,
  p.proname as function_name,
  oidvectortypes(p.proargtypes) as identity_types,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_arguments(p.oid) as full_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language_name,
  p.provolatile,
  p.proretset,
  p.proisstrict,
  p.proparallel,
  p.procost,
  p.prorows,
  p.pronargs,
  p.pronargdefaults,
  p.proconfig,
  pg_get_functiondef(p.oid) as function_definition,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
  obj_description(p.oid, 'pg_proc') as original_comment
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
order by p.proname, pg_get_function_identity_arguments(p.oid);

do $migration$
declare
  target record;
  private_oid regprocedure;
  private_definition text;
  call_arguments text;
  wrapper_body text;
  volatility_clause text;
  strict_clause text;
  parallel_clause text;
  rows_clause text;
  wrapper_sql text;
  final_private_count integer;
  final_wrapper_count integer;
begin
  if (select count(*) from findit_20260807042000_snapshot) <> 17
     or exists (
       select function_oid::oid from findit_20260807042000_expected
       except
       select oid from findit_20260807042000_snapshot
     )
     or exists (
       select oid from findit_20260807042000_snapshot
       except
       select function_oid::oid from findit_20260807042000_expected
     ) then
    raise exception
      '20260807042000 authenticated SECURITY DEFINER catalogue drifted from the locked 17-RPC boundary';
  end if;

  if exists (
    select 1
    from findit_20260807042000_snapshot
    where language_name not in ('sql', 'plpgsql')
       or not authenticated_execute
       or anon_execute
  ) then
    raise exception
      '20260807042000 encountered an unsupported or anonymously callable privileged RPC';
  end if;

  for target in
    select * from findit_20260807042000_snapshot
    order by function_name, identity_arguments
  loop
    private_oid := to_regprocedure(
      format('private.%I(%s)', target.function_name, target.identity_types)
    );

    -- A few functions already have older private implementations from the
    -- previous boundaries. If the later public implementation changed its
    -- return shape (seller_peek_request_queue did), remove only that stale
    -- private implementation before installing the current authoritative body.
    if private_oid is not null
       and pg_get_function_result(private_oid::oid) <> target.result_type then
      execute format(
        'drop function private.%I(%s)',
        target.function_name,
        target.identity_types
      );
    end if;

    private_definition := replace(
      target.function_definition,
      format('FUNCTION public.%I(', target.function_name),
      format('FUNCTION private.%I(', target.function_name)
    );
    if private_definition = target.function_definition then
      raise exception
        '20260807042000 could not qualify private implementation for %',
        target.function_name;
    end if;
    execute private_definition;

    execute format(
      'revoke all on function private.%I(%s) from public, anon, authenticated, service_role',
      target.function_name,
      target.identity_types
    );
    if target.authenticated_execute then
      execute format(
        'grant execute on function private.%I(%s) to authenticated',
        target.function_name,
        target.identity_types
      );
    end if;
    if target.service_execute then
      execute format(
        'grant execute on function private.%I(%s) to service_role',
        target.function_name,
        target.identity_types
      );
    end if;

    select coalesce(string_agg('$' || position::text, ', ' order by position), '')
    into call_arguments
    from generate_series(1, target.pronargs) as generated(position);

    volatility_clause := case target.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;
    strict_clause := case
      when target.proisstrict then 'strict'
      else 'called on null input'
    end;
    parallel_clause := case target.proparallel
      when 's' then 'parallel safe'
      when 'r' then 'parallel restricted'
      else 'parallel unsafe'
    end;
    rows_clause := case
      when target.proretset then format('rows %s', target.prorows)
      else ''
    end;
    wrapper_body := case
      when target.proretset then
        format('select * from private.%I(%s);', target.function_name, call_arguments)
      else
        format('select private.%I(%s);', target.function_name, call_arguments)
    end;

    wrapper_sql := format(
      'create or replace function public.%I(%s) returns %s language sql %s %s security invoker %s cost %s %s set search_path = '''' as $wrapper$%s$wrapper$',
      target.function_name,
      target.full_arguments,
      target.result_type,
      volatility_clause,
      strict_clause,
      parallel_clause,
      target.procost,
      rows_clause,
      wrapper_body
    );
    execute wrapper_sql;

    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated, service_role',
      target.function_name,
      target.identity_types
    );
    if target.authenticated_execute then
      execute format(
        'grant execute on function public.%I(%s) to authenticated',
        target.function_name,
        target.identity_types
      );
    end if;
    if target.service_execute then
      execute format(
        'grant execute on function public.%I(%s) to service_role',
        target.function_name,
        target.identity_types
      );
    end if;

    -- Preserve the original 0101 compatibility marker on
    -- owner_transition_listing; tag only genuinely post-0101 wrappers here.
    if target.original_comment is distinct from 'findit:0101-authenticated-boundary' then
      execute format(
        'comment on function public.%I(%s) is %L',
        target.function_name,
        target.identity_types,
        'findit:20260807042000-authenticated-boundary'
      );
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception
      '20260807042000 left an authenticated public SECURITY DEFINER function';
  end if;

  select count(*)::integer into final_private_count
  from findit_20260807042000_snapshot expected
  join pg_proc implementation
    on implementation.proname = expected.function_name
   and pg_get_function_identity_arguments(implementation.oid) = expected.identity_arguments
  join pg_namespace n on n.oid = implementation.pronamespace
  where n.nspname = 'private'
    and implementation.prosecdef
    and pg_get_function_result(implementation.oid) = expected.result_type
    and implementation.provolatile = expected.provolatile
    and implementation.proretset = expected.proretset
    and implementation.proisstrict = expected.proisstrict
    and implementation.proparallel = expected.proparallel
    and implementation.procost = expected.procost
    and implementation.prorows = expected.prorows
    and implementation.pronargdefaults = expected.pronargdefaults;

  select count(*)::integer into final_wrapper_count
  from findit_20260807042000_snapshot expected
  join pg_proc wrapper
    on wrapper.proname = expected.function_name
   and pg_get_function_identity_arguments(wrapper.oid) = expected.identity_arguments
  join pg_namespace n on n.oid = wrapper.pronamespace
  join pg_language l on l.oid = wrapper.prolang
  where n.nspname = 'public'
    and l.lanname = 'sql'
    and not wrapper.prosecdef
    and wrapper.proconfig = array['search_path=""']::text[]
    and pg_get_function_result(wrapper.oid) = expected.result_type
    and wrapper.provolatile = expected.provolatile
    and wrapper.proretset = expected.proretset
    and wrapper.proisstrict = expected.proisstrict
    and wrapper.proparallel = expected.proparallel
    and wrapper.procost = expected.procost
    and wrapper.prorows = expected.prorows
    and wrapper.pronargdefaults = expected.pronargdefaults
    and position('private.' || expected.function_name || '(' in wrapper.prosrc) > 0;

  if final_private_count <> 17 or final_wrapper_count <> 17 then
    raise exception
      '20260807042000 did not preserve all implementations/wrappers: private %, public %',
      final_private_count,
      final_wrapper_count;
  end if;

  if exists (
    select 1
    from findit_20260807042000_snapshot expected
    join pg_proc wrapper
      on wrapper.proname = expected.function_name
     and pg_get_function_identity_arguments(wrapper.oid) = expected.identity_arguments
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_proc implementation
      on implementation.proname = expected.function_name
     and pg_get_function_identity_arguments(implementation.oid) = expected.identity_arguments
    join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
    where wrapper_schema.nspname = 'public'
      and implementation_schema.nspname = 'private'
      and (
        has_function_privilege('anon', wrapper.oid, 'EXECUTE') <> expected.anon_execute
        or has_function_privilege('anon', implementation.oid, 'EXECUTE') <> expected.anon_execute
        or has_function_privilege('authenticated', wrapper.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('authenticated', implementation.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('service_role', wrapper.oid, 'EXECUTE') <> expected.service_execute
        or has_function_privilege('service_role', implementation.oid, 'EXECUTE') <> expected.service_execute
      )
  ) then
    raise exception
      '20260807042000 did not preserve the named-role execution matrix';
  end if;

  if (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and obj_description(p.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and not p.prosecdef
  ) <> 57 then
    raise exception
      '20260807042000 did not restore all 57 original 0101 invoker wrappers';
  end if;
end;
$migration$;

commit;

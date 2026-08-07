begin;

-- Preserve the historical provenance markers for the two RPCs that were
-- already part of the 20260805073000 authenticated boundary and were later
-- redefined by Peek fulfilment work. The 20260807042000 closure correctly
-- restored their invoker/private shape; this migration restores only their
-- original boundary attribution.
comment on function public.queue_response_peek_binding(uuid, uuid) is
  'findit:20260805073000-authenticated-boundary';
comment on function public.seller_peek_request_queue(bigint, timestamptz, uuid, integer) is
  'findit:20260805073000-authenticated-boundary';

-- discover_category_counts was never one of the 22 privileged functions moved
-- by 20260805073000. It was born as a bounded SECURITY INVOKER public read RPC
-- and must remain that way rather than being needlessly promoted to a private
-- SECURITY DEFINER implementation.
do $migration$
declare
  discover_oid regprocedure := to_regprocedure('public.discover_category_counts()');
  discover_language name;
begin
  if discover_oid is null then
    raise exception 'discover_category_counts() is missing';
  end if;

  select language.lanname
  into discover_language
  from pg_proc function
  join pg_language language on language.oid = function.prolang
  where function.oid = discover_oid::oid;

  if discover_language <> 'sql'
     or (select prosecdef from pg_proc where oid = discover_oid::oid)
     or (select proconfig from pg_proc where oid = discover_oid::oid) <> array['search_path=""']::text[]
     or not has_function_privilege('anon', discover_oid, 'EXECUTE')
     or not has_function_privilege('authenticated', discover_oid, 'EXECUTE')
     or to_regprocedure('private.discover_category_counts()') is not null then
    raise exception
      'discover_category_counts() drifted from its direct public SECURITY INVOKER read boundary';
  end if;

  if (
    select count(*)
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and obj_description(function.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
  ) <> 22 then
    raise exception
      '20260805073000 provenance must identify exactly the historical 22 RPC wrappers';
  end if;
end;
$migration$;

commit;

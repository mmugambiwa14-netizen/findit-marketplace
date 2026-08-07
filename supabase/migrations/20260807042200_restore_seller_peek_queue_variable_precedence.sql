begin;

-- The post-boundary RPC closure correctly replaced the stale private seller
-- Peek queue implementation with the latest authoritative fulfilment-aware
-- body. That replacement also removed the PL/pgSQL variable-precedence
-- directive previously applied by 20260805074500. Restore that parser guard
-- without changing the queue contract, grants, implementation schema or body.
do $migration$
declare
  target_oid regprocedure := to_regprocedure(
    'private.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'
  );
  original_definition text;
  corrected_definition text;
begin
  if target_oid is null then
    raise exception 'private seller_peek_request_queue is missing';
  end if;

  if not (select prosecdef from pg_proc where oid = target_oid::oid) then
    raise exception 'private seller_peek_request_queue must remain SECURITY DEFINER';
  end if;

  select replace(pg_get_functiondef(target_oid::oid), E'\r\n', E'\n')
  into original_definition;

  if position('#variable_conflict use_column' in original_definition) = 0 then
    corrected_definition := replace(
      original_definition,
      E'AS $function$\n',
      E'AS $function$\n#variable_conflict use_column\n'
    );

    if corrected_definition = original_definition then
      raise exception 'could not restore seller Peek queue variable precedence';
    end if;

    execute corrected_definition;
  end if;

  select replace(pg_get_functiondef(target_oid::oid), E'\r\n', E'\n')
  into corrected_definition;

  if position('#variable_conflict use_column' in corrected_definition) = 0 then
    raise exception 'seller Peek queue variable precedence was not restored';
  end if;

  if to_regprocedure('public.seller_peek_request_queue(bigint,timestamptz,uuid,integer)') is null
     or (select prosecdef from pg_proc where oid = 'public.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure::oid)
     or (select proconfig from pg_proc where oid = 'public.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure::oid)
        <> array['search_path=""']::text[]
     or not has_function_privilege(
       'authenticated',
       'public.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure,
       'EXECUTE'
     ) then
    raise exception 'seller Peek queue public invoker boundary drifted';
  end if;

  if exists (
    select 1
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.prosecdef
      and has_function_privilege('authenticated', function.oid, 'EXECUTE')
  ) then
    raise exception 'authenticated public SECURITY DEFINER drift reappeared';
  end if;
end;
$migration$;

commit;

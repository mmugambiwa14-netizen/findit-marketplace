begin;

-- Hosted staging was created from an older, partially applied migration line.
-- Converge the pre-curated-marketplace authenticated RPC boundary without
-- rewriting the later Aug-6/Aug-7 RPCs. On a fresh canonical database the
-- normal 20260805073000 and 20260807042000 boundaries have already converged
-- these objects, so this migration validates and no-ops there.

create temporary table findit_20260807130000_targets(signature text primary key) on commit drop;
insert into findit_20260807130000_targets(signature) values
  ('bind_response_peek(uuid,uuid[])'),
  ('create_peek_request(uuid,uuid,public.peek_request_category,text)'),
  ('decline_peek_request(uuid,text)'),
  ('disable_web_push_subscription(text)'),
  ('merge_peek_request(uuid,uuid)'),
  ('my_peek_request_ids(uuid[])'),
  ('owner_listing_contacts(uuid[])'),
  ('owner_service_contacts(uuid[])'),
  ('peek_thread_page(uuid,uuid,text,text,integer,timestamptz,uuid,integer)'),
  ('prepare_own_account_deletion(text)'),
  ('public_response_peek_metadata(uuid)'),
  ('public_tour_view_counts(uuid[])'),
  ('record_public_tour_view(uuid,uuid)'),
  ('register_web_push_subscription(text,text,text,text,text)'),
  ('response_peek_request_candidates(uuid)'),
  ('reveal_listing_contact(uuid)'),
  ('reveal_service_contact(uuid)'),
  ('seller_unbound_response_peeks()'),
  ('support_peek_request(uuid)'),
  ('withdraw_peek_request_support(uuid)');

do $migration$
declare
  target record;
  public_oid regprocedure;
  private_oid regprocedure;
  function_name text;
  identity_types text;
  full_arguments text;
  result_type text;
  language_name text;
  volatility "char";
  returns_set boolean;
  is_strict boolean;
  parallel_mode "char";
  function_cost real;
  function_rows real;
  nargs smallint;
  anon_execute boolean;
  authenticated_execute boolean;
  service_execute boolean;
  call_arguments text;
  wrapper_body text;
  volatility_clause text;
  strict_clause text;
  parallel_clause text;
  rows_clause text;
  wrapper_sql text;
  public_is_definer boolean;
begin
  for target in select signature from findit_20260807130000_targets order by signature loop
    public_oid := to_regprocedure('public.' || target.signature);
    private_oid := to_regprocedure('private.' || target.signature);

    if public_oid is null then
      raise exception '20260807130000 missing public RPC %', target.signature;
    end if;

    select p.prosecdef into public_is_definer from pg_proc p where p.oid = public_oid::oid;

    if not public_is_definer then
      if private_oid is null then
        raise exception '20260807130000 invoker wrapper % has no private implementation', target.signature;
      end if;
      continue;
    end if;

    if private_oid is not null then
      raise exception '20260807130000 refuses to overwrite existing private implementation %', target.signature;
    end if;

    select
      p.proname,
      oidvectortypes(p.proargtypes),
      pg_get_function_arguments(p.oid),
      pg_get_function_result(p.oid),
      l.lanname,
      p.provolatile,
      p.proretset,
      p.proisstrict,
      p.proparallel,
      p.procost,
      p.prorows,
      p.pronargs,
      has_function_privilege('anon', p.oid, 'EXECUTE'),
      has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      has_function_privilege('service_role', p.oid, 'EXECUTE')
    into
      function_name, identity_types, full_arguments, result_type, language_name,
      volatility, returns_set, is_strict, parallel_mode, function_cost,
      function_rows, nargs, anon_execute, authenticated_execute, service_execute
    from pg_proc p
    join pg_language l on l.oid = p.prolang
    where p.oid = public_oid::oid;

    if language_name not in ('sql', 'plpgsql') then
      raise exception '20260807130000 unsupported language for %', target.signature;
    end if;

    execute format('alter function public.%I(%s) set schema private', function_name, identity_types);

    select coalesce(string_agg('$' || position::text, ', ' order by position), '')
      into call_arguments
    from generate_series(1, nargs) as generated(position);

    volatility_clause := case volatility when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end;
    strict_clause := case when is_strict then 'strict' else 'called on null input' end;
    parallel_clause := case parallel_mode when 's' then 'parallel safe' when 'r' then 'parallel restricted' else 'parallel unsafe' end;
    rows_clause := case when returns_set then format('rows %s', function_rows) else '' end;
    wrapper_body := case
      when returns_set then format('select * from private.%I(%s);', function_name, call_arguments)
      else format('select private.%I(%s);', function_name, call_arguments)
    end;

    wrapper_sql := format(
      'create function public.%I(%s) returns %s language sql %s %s security invoker %s cost %s %s set search_path = '''' as $wrapper$%s$wrapper$',
      function_name, full_arguments, result_type, volatility_clause,
      strict_clause, parallel_clause, function_cost, rows_clause, wrapper_body
    );
    execute wrapper_sql;

    execute format('revoke all on function public.%I(%s) from public, anon, authenticated, service_role', function_name, identity_types);
    execute format('revoke all on function private.%I(%s) from public, anon, authenticated, service_role', function_name, identity_types);
    if anon_execute then
      execute format('grant execute on function public.%I(%s) to anon', function_name, identity_types);
      execute format('grant execute on function private.%I(%s) to anon', function_name, identity_types);
    end if;
    if authenticated_execute then
      execute format('grant execute on function public.%I(%s) to authenticated', function_name, identity_types);
      execute format('grant execute on function private.%I(%s) to authenticated', function_name, identity_types);
    end if;
    if service_execute then
      execute format('grant execute on function public.%I(%s) to service_role', function_name, identity_types);
      execute format('grant execute on function private.%I(%s) to service_role', function_name, identity_types);
    end if;

    execute format(
      'comment on function public.%I(%s) is %L',
      function_name, identity_types, 'findit:20260807130000-hosted-convergence'
    );
  end loop;

  public_oid := to_regprocedure('public.apply_pending_response_peek_binding()');
  private_oid := to_regprocedure('private.apply_pending_response_peek_binding()');
  if public_oid is not null and private_oid is null then
    alter function public.apply_pending_response_peek_binding() set schema private;
  elsif public_oid is not null and private_oid is not null then
    raise exception '20260807130000 duplicate response binding trigger implementation';
  elsif public_oid is null and private_oid is null then
    raise exception '20260807130000 response binding trigger implementation missing';
  end if;
  revoke all on function private.apply_pending_response_peek_binding()
    from public, anon, authenticated, service_role;
end;
$migration$;

-- Staging carried the pre-correction SECURITY DEFINER variant. Restore the
-- canonical invoker implementation exactly; this is also idempotent after the
-- canonical Aug-4 correction.
create or replace function public.discover_category_counts()
returns table(category_key text, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with listing_counts as (
    select c.marketplace_kind as category_key, count(*)::bigint as item_count
    from public.listings l
    join public.categories c
      on c.slug = l.category
     and c.marketplace_kind in ('property', 'car', 'machinery')
     and c.is_active = true
    where l.status in ('available'::public.listing_status, 'under_offer'::public.listing_status)
      and (l.expires_at is null or l.expires_at > now())
      and l.content_suspended_at is null
    group by c.marketplace_kind
  ), service_count as (
    select 'service'::text as category_key, count(*)::bigint as item_count
    from public.services s
    where s.status = 'active'::public.service_status
  ), keys(category_key) as (
    values ('property'::text), ('car'::text), ('machinery'::text), ('service'::text)
  )
  select k.category_key, coalesce(lc.item_count, sc.item_count, 0)::bigint
  from keys k
  left join listing_counts lc using (category_key)
  left join service_count sc using (category_key)
  order by case k.category_key
    when 'property' then 1
    when 'car' then 2
    when 'machinery' then 3
    else 4
  end;
$$;
revoke all on function public.discover_category_counts() from public;
grant execute on function public.discover_category_counts() to anon, authenticated;

-- A drifted hosted database reaches this migration before the canonical Aug-7
-- wrapper hardening and therefore has the locked 17 later privileged RPCs.
-- A fresh canonical reset reaches it after that hardening and therefore has 0.
-- Reject every other state.
do $migration$
declare
  actual_count integer;
begin
  select count(*)::integer into actual_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if actual_count not in (0, 17) then
    raise exception '20260807130000 expected canonical 0 or hosted-pre-hardening 17 authenticated public SECURITY DEFINER RPCs, found %', actual_count;
  end if;

  if actual_count = 17 and exists (
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    except
    select unnest(array[
      'get_my_publishing_access()'::text,
      'submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])'::text,
      'submit_managed_listing_request(text,text,text,text,text,text,text,text)'::text,
      'can_publish_in_category(text)'::text,
      'admin_list_business_applications(text,integer,timestamp with time zone)'::text,
      'admin_review_business_application(uuid,text,text)'::text,
      'admin_review_business_category(uuid,text,text)'::text,
      'admin_list_managed_listing_requests(text,integer,timestamp with time zone)'::text,
      'admin_update_managed_listing_request(uuid,text,text,uuid)'::text,
      'respond_to_business_application(uuid,text)'::text,
      'request_additional_business_categories(text[])'::text,
      'get_my_managed_listing_requests()'::text,
      'accept_peek_request(uuid)'::text,
      'cancel_peek_request_fulfilment(uuid,text)'::text,
      'queue_response_peek_binding(uuid,uuid)'::text,
      'seller_peek_request_queue(bigint,timestamp with time zone,uuid,integer)'::text,
      'owner_transition_listing(uuid,text)'::text
    ])
  ) then
    raise exception '20260807130000 remaining privileged RPC catalogue differs from the locked Aug-7 boundary';
  end if;
end;
$migration$;

commit;

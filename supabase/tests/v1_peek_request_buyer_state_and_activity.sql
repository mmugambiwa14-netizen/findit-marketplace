begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.ok(
  to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)') is not null
  and to_regprocedure('private.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)') is not null,
  'Peek Request feed v2 has a public wrapper and private implementation'
);

select extensions.ok(
  (
    select not p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)')
  )
  and (
    select p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=""']::text[]
    from pg_proc p
    where p.oid = to_regprocedure('private.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)')
  ),
  'Peek Request feed v2 keeps privilege in a stable private implementation behind an invoker wrapper'
);

select extensions.ok(
  position(
    'private.is_peek_parent_public'
    in pg_get_functiondef(to_regprocedure('private.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'))
  ) > 0
  and position(
    'request.status in (''pending'', ''answered'')'
    in pg_get_functiondef(to_regprocedure('private.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'))
  ) > 0,
  'v2 restores explicit public-parent visibility and limits the public feed to pending or safely answered requests'
);

select extensions.ok(
  position(
    'requested_by_me boolean'
    in pg_get_function_result(to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'))
  ) > 0
  and position(
    'supported_by_me boolean'
    in pg_get_function_result(to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'))
  ) > 0
  and position(
    'requester_id'
    in pg_get_function_result(to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'))
  ) = 0
  and position(
    'user_id'
    in pg_get_function_result(to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'))
  ) = 0,
  'v2 exposes only caller-relative booleans and no requester or supporter identity'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'),
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    to_regprocedure('public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'),
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    to_regprocedure('public.peek_thread_page(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'),
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    to_regprocedure('public.peek_thread_page(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)'),
    'EXECUTE'
  ),
  'browser roles use v2 and cannot call the legacy public Peek Request feed'
);

select extensions.ok(
  to_regprocedure('public.my_peek_request_activity_page(timestamp with time zone,uuid,integer)') is not null
  and to_regprocedure('private.my_peek_request_activity_page(timestamp with time zone,uuid,integer)') is not null
  and not has_function_privilege(
    'anon',
    to_regprocedure('public.my_peek_request_activity_page(timestamp with time zone,uuid,integer)'),
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    to_regprocedure('public.my_peek_request_activity_page(timestamp with time zone,uuid,integer)'),
    'EXECUTE'
  ),
  'buyer activity is available only to authenticated callers'
);

select extensions.ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'peek_requests'
      and indexname = 'idx_peek_requests_requester_activity'
  ),
  'buyer request activity has a requester-time index'
);

set local role anon;
select extensions.throws_ok(
  $$select * from public.peek_thread_page_v2()$$,
  '22023',
  'exactly one Peek Request parent is required',
  'v2 validates its single-parent boundary for anonymous callers'
);
reset role;

select * from extensions.finish();
rollback;

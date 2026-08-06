begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.ok(
  has_schema_privilege('anon', 'private', 'USAGE')
  and has_schema_privilege('authenticated', 'private', 'USAGE'),
  'client roles can resolve explicitly granted private implementations and policy helpers'
);

select extensions.ok(
  not has_schema_privilege('anon', 'private', 'CREATE')
  and not has_schema_privilege('authenticated', 'private', 'CREATE'),
  'client roles cannot create objects in private'
);

select extensions.ok(
  not has_function_privilege('anon', 'private.assert_contact_reveal_budget(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.assert_contact_reveal_budget(uuid)', 'EXECUTE'),
  'private contact-reveal budget helper remains closed'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
    where n.nspname in ('public', 'private')
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'PUBLIC has no execute grants on public or private functions'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.web_push_delivery_jobs', 'SELECT')
  and not has_table_privilege('authenticated', 'public.web_push_delivery_jobs', 'SELECT'),
  'browser roles cannot read web push delivery jobs'
);

select extensions.like(
  pg_get_functiondef('private.notification_rows(text,boolean,integer,integer)'::regprocedure),
  '%peek_request_created%',
  'offset notification projection supports Peek request creation events'
);

select extensions.like(
  pg_get_functiondef('private.notification_rows(text,boolean,integer,integer)'::regprocedure),
  '%peek_request_answered%',
  'offset notification projection supports answered Peek requests'
);

select extensions.like(
  pg_get_functiondef('private.notification_rows_page(text,boolean,timestamptz,uuid,integer)'::regprocedure),
  '%tour_ready%',
  'keyset notification projection supports ready Peek media events'
);

select extensions.like(
  pg_get_functiondef('private.notification_rows_page(text,boolean,timestamptz,uuid,integer)'::regprocedure),
  '%saved_listing_unavailable%',
  'keyset notification projection supports saved-listing availability events'
);

select * from extensions.finish();
rollback;

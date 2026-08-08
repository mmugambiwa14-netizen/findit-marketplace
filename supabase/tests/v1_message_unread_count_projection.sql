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
      and function_record.proname = 'message_unread_count'
      and function_language.lanname = 'plpgsql'
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and pg_get_function_identity_arguments(function_record.oid) = ''
      and pg_get_function_result(function_record.oid) = 'bigint'
  ),
  1::bigint,
  'one private stable unread-count implementation exists'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'public'
      and function_record.proname = 'message_unread_count'
      and function_language.lanname = 'sql'
      and not function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and position('private.message_unread_count()' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public security-invoker unread-count wrapper exists'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.message_unread_count()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.message_unread_count()', 'EXECUTE')
  and has_function_privilege('service_role', 'public.message_unread_count()', 'EXECUTE'),
  'unread count wrapper is authenticated-only and service callable'
);

select extensions.ok(
  has_function_privilege('authenticated', 'private.message_unread_count()', 'EXECUTE')
  and has_function_privilege('service_role', 'private.message_unread_count()', 'EXECUTE'),
  'private implementation retains wrapper execution grants'
);

select extensions.ok(
  (
    select position('conversation.buyer_id = current_user_id' in function_record.prosrc) > 0
      and position('conversation.seller_id = current_user_id' in function_record.prosrc) > 0
      and position('union all' in lower(function_record.prosrc)) > 0
      and position('buyer_last_seen_at' in function_record.prosrc) > 0
      and position('seller_last_seen_at' in function_record.prosrc) > 0
      and position('public.listings' in function_record.prosrc) = 0
      and position('public.users' in function_record.prosrc) = 0
      and position('public.inquiries' in function_record.prosrc) = 0
      and position('listing_tour' in function_record.prosrc) = 0
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'message_unread_count'
  ),
  'unread count stays on participant conversation state without inbox hydration joins'
);

select extensions.ok(
  to_regclass('public.conversations_buyer_inbox') is not null
  and to_regclass('public.conversations_seller_inbox') is not null,
  'unread count retains both participant inbox indexes'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(function_record.proacl, acldefault('f', function_record.proowner))) privilege
    where function_schema.nspname in ('public', 'private')
      and function_record.proname = 'message_unread_count'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'unread count leaves no PUBLIC execute grant'
);

select * from extensions.finish();
rollback;

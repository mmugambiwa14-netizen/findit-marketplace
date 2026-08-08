-- 20260808071000_restore_private_policy_helper_schema_usage.sql
--
-- The abuse-rate-limit foundation correctly keeps its bucket table and limiter
-- primitives private, but its schema-level REVOKE also removed the USAGE that
-- existing RLS/storage policy helpers require. Those helpers already carry
-- explicit per-function EXECUTE grants and `private` is not an exposed
-- PostgREST schema. Restore only schema USAGE for browser roles while keeping
-- CREATE, limiter-table access and limiter-function execution denied.

begin;

grant usage on schema private to anon, authenticated;
revoke create on schema private from public, anon, authenticated;

do $migration$
declare
  authenticated_helper_count integer;
  anon_helper_count integer;
begin
  if not has_schema_privilege('anon', 'private', 'USAGE')
     or not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'policy-helper schema usage was not restored';
  end if;

  if has_schema_privilege('anon', 'private', 'CREATE')
     or has_schema_privilege('authenticated', 'private', 'CREATE') then
    raise exception 'browser roles unexpectedly gained CREATE on private schema';
  end if;

  select count(*)::integer into authenticated_helper_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in (
      'can_read_listing_context',
      'has_active_tour_upload_intent',
      'has_valid_listing_upload_intent',
      'has_valid_marketplace_image_upload_intent',
      'is_attached_marketplace_image',
      'is_public_marketplace_image'
    )
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if authenticated_helper_count <> 6 then
    raise exception 'expected six authenticated policy-helper EXECUTE grants, found %', authenticated_helper_count;
  end if;

  select count(*)::integer into anon_helper_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in ('can_read_listing_context', 'is_public_marketplace_image')
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if anon_helper_count <> 2 then
    raise exception 'expected two anonymous policy-helper EXECUTE grants, found %', anon_helper_count;
  end if;

  if has_table_privilege('anon', 'private.abuse_rate_limit_buckets', 'SELECT')
     or has_table_privilege('authenticated', 'private.abuse_rate_limit_buckets', 'SELECT') then
    raise exception 'restoring schema USAGE exposed abuse bucket rows';
  end if;

  if has_function_privilege(
       'anon',
       'private.consume_abuse_rate_limit(text,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.consume_abuse_rate_limit(text,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'private.require_abuse_rate_limit(text,text,integer,integer,text,text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.require_abuse_rate_limit(text,text,integer,integer,text,text,integer)',
       'EXECUTE'
     ) then
    raise exception 'restoring schema USAGE exposed abuse limiter primitives';
  end if;
end;
$migration$;

commit;

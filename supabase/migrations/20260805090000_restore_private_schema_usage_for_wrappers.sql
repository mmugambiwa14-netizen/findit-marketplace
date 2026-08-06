begin;

-- Restore USAGE on schema private for the PostgREST client roles.
--
-- 0109_seller_contact_reveal_boundary.sql ran `revoke all on schema private
-- from anon, authenticated`, on the stated assumption that "the SECURITY
-- DEFINER callers below run as owner". That is true of the reveal helpers it
-- introduced, but it is not true of the compatibility layer built by
-- 0088/0101/20260805073000: those migrations move SECURITY DEFINER
-- implementations into private and leave `security invoker` wrappers in public.
-- An invoker wrapper resolves private.<fn> as the calling role, so it needs
-- USAGE on the schema.
--
-- The two intents contradict each other, and the contradiction is visible in
-- the catalog: those migrations grant EXECUTE on 111 of the 115 private
-- functions to authenticated (25 to anon), which is only meaningful if those
-- roles can reach the schema at all.
--
-- Without this, on a clean database every one of the 98 public invoker wrappers
-- fails for anon and authenticated with:
--
--   42501: permission denied for schema private
--
-- That includes public.is_admin() and public.is_active_user(), which the
-- protect_* trigger functions call, so no signed-in user can update their own
-- listing, service, business profile or user profile.
--
-- Only USAGE is restored. CREATE stays revoked, so client roles still cannot
-- add objects to private. This does not widen the PostgREST surface: PostgREST
-- exposes only the schemas in its `db-schemas` setting (public), so private
-- remains unreachable as an API namespace regardless of USAGE.
grant usage on schema private to anon, authenticated;

-- Fail closed if the boundary is not what this migration expects.
do $migration$
declare
  private_acl text;
  broken_wrappers integer;
begin
  select coalesce(nspacl::text, '') into private_acl
  from pg_namespace where nspname = 'private';

  if private_acl not like '%anon=U/%' or private_acl not like '%authenticated=U/%' then
    raise exception 'private schema USAGE was not restored: %', private_acl;
  end if;

  -- CREATE must not have come back with it.
  if private_acl like '%anon=UC/%' or private_acl like '%authenticated=UC/%' then
    raise exception 'private schema CREATE must stay revoked: %', private_acl;
  end if;

  -- Every public invoker wrapper that delegates into private must now be
  -- callable by the roles that were granted EXECUTE on its implementation.
  select count(*)::integer into broken_wrappers
  from pg_proc wrapper
  join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
  where wrapper_schema.nspname = 'public'
    and not wrapper.prosecdef
    and wrapper.prosrc ~ 'private\.'
    and has_function_privilege('authenticated', wrapper.oid, 'EXECUTE')
    and not has_schema_privilege('authenticated', 'private', 'USAGE');

  if broken_wrappers <> 0 then
    raise exception
      '% public wrappers remain unreachable through the private boundary',
      broken_wrappers;
  end if;
end
$migration$;

commit;

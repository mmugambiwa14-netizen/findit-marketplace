-- 0110_revoke_rls_bypassing_grants.sql
--
-- TRUNCATE is not governed by row level security. Postgres checks the
-- table-level TRUNCATE privilege and then empties the table; policies are
-- never consulted. The stock Supabase default privilege set
-- (`alter default privileges in schema public grant all on tables to anon,
-- authenticated, service_role`) therefore hands every browser client holding
-- the public anon key an irreversible data-destruction primitive on every
-- table in the public schema -- regardless of how correct the RLS policies are.
--
-- Demonstrated on staging before this migration: a table with RLS ENABLED and
-- ZERO policies (the most restrictive configuration available) was truncated
-- successfully while acting as `anon`. Row count went 1 -> 0.
--
-- TRIGGER and REFERENCES are revoked for the same reason: neither is filtered
-- by RLS, and no browser client has a legitimate use for either.
--
-- SELECT / INSERT / UPDATE / DELETE are deliberately left in place. Those are
-- the operations RLS does govern, and they are how the Supabase client model
-- is designed to work.
--
-- service_role is intentionally untouched. It is the trusted server-side role
-- and already bypasses RLS by design.

-- 1. Existing tables --------------------------------------------------------

do $$
declare
  target record;
begin
  for target in
    select c.oid::regclass as relation
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format(
      'revoke truncate, trigger, references on %s from anon, authenticated',
      target.relation
    );
  end loop;
end
$$;

-- 2. Future tables ----------------------------------------------------------
-- Migrations in this project run as `postgres`, so that is the grantor whose
-- default privilege set applies to newly created tables.

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

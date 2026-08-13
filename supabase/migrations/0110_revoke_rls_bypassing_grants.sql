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

-- A clean Supabase database does not reliably materialize the trusted role's
-- DML privileges on tables created by migrations.  Establish that backend
-- boundary explicitly while keeping non-RLS-gated destructive privileges out
-- of the browser roles.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Preserve the narrower service-role boundaries established by the
-- recommendation runtime.  The trusted role may execute the runtime APIs,
-- but it must not mutate control-plane policy, contextual configuration, or
-- the private abuse ledgers directly.
revoke insert, update, delete on table public.recommendation_service_policies from service_role;
grant select on table public.recommendation_service_policies to service_role;

revoke insert, update, delete on table public.recommendation_contexts from service_role;
revoke insert, update, delete on table public.recommendation_context_rules from service_role;
grant select on table public.recommendation_contexts to service_role;
grant select on table public.recommendation_context_rules to service_role;

revoke all on table public.recommendation_service_circuit_state from service_role;
revoke all on table public.recommendation_request_budget from service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant usage, select, update on sequences to service_role;

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

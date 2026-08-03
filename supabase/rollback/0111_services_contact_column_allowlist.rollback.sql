-- 0111_services_contact_column_allowlist.rollback.sql
--
-- WARNING: restores the table-level SELECT grant on public.services to `anon`,
-- which re-exposes contact_phone, contact_whatsapp and contact_email. A
-- table-level grant covers every column and cannot be narrowed per column --
-- that is exactly why 0111 replaced it with an explicit allowlist.
--
-- Also restores anonymous INSERT/UPDATE/DELETE. Those are dead privilege: every
-- write policy in this schema requires is_active_user() or a non-null
-- auth.uid(), so no anonymous write can satisfy one. They are restored purely
-- to return the database to its pre-0111 state.

revoke select on public.services from anon;
grant select on public.services to anon;

do $$
declare
  target record;
begin
  for target in
    select c.oid::regclass as relation
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('grant insert, update, delete on %s to anon', target.relation);
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  grant insert, update, delete on tables to anon;

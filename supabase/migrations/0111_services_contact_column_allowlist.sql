-- 0111_services_contact_column_allowlist.sql
--
-- 0109 revoked the contact columns on public.services from `anon`, but the
-- revoke was a no-op: `anon` holds a TABLE-level SELECT grant on services,
-- which covers every column and cannot be narrowed by revoking individual
-- columns. Verified after 0109 -- `set role anon; select count(contact_phone)
-- from public.services` still returned 5.
--
-- public.listings was already configured the correct way (no table-level grant
-- for anon, only an explicit column allowlist). This brings services in line.
--
-- The allowlist is built dynamically from the live column list so that new
-- columns are NOT silently exposed -- a column added later is excluded until
-- someone deliberately grants it.
--
-- Additionally: `anon` is by definition unauthenticated, and every INSERT /
-- UPDATE / DELETE policy in this schema requires is_active_user() or a
-- non-null auth.uid(). No write by `anon` can ever satisfy a policy, so the
-- write grants are dead privilege. Removing them is least-privilege and means
-- a future policy mistake cannot turn into an anonymous write.

-- 1. Replace the table-level SELECT grant with an explicit column allowlist ---

revoke select on public.services from anon;

do $$
declare
  allowed text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into allowed
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'services'
    and column_name not in ('contact_phone', 'contact_whatsapp', 'contact_email');

  execute format('grant select (%s) on public.services to anon', allowed);
end
$$;

-- 2. Drop dead write privilege for the anonymous role -----------------------

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
    execute format('revoke insert, update, delete on %s from anon', target.relation);
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

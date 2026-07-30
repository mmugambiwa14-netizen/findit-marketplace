-- Staging-only operational repair for repository migration 0088.
--
-- The managed apply-migration API recorded a generated timestamp version after
-- applying the exact private authorization helper implementation migration.
-- This script changes migration ledger metadata only after exact name,
-- statement hash and statement length verification. It does not execute or
-- reverse function, policy, grant or application-data changes.
--
-- Do not run against production.

begin;

lock table supabase_migrations.schema_migrations
  in share row exclusive mode;

do $repair$
declare
  matching_rows integer;
  canonical_rows integer;
  source_version text;
begin
  select count(*)
  into canonical_rows
  from supabase_migrations.schema_migrations
  where version = '0088';

  select count(*), min(version)
  into matching_rows, source_version
  from supabase_migrations.schema_migrations
  where name = 'private_authorization_helper_implementations'
    and md5(array_to_string(statements, E'\n')) = '2c4078e78456c67bd0b308674c2569ff'
    and length(array_to_string(statements, E'\n')) = 9200;

  if canonical_rows = 1 and matching_rows = 1 and source_version = '0088' then
    return;
  end if;

  if canonical_rows <> 0 then
    raise exception 'canonical migration version 0088 is already occupied';
  end if;

  if matching_rows <> 1 or source_version is null then
    raise exception 'expected exactly one verified source row for migration 0088, found %',
      matching_rows;
  end if;

  if source_version !~ '^20260730[0-9]{6}$' then
    raise exception 'refusing unexpected source version % for migration 0088',
      source_version;
  end if;

  update supabase_migrations.schema_migrations
  set version = '0088'
  where version = source_version
    and name = 'private_authorization_helper_implementations'
    and md5(array_to_string(statements, E'\n')) = '2c4078e78456c67bd0b308674c2569ff'
    and length(array_to_string(statements, E'\n')) = 9200;

  if not found then
    raise exception 'migration ledger update did not affect migration 0088';
  end if;
end;
$repair$;

commit;

-- Staging-only operational repair for repository migration 0084.
--
-- The managed apply-migration API recorded a generated timestamp version after
-- applying the exact recommendation foreign-key index migration. This script
-- changes migration ledger metadata only after exact name, statement hash and
-- statement length verification. It does not execute or reverse schema work.
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
  where version = '0084';

  select count(*), min(version)
  into matching_rows, source_version
  from supabase_migrations.schema_migrations
  where name = 'recommendation_foreign_key_covering_indexes'
    and md5(array_to_string(statements, E'\n')) = '07aa80888471117955790e5f04f6ae04'
    and length(array_to_string(statements, E'\n')) = 877;

  if canonical_rows = 1 and matching_rows = 1 and source_version = '0084' then
    return;
  end if;

  if canonical_rows <> 0 then
    raise exception 'canonical migration version 0084 is already occupied';
  end if;

  if matching_rows <> 1 or source_version is null then
    raise exception 'expected exactly one verified source row for migration 0084, found %',
      matching_rows;
  end if;

  if source_version !~ '^20260730[0-9]{6}$' then
    raise exception 'refusing unexpected source version % for migration 0084',
      source_version;
  end if;

  update supabase_migrations.schema_migrations
  set version = '0084'
  where version = source_version
    and name = 'recommendation_foreign_key_covering_indexes'
    and md5(array_to_string(statements, E'\n')) = '07aa80888471117955790e5f04f6ae04'
    and length(array_to_string(statements, E'\n')) = 877;

  if not found then
    raise exception 'migration ledger update did not affect migration 0084';
  end if;
end;
$repair$;

commit;

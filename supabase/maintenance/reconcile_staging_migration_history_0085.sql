-- Staging-only operational repair for repository migration 0085.
--
-- The managed apply-migration API recorded a generated timestamp version after
-- applying the exact RLS auth initialization-plan migration. This script changes
-- migration ledger metadata only after exact name, statement hash and statement
-- length verification. It does not execute or reverse policy changes.
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
  where version = '0085';

  select count(*), min(version)
  into matching_rows, source_version
  from supabase_migrations.schema_migrations
  where name = 'rls_auth_initialization_plans'
    and md5(array_to_string(statements, E'\n')) = 'ac1a27efc299f4e77fe7bc585ff9278a'
    and length(array_to_string(statements, E'\n')) = 11544;

  if canonical_rows = 1 and matching_rows = 1 and source_version = '0085' then
    return;
  end if;

  if canonical_rows <> 0 then
    raise exception 'canonical migration version 0085 is already occupied';
  end if;

  if matching_rows <> 1 or source_version is null then
    raise exception 'expected exactly one verified source row for migration 0085, found %',
      matching_rows;
  end if;

  if source_version !~ '^20260730[0-9]{6}$' then
    raise exception 'refusing unexpected source version % for migration 0085',
      source_version;
  end if;

  update supabase_migrations.schema_migrations
  set version = '0085'
  where version = source_version
    and name = 'rls_auth_initialization_plans'
    and md5(array_to_string(statements, E'\n')) = 'ac1a27efc299f4e77fe7bc585ff9278a'
    and length(array_to_string(statements, E'\n')) = 11544;

  if not found then
    raise exception 'migration ledger update did not affect migration 0085';
  end if;
end;
$repair$;

commit;

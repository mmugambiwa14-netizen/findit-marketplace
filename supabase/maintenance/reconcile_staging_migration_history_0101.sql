-- Staging-only migration-ledger reconciliation for repository migration 0101.
-- Changes metadata only after exact statement identity verification.
-- Do not run against production.

begin;
lock table supabase_migrations.schema_migrations in share row exclusive mode;

do $repair$
declare
  matching_rows integer;
  canonical_rows integer;
  source_version text;
begin
  select count(*)
  into canonical_rows
  from supabase_migrations.schema_migrations
  where version = '0101';

  select count(*), min(version)
  into matching_rows, source_version
  from supabase_migrations.schema_migrations
  where name = 'private_authenticated_rpc_implementations'
    and md5(array_to_string(statements, E'\n')) = '498fd459be12f8a1c6c0174d25b09864'
    and length(array_to_string(statements, E'\n')) = 10105;

  if canonical_rows = 1 and matching_rows = 1 and source_version = '0101' then
    return;
  end if;
  if canonical_rows <> 0 then
    raise exception 'canonical migration version 0101 is already occupied';
  end if;
  if matching_rows <> 1 or source_version is null then
    raise exception 'expected exactly one verified source row for migration 0101, found %', matching_rows;
  end if;
  if source_version <> '20260731021100' then
    raise exception 'refusing unexpected source version % for migration 0101', source_version;
  end if;

  update supabase_migrations.schema_migrations
  set version = '0101'
  where version = source_version
    and name = 'private_authenticated_rpc_implementations'
    and md5(array_to_string(statements, E'\n')) = '498fd459be12f8a1c6c0174d25b09864'
    and length(array_to_string(statements, E'\n')) = 10105;

  if not found then
    raise exception 'migration ledger update did not affect migration 0101';
  end if;
end;
$repair$;

commit;

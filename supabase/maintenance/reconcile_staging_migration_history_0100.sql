-- Staging-only operational repair for repository migration 0100.
-- Changes migration-ledger metadata only after exact identity verification.
-- Do not run against production.

begin;
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $repair$
declare matching_rows integer; canonical_rows integer; source_version text;
begin
  select count(*) into canonical_rows
  from supabase_migrations.schema_migrations
  where version = '0100';

  select count(*), min(version)
  into matching_rows, source_version
  from supabase_migrations.schema_migrations
  where name = 'release_control_consistency'
    and md5(array_to_string(statements,E'\n')) = 'a33c974cd9ebb77ef3789342a202538e'
    and length(array_to_string(statements,E'\n')) = 5042;

  if canonical_rows = 1 and matching_rows = 1 and source_version = '0100' then return; end if;
  if canonical_rows <> 0 then raise exception 'canonical migration version 0100 is already occupied'; end if;
  if matching_rows <> 1 or source_version is null then
    raise exception 'expected exactly one verified source row for migration 0100, found %', matching_rows;
  end if;
  if source_version <> '20260731013402' then
    raise exception 'refusing unexpected source version % for migration 0100', source_version;
  end if;

  update supabase_migrations.schema_migrations
  set version = '0100'
  where version = source_version
    and name = 'release_control_consistency'
    and md5(array_to_string(statements,E'\n')) = 'a33c974cd9ebb77ef3789342a202538e'
    and length(array_to_string(statements,E'\n')) = 5042;

  if not found then raise exception 'migration ledger update did not affect migration 0100'; end if;
end;
$repair$;
commit;

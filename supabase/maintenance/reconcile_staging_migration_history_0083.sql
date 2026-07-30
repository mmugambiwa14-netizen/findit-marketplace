-- Staging-only operational repair for repository migration 0083.
--
-- The managed apply-migration API recorded a generated timestamp version after
-- applying the exact foreign-key index migration. This script changes migration
-- ledger metadata only after exact name, statement hash and statement length
-- verification. It does not execute or reverse schema statements.
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
  where version = '0083';

  select count(*), min(version)
  into matching_rows, source_version
  from supabase_migrations.schema_migrations
  where name = 'foreign_key_covering_indexes'
    and md5(array_to_string(statements, E'\n')) = '1a5b9aba07f6fd7307d8ea6f9cb9bcc9'
    and length(array_to_string(statements, E'\n')) = 4801;

  if canonical_rows = 1 and matching_rows = 1 and source_version = '0083' then
    return;
  end if;

  if canonical_rows <> 0 then
    raise exception 'canonical migration version 0083 is already occupied';
  end if;

  if matching_rows <> 1 or source_version is null then
    raise exception 'expected exactly one verified source row for migration 0083, found %',
      matching_rows;
  end if;

  if source_version !~ '^20260730[0-9]{6}$' then
    raise exception 'refusing unexpected source version % for migration 0083',
      source_version;
  end if;

  update supabase_migrations.schema_migrations
  set version = '0083'
  where version = source_version
    and name = 'foreign_key_covering_indexes'
    and md5(array_to_string(statements, E'\n')) = '1a5b9aba07f6fd7307d8ea6f9cb9bcc9'
    and length(array_to_string(statements, E'\n')) = 4801;

  if not found then
    raise exception 'migration ledger update did not affect migration 0083';
  end if;
end;
$repair$;

commit;

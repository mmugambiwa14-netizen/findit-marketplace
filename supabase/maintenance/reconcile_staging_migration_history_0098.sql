-- Staging-only operational repair for repository migration 0098.
-- Changes migration-ledger metadata only after exact identity verification.
-- Do not run against production.

begin;
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $repair$
declare matching_rows integer;canonical_rows integer;source_version text;
begin
  select count(*) into canonical_rows from supabase_migrations.schema_migrations where version='0098';
  select count(*),min(version) into matching_rows,source_version
  from supabase_migrations.schema_migrations
  where name='private_notification_read_implementations'
    and md5(array_to_string(statements,E'\n'))='75a707810d3c120b283a1d6688019d6d'
    and length(array_to_string(statements,E'\n'))=8451;
  if canonical_rows=1 and matching_rows=1 and source_version='0098' then return; end if;
  if canonical_rows<>0 then raise exception 'canonical migration version 0098 is already occupied'; end if;
  if matching_rows<>1 or source_version is null then raise exception 'expected exactly one verified source row for migration 0098, found %',matching_rows; end if;
  if source_version !~ '^20260730[0-9]{6}$' then raise exception 'refusing unexpected source version % for migration 0098',source_version; end if;
  update supabase_migrations.schema_migrations set version='0098'
  where version=source_version and name='private_notification_read_implementations'
    and md5(array_to_string(statements,E'\n'))='75a707810d3c120b283a1d6688019d6d'
    and length(array_to_string(statements,E'\n'))=8451;
  if not found then raise exception 'migration ledger update did not affect migration 0098'; end if;
end;$repair$;
commit;

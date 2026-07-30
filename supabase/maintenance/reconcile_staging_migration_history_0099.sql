-- Staging-only operational repair for repository migration 0099.
-- Changes migration-ledger metadata only after exact identity verification.
-- Do not run against production.

begin;
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $repair$
declare matching_rows integer;canonical_rows integer;source_version text;
begin
  select count(*) into canonical_rows from supabase_migrations.schema_migrations where version='0099';
  select count(*),min(version) into matching_rows,source_version
  from supabase_migrations.schema_migrations
  where name='private_personalization_preference_implementations'
    and md5(array_to_string(statements,E'\n'))='312c6f522a12cfed915b679ede33bf59'
    and length(array_to_string(statements,E'\n'))=9571;
  if canonical_rows=1 and matching_rows=1 and source_version='0099' then return; end if;
  if canonical_rows<>0 then raise exception 'canonical migration version 0099 is already occupied'; end if;
  if matching_rows<>1 or source_version is null then raise exception 'expected exactly one verified source row for migration 0099, found %',matching_rows; end if;
  if source_version !~ '^20260730[0-9]{6}$' then raise exception 'refusing unexpected source version % for migration 0099',source_version; end if;
  update supabase_migrations.schema_migrations set version='0099'
  where version=source_version and name='private_personalization_preference_implementations'
    and md5(array_to_string(statements,E'\n'))='312c6f522a12cfed915b679ede33bf59'
    and length(array_to_string(statements,E'\n'))=9571;
  if not found then raise exception 'migration ledger update did not affect migration 0099'; end if;
end;$repair$;
commit;

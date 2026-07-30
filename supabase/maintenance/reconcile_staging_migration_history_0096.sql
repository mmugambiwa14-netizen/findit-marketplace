-- Staging-only operational repair for repository migration 0096.
-- Changes migration-ledger metadata only after exact identity verification.
-- Do not run against production.

begin;
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $repair$
declare matching_rows integer;canonical_rows integer;source_version text;
begin
 select count(*) into canonical_rows from supabase_migrations.schema_migrations where version='0096';
 select count(*),min(version) into matching_rows,source_version
 from supabase_migrations.schema_migrations
 where name='private_recommendation_event_implementation'
   and md5(array_to_string(statements,E'\n'))='954932bc89a0e80ac7e73c277b6edf0b'
   and length(array_to_string(statements,E'\n'))=7054;
 if canonical_rows=1 and matching_rows=1 and source_version='0096' then return; end if;
 if canonical_rows<>0 then raise exception 'canonical migration version 0096 is already occupied'; end if;
 if matching_rows<>1 or source_version is null then raise exception 'expected exactly one verified source row for migration 0096, found %',matching_rows; end if;
 if source_version !~ '^20260730[0-9]{6}$' then raise exception 'refusing unexpected source version % for migration 0096',source_version; end if;
 update supabase_migrations.schema_migrations set version='0096'
 where version=source_version and name='private_recommendation_event_implementation'
   and md5(array_to_string(statements,E'\n'))='954932bc89a0e80ac7e73c277b6edf0b'
   and length(array_to_string(statements,E'\n'))=7054;
 if not found then raise exception 'migration ledger update did not affect migration 0096'; end if;
end;$repair$;
commit;

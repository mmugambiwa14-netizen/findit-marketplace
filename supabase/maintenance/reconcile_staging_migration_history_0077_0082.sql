-- Staging-only operational repair.
--
-- The schema changes corresponding to repository migrations 0077-0082 were
-- applied to FindIt Staging through the managed apply-migration API, which
-- recorded generated timestamp versions. This script changes ledger metadata
-- only after exact name, statement hash and statement length verification. It
-- does not execute, reverse or rewrite any schema statement.
--
-- Do not run against production. Production remains at 0049 and must receive
-- the canonical repository files through the normal migration chain.

begin;

lock table supabase_migrations.schema_migrations
  in share row exclusive mode;

do $repair$
declare
  repair record;
  matching_rows integer;
  canonical_rows integer;
  source_version text;
begin
  for repair in
    select *
    from (values
      ('0077', 'real_marketplace_view_counting', '7912fa31d66a3d0ee88c08c1bd040bb3', 1656),
      ('0078', 'service_catalog_recommendation_alignment', '1b7e1cadd527e661c33f7af2e436746c', 4618),
      ('0079', 'on_demand_recommendation_projection', 'e75c89ddee52cb538dc099259a9075db', 1899),
      ('0080', 'listing_detail_related_services_context', '12a1ad7ab6d477a7f8b79986ab07ba5b', 1705),
      ('0081', 'public_business_profile_view_security', '1e7fd9e2fe6f1c479ae91b163c3f0efa', 2393),
      ('0082', 'pg_trgm_extension_schema_security', 'b717618066f5730b9f7887b2bdfbe0ed', 423)
    ) as expected(canonical_version, migration_name, statements_md5, statements_length)
  loop
    select count(*)
    into canonical_rows
    from supabase_migrations.schema_migrations
    where version = repair.canonical_version;

    select count(*), min(version)
    into matching_rows, source_version
    from supabase_migrations.schema_migrations
    where name = repair.migration_name
      and md5(array_to_string(statements, E'\n')) = repair.statements_md5
      and length(array_to_string(statements, E'\n')) = repair.statements_length;

    if canonical_rows = 1 and matching_rows = 1 and source_version = repair.canonical_version then
      continue;
    end if;

    if canonical_rows <> 0 then
      raise exception 'canonical migration version % is already occupied', repair.canonical_version;
    end if;

    if matching_rows <> 1 or source_version is null then
      raise exception 'expected exactly one verified source row for migration %, found %',
        repair.migration_name,
        matching_rows;
    end if;

    if source_version !~ '^20260730[0-9]{6}$' then
      raise exception 'refusing unexpected source version % for migration %',
        source_version,
        repair.migration_name;
    end if;

    update supabase_migrations.schema_migrations
    set version = repair.canonical_version
    where version = source_version
      and name = repair.migration_name
      and md5(array_to_string(statements, E'\n')) = repair.statements_md5
      and length(array_to_string(statements, E'\n')) = repair.statements_length;

    if not found then
      raise exception 'migration ledger update did not affect migration %', repair.migration_name;
    end if;
  end loop;
end;
$repair$;

commit;

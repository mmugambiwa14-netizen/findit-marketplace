begin;

-- This migration closes an unintended browser-access boundary. A rollback must
-- not recreate that exposure, so the safe rollback is intentionally
-- idempotent and reasserts the protected partition state.
do $rollback$
declare
  partition_record record;
begin
  for partition_record in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name
    from pg_partition_tree('public.recommendation_events'::regclass) as partition_tree
    join pg_class as relation
      on relation.oid = partition_tree.relid
    join pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where partition_tree.isleaf
  loop
    execute format(
      'alter table %I.%I enable row level security',
      partition_record.schema_name,
      partition_record.table_name
    );
    execute format(
      'revoke all privileges on table %I.%I from public, anon, authenticated',
      partition_record.schema_name,
      partition_record.table_name
    );
    execute format(
      'grant select, insert, update, delete on table %I.%I to service_role',
      partition_record.schema_name,
      partition_record.table_name
    );
  end loop;
end;
$rollback$;

commit;

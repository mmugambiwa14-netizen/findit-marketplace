begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

with expected(table_name, column_name) as (
  values
    ('recommendation_cache', 'subject_listing_id'),
    ('recommendation_service_policies', 'updated_by'),
    ('recommendation_weight_profiles', 'created_by')
), uncovered as (
  select expected.table_name, expected.column_name
  from expected
  join pg_class as table_relation
    on table_relation.relname = expected.table_name
  join pg_namespace as table_schema
    on table_schema.oid = table_relation.relnamespace
   and table_schema.nspname = 'public'
  join pg_attribute as foreign_key_column
    on foreign_key_column.attrelid = table_relation.oid
   and foreign_key_column.attname = expected.column_name
  where not exists (
    select 1
    from pg_index as index_definition
    where index_definition.indrelid = table_relation.oid
      and index_definition.indisvalid
      and index_definition.indisready
      and index_definition.indpred is null
      and (index_definition.indkey::smallint[])[0] = foreign_key_column.attnum
  )
)
select extensions.is(
  (select count(*)::bigint from uncovered),
  0::bigint,
  'non-partitioned recommendation foreign keys have valid leading-column indexes'
);

with event_relations as (
  select partition_tree.relid
  from pg_partition_tree('public.recommendation_events'::regclass) as partition_tree
), uncovered as (
  select event_relations.relid
  from event_relations
  join pg_attribute as seller_column
    on seller_column.attrelid = event_relations.relid
   and seller_column.attname = 'seller_id'
  where not exists (
    select 1
    from pg_index as index_definition
    where index_definition.indrelid = event_relations.relid
      and index_definition.indisvalid
      and index_definition.indisready
      and index_definition.indpred is null
      and (index_definition.indkey::smallint[])[0] = seller_column.attnum
  )
)
select extensions.is(
  (select count(*)::bigint from uncovered),
  0::bigint,
  'recommendation event parent and every attached partition index seller_id'
);

select extensions.ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'recommendation_events'
      and indexname = 'idx_fk_recommendation_events_seller_id'
  ),
  'partitioned recommendation event seller index exists on the parent'
);

select extensions.finish();
rollback;

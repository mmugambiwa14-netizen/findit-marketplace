begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select extension_schema.nspname
    from pg_extension as installed_extension
    join pg_namespace as extension_schema
      on extension_schema.oid = installed_extension.extnamespace
    where installed_extension.extname = 'pg_trgm'
  ),
  'extensions'::name,
  'pg_trgm is isolated outside the public API schema'
);

select extensions.ok(
  (
    select installed_extension.extrelocatable
    from pg_extension as installed_extension
    where installed_extension.extname = 'pg_trgm'
  ),
  'pg_trgm remains relocatable for the rollback capsule'
);

select extensions.is(
  extensions.similarity('findit marketplace', 'findit marketplace'),
  1::real,
  'qualified pg_trgm functions remain operational'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_index as indexed_relation
    join pg_class as table_relation
      on table_relation.oid = indexed_relation.indrelid
    join pg_namespace as table_schema
      on table_schema.oid = table_relation.relnamespace
    join lateral unnest(indexed_relation.indclass) as index_class(opclass_oid)
      on true
    join pg_opclass as operator_class
      on operator_class.oid = index_class.opclass_oid
    join pg_namespace as operator_class_schema
      on operator_class_schema.oid = operator_class.opcnamespace
    where table_schema.nspname = 'public'
      and operator_class.opcname = 'gin_trgm_ops'
      and operator_class_schema.nspname <> 'extensions'
  ),
  0::bigint,
  'all public-table trigram indexes retain extension-schema operator classes'
);

select extensions.finish();
rollback;

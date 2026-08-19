-- Standardize SECURITY DEFINER functions on an empty search_path.
--
-- The audited function bodies already schema-qualify their relations. Keeping
-- the configuration at search_path='' makes that hardening invariant explicit
-- and prevents future edits from accidentally relying on a caller-controlled
-- search path.

begin;

create table if not exists private.search_path_hardening_20260819 (
  schema_name name not null,
  function_name name not null,
  identity_arguments text not null,
  previous_config text[] not null,
  primary key (schema_name, function_name, identity_arguments)
);

revoke all on table private.search_path_hardening_20260819 from public, anon, authenticated, service_role;

insert into private.search_path_hardening_20260819 (
  schema_name,
  function_name,
  identity_arguments,
  previous_config
)
select
  function_schema.nspname,
  function_record.proname,
  pg_get_function_identity_arguments(function_record.oid),
  function_record.proconfig
from pg_proc function_record
join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
where function_record.prosecdef
  and function_record.proconfig @> array['search_path=public']::text[]
  and function_schema.nspname in ('public', 'private')
on conflict (schema_name, function_name, identity_arguments) do nothing;

do $function$
declare
  function_record record;
begin
  for function_record in
    select schema_name, function_name, identity_arguments
    from private.search_path_hardening_20260819
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = %L',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments,
      ''
    );
  end loop;
end
$function$;

commit;

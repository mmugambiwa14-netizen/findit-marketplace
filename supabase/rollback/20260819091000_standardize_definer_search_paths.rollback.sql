-- Restore the exact SECURITY DEFINER function settings captured by the
-- forward migration. This is intentionally data-driven rather than resetting
-- every definer function in the database.

begin;

do $function$
declare
  function_record record;
  setting text;
begin
  for function_record in
    select schema_name, function_name, identity_arguments, previous_config
    from private.search_path_hardening_20260819
  loop
    execute format(
      'alter function %I.%I(%s) reset all',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );

    foreach setting in array function_record.previous_config
    loop
      execute format(
        'alter function %I.%I(%s) set %s',
        function_record.schema_name,
        function_record.function_name,
        function_record.identity_arguments,
        setting
      );
    end loop;
  end loop;
end
$function$;

drop table if exists private.search_path_hardening_20260819;

commit;

-- 0085_rls_auth_initialization_plans.rollback.sql
-- Restore the pre-0085 direct auth.uid() policy expressions without changing
-- policy commands, roles or authorization predicates.

do $rollback$
declare
  policy_record record;
  previous_using text;
  previous_check text;
  alter_statement text;
  candidate_count integer;
begin
  select count(*)::integer
    into candidate_count
  from pg_policies
  where schemaname = 'public'
    and (
      coalesce(qual, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
      or coalesce(with_check, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
    );

  if candidate_count <> 36 then
    raise exception '0085 rollback expected 36 initialized auth.uid() policies, found %', candidate_count;
  end if;

  for policy_record in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
        or coalesce(with_check, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
      )
    order by tablename, policyname
  loop
    previous_using := case
      when policy_record.qual is null then null
      else regexp_replace(
        policy_record.qual,
        '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)',
        'auth.uid()',
        'gi'
      )
    end;
    previous_check := case
      when policy_record.with_check is null then null
      else regexp_replace(
        policy_record.with_check,
        '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)',
        'auth.uid()',
        'gi'
      )
    end;

    alter_statement := format(
      'alter policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );

    if previous_using is not null then
      alter_statement := alter_statement || format(' using (%s)', previous_using);
    end if;

    if previous_check is not null then
      alter_statement := alter_statement || format(' with check (%s)', previous_check);
    end if;

    execute alter_statement;
  end loop;
end
$rollback$;

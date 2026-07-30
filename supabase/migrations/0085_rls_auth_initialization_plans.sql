-- 0085_rls_auth_initialization_plans.sql
-- Convert direct auth.uid() calls in the locked public RLS policy set into
-- scalar initialization plans. PostgreSQL evaluates each scalar subquery once
-- per statement instead of once per candidate row, while the policy predicates,
-- commands, roles and authorization outcomes remain unchanged.

do $migration$
declare
  policy_record record;
  next_using text;
  next_check text;
  alter_statement text;
  candidate_count integer;
  residual_count integer;
begin
  select count(*)::integer
    into candidate_count
  from pg_policies
  where schemaname = 'public'
    and (
      coalesce(qual, '') like '%auth.uid()%'
      or coalesce(with_check, '') like '%auth.uid()%'
    );

  if candidate_count <> 36 then
    raise exception '0085 expected 36 direct auth.uid() policies, found %', candidate_count;
  end if;

  for policy_record in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
    order by tablename, policyname
  loop
    next_using := case
      when policy_record.qual is null then null
      else replace(policy_record.qual, 'auth.uid()', '(select auth.uid())')
    end;
    next_check := case
      when policy_record.with_check is null then null
      else replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())')
    end;

    alter_statement := format(
      'alter policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );

    if next_using is not null then
      alter_statement := alter_statement || format(' using (%s)', next_using);
    end if;

    if next_check is not null then
      alter_statement := alter_statement || format(' with check (%s)', next_check);
    end if;

    execute alter_statement;
  end loop;

  select count(*)::integer
    into residual_count
  from pg_policies
  where schemaname = 'public'
    and (
      regexp_replace(
        coalesce(qual, ''),
        '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)',
        '',
        'gi'
      ) like '%auth.uid()%'
      or regexp_replace(
        coalesce(with_check, ''),
        '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)',
        '',
        'gi'
      ) like '%auth.uid()%'
    );

  if residual_count <> 0 then
    raise exception '0085 left % policies with per-row auth.uid() evaluation', residual_count;
  end if;
end
$migration$;

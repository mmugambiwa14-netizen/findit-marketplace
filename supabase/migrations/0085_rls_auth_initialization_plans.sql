-- 0085_rls_auth_initialization_plans.sql
--
-- Convert direct auth.uid() calls in the locked public RLS policy set into
-- scalar initialization plans. PostgreSQL evaluates each scalar subquery once
-- per statement instead of once per candidate row, while policy predicates,
-- commands, roles and authorization outcomes remain unchanged.
--
-- The migration is fail-closed on the exact 36 policy identities currently
-- reported by Supabase's auth_rls_initplan advisor. Expression text is altered
-- in place so every non-auth predicate is preserved verbatim.

create temporary table findit_rls_initplan_expected (
  table_name text not null,
  policy_name text not null,
  command_name text not null,
  roles_text text not null,
  primary key (table_name, policy_name)
) on commit drop;

insert into findit_rls_initplan_expected (
  table_name,
  policy_name,
  command_name,
  roles_text
)
values
  ('app_alerts', 'app_alerts_owner_read', 'SELECT', '{public}'),
  ('business_profiles', 'business_profiles_owner_read', 'SELECT', '{public}'),
  ('business_profiles', 'business_profiles_owner_update', 'UPDATE', '{public}'),
  ('business_profiles', 'business_profiles_owner_write', 'INSERT', '{public}'),
  ('car_details', 'car_details_owner_update', 'UPDATE', '{public}'),
  ('car_details', 'car_details_owner_write', 'INSERT', '{public}'),
  ('conversation_reports', 'conversation_reports_reporter_or_admin_read', 'SELECT', '{public}'),
  ('conversations', 'conversations_participant_read', 'SELECT', '{public}'),
  ('inquiries', 'inquiries_participant_read', 'SELECT', '{public}'),
  ('listing_media', 'listing_media_read', 'SELECT', '{public}'),
  ('listing_private_locations', 'listing_private_locations_owner_admin_read', 'SELECT', '{public}'),
  ('listing_tour_events', 'listing_tour_events_owner_admin_read', 'SELECT', '{public}'),
  ('listing_tour_slots', 'listing_tour_slots_owner_admin_read', 'SELECT', '{public}'),
  ('listing_tour_upload_intents', 'listing_tour_upload_intents_owner_admin_read', 'SELECT', '{public}'),
  ('listing_tours', 'listing_tours_owner_admin_read', 'SELECT', '{public}'),
  ('listings', 'listings_owner_delete', 'DELETE', '{public}'),
  ('listings', 'listings_owner_update', 'UPDATE', '{public}'),
  ('listings', 'listings_owner_write', 'INSERT', '{public}'),
  ('machinery_details', 'machinery_details_owner_update', 'UPDATE', '{public}'),
  ('machinery_details', 'machinery_details_owner_write', 'INSERT', '{public}'),
  ('property_details', 'property_details_owner_update', 'UPDATE', '{public}'),
  ('property_details', 'property_details_owner_write', 'INSERT', '{public}'),
  ('recommendation_events', 'recommendation_events_actor_read', 'SELECT', '{authenticated}'),
  ('recommendation_personalization_preferences', 'recommendation_personalization_preferences_owner_read', 'SELECT', '{authenticated}'),
  ('reports', 'reports_create', 'INSERT', '{public}'),
  ('reports', 'reports_reporter_or_admin_read', 'SELECT', '{public}'),
  ('saved_listings', 'saved_listings_owner_delete', 'DELETE', '{public}'),
  ('saved_listings', 'saved_listings_owner_insert', 'INSERT', '{public}'),
  ('saved_listings', 'saved_listings_owner_read', 'SELECT', '{public}'),
  ('service_media', 'service_media_read', 'SELECT', '{public}'),
  ('services', 'services_owner_delete', 'DELETE', '{public}'),
  ('services', 'services_owner_update', 'UPDATE', '{public}'),
  ('services', 'services_owner_write', 'INSERT', '{public}'),
  ('services', 'services_public_read_active', 'SELECT', '{public}'),
  ('users', 'users_select_own_or_admin', 'SELECT', '{public}'),
  ('users', 'users_update_own_profile_fields', 'UPDATE', '{public}');

do $migration$
declare
  expected_count integer;
  candidate_count integer;
  mismatch_count integer;
  unexpected_count integer;
  residual_count integer;
  initialized_count integer;
  policy_record record;
  next_using text;
  next_check text;
  alter_statement text;
  auth_uid_initplan_pattern constant text := '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)';
begin
  select count(*)::integer
    into expected_count
  from findit_rls_initplan_expected;

  if expected_count <> 36 then
    raise exception '0085 expected 36 locked policy identities, found %', expected_count;
  end if;

  select count(*)::integer
    into mismatch_count
  from findit_rls_initplan_expected expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or policy.cmd <> expected.command_name
     or policy.roles::text <> expected.roles_text;

  if mismatch_count <> 0 then
    raise exception '0085 found % missing or structurally changed policy identities', mismatch_count;
  end if;

  select count(*)::integer
    into candidate_count
  from pg_policies policy
  where policy.schemaname = 'public'
    and (
      coalesce(policy.qual, '') like '%auth.uid()%'
      or coalesce(policy.with_check, '') like '%auth.uid()%'
    );

  if candidate_count <> 36 then
    raise exception '0085 expected 36 direct auth.uid() policies, found %', candidate_count;
  end if;

  select count(*)::integer
    into unexpected_count
  from pg_policies policy
  left join findit_rls_initplan_expected expected
    on expected.table_name = policy.tablename
   and expected.policy_name = policy.policyname
  where policy.schemaname = 'public'
    and (
      coalesce(policy.qual, '') like '%auth.uid()%'
      or coalesce(policy.with_check, '') like '%auth.uid()%'
    )
    and expected.policy_name is null;

  if unexpected_count <> 0 then
    raise exception '0085 found % untracked direct auth.uid() policies', unexpected_count;
  end if;

  select count(*)::integer
    into mismatch_count
  from findit_rls_initplan_expected expected
  join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where not (
    coalesce(policy.qual, '') like '%auth.uid()%'
    or coalesce(policy.with_check, '') like '%auth.uid()%'
  );

  if mismatch_count <> 0 then
    raise exception '0085 found % locked policies without a direct auth.uid() call', mismatch_count;
  end if;

  for policy_record in
    select policy.schemaname,
           policy.tablename,
           policy.policyname,
           policy.qual,
           policy.with_check
    from pg_policies policy
    join findit_rls_initplan_expected expected
      on expected.table_name = policy.tablename
     and expected.policy_name = policy.policyname
    where policy.schemaname = 'public'
    order by policy.tablename, policy.policyname
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
    into initialized_count
  from findit_rls_initplan_expected expected
  join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where (coalesce(policy.qual, '') ~* auth_uid_initplan_pattern
      or coalesce(policy.with_check, '') ~* auth_uid_initplan_pattern)
    and policy.cmd = expected.command_name
    and policy.roles::text = expected.roles_text;

  if initialized_count <> 36 then
    raise exception '0085 initialized only % of 36 locked policies', initialized_count;
  end if;

  select count(*)::integer
    into residual_count
  from pg_policies policy
  where policy.schemaname = 'public'
    and (
      regexp_replace(
        coalesce(policy.qual, ''),
        auth_uid_initplan_pattern,
        '',
        'gi'
      ) like '%auth.uid()%'
      or regexp_replace(
        coalesce(policy.with_check, ''),
        auth_uid_initplan_pattern,
        '',
        'gi'
      ) like '%auth.uid()%'
    );

  if residual_count <> 0 then
    raise exception '0085 left % policies with per-row auth.uid() evaluation', residual_count;
  end if;
end
$migration$;

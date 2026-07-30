-- 0085_rls_auth_initplan_optimization.rollback.sql
--
-- Restore the direct auth.uid() expression form while preserving every other
-- policy predicate. This rollback is fail-closed on the exact 36 policy names,
-- commands and role sets introduced into the optimization boundary.

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

do $rollback$
declare
  expected_count integer;
  mismatch_count integer;
  optimized_policy_count integer;
  policy_row record;
  alter_statement text;
  restored_qual text;
  restored_check text;
  auth_uid_initplan_pattern constant text := '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)';
begin
  select count(*) into expected_count
  from findit_rls_initplan_expected;

  if expected_count <> 36 then
    raise exception 'expected 36 RLS initialization-plan rollback targets, found %', expected_count;
  end if;

  select count(*) into mismatch_count
  from findit_rls_initplan_expected expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or policy.cmd <> expected.command_name
     or policy.roles::text <> expected.roles_text;

  if mismatch_count <> 0 then
    raise exception 'refusing RLS initialization-plan rollback because % policy identities drifted', mismatch_count;
  end if;

  select count(*) into optimized_policy_count
  from findit_rls_initplan_expected expected
  join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where coalesce(policy.qual, '') ~* auth_uid_initplan_pattern
     or coalesce(policy.with_check, '') ~* auth_uid_initplan_pattern;

  if optimized_policy_count <> 36 then
    raise exception 'expected all 36 rollback targets to use auth.uid() initialization plans, found %', optimized_policy_count;
  end if;

  select count(*) into mismatch_count
  from findit_rls_initplan_expected expected
  join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where regexp_replace(coalesce(policy.qual, ''), auth_uid_initplan_pattern, '', 'gi') like '%auth.uid()%'
     or regexp_replace(coalesce(policy.with_check, ''), auth_uid_initplan_pattern, '', 'gi') like '%auth.uid()%';

  if mismatch_count <> 0 then
    raise exception 'refusing rollback because % policies contain mixed direct and initialization-plan auth.uid() forms', mismatch_count;
  end if;

  for policy_row in
    select policy.*
    from pg_policies policy
    join findit_rls_initplan_expected expected
      on expected.table_name = policy.tablename
     and expected.policy_name = policy.policyname
    where policy.schemaname = 'public'
    order by policy.tablename, policy.policyname
  loop
    restored_qual := case
      when policy_row.qual is null then null
      else regexp_replace(policy_row.qual, auth_uid_initplan_pattern, 'auth.uid()', 'gi')
    end;
    restored_check := case
      when policy_row.with_check is null then null
      else regexp_replace(policy_row.with_check, auth_uid_initplan_pattern, 'auth.uid()', 'gi')
    end;

    alter_statement := format(
      'alter policy %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );

    if restored_qual is not null then
      alter_statement := alter_statement || format(' using (%s)', restored_qual);
    end if;

    if restored_check is not null then
      alter_statement := alter_statement || format(' with check (%s)', restored_check);
    end if;

    execute alter_statement;
  end loop;

  select count(*) into mismatch_count
  from findit_rls_initplan_expected expected
  join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where coalesce(policy.qual, '') ~* auth_uid_initplan_pattern
     or coalesce(policy.with_check, '') ~* auth_uid_initplan_pattern
     or not (
       coalesce(policy.qual, '') like '%auth.uid()%'
       or coalesce(policy.with_check, '') like '%auth.uid()%'
     );

  if mismatch_count <> 0 then
    raise exception 'RLS initialization-plan rollback failed for % policies', mismatch_count;
  end if;
end
$rollback$;

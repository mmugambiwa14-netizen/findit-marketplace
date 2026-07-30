-- 0085_rls_auth_initialization_plans.sql
--
-- Convert direct auth.uid() calls in the locked public RLS policy set into
-- scalar initialization plans. PostgreSQL evaluates each scalar subquery once
-- per statement instead of once per candidate row, while policy predicates,
-- commands, roles and authorization outcomes remain unchanged.
--
-- This migration is fail-closed on the exact 36 policy identities and their
-- complete pre-migration USING/WITH CHECK expressions. It refuses to continue
-- when any policy has drifted, then proves the transformation preserved every
-- non-auth predicate after PostgreSQL deparses the optimized expressions.

create temporary table findit_rls_initplan_expected (
  table_name text not null,
  policy_name text not null,
  command_name text not null,
  roles_text text not null,
  qual_md5 text not null,
  with_check_md5 text not null,
  primary key (table_name, policy_name)
) on commit drop;

insert into findit_rls_initplan_expected (
  table_name,
  policy_name,
  command_name,
  roles_text,
  qual_md5,
  with_check_md5
)
values
  ('app_alerts', 'app_alerts_owner_read', 'SELECT', '{public}', '4bedc93a2a6e32c997a59bf4455fd116', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('business_profiles', 'business_profiles_owner_read', 'SELECT', '{public}', '6af153ac401c7672c3dd0388fce6cd4a', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('business_profiles', 'business_profiles_owner_update', 'UPDATE', '{public}', '43715877d4c5cb2535e8f2bdee3d31f5', '1a5f9295a178982d8d46af7709037dc7'),
  ('business_profiles', 'business_profiles_owner_write', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', '9982fe42e841ef1771975bd7189775e1'),
  ('car_details', 'car_details_owner_update', 'UPDATE', '{public}', '458c50dcbdedbe438d98e5f28a74bd50', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('car_details', 'car_details_owner_write', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', 'eff2caa5741ed9f4674f9f4aa123f1b2'),
  ('conversation_reports', 'conversation_reports_reporter_or_admin_read', 'SELECT', '{public}', '40b3a77e9fb1cd674ee0bde5fe6afb37', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('conversations', 'conversations_participant_read', 'SELECT', '{public}', '315a2a6a871956fed24a0469e7115059', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('inquiries', 'inquiries_participant_read', 'SELECT', '{public}', 'fcc8c492b8556d9514a68bfb665e4f44', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_media', 'listing_media_read', 'SELECT', '{public}', '78026da7c9cd7d423f07f4547807b8ec', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_private_locations', 'listing_private_locations_owner_admin_read', 'SELECT', '{public}', '2b3718e916eb6199526f8bede5a976b7', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_tour_events', 'listing_tour_events_owner_admin_read', 'SELECT', '{public}', 'a6d434c0c6d691b3d257f7f0864d98ee', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_tour_slots', 'listing_tour_slots_owner_admin_read', 'SELECT', '{public}', '2b3718e916eb6199526f8bede5a976b7', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_tour_upload_intents', 'listing_tour_upload_intents_owner_admin_read', 'SELECT', '{public}', '6af153ac401c7672c3dd0388fce6cd4a', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_tours', 'listing_tours_owner_admin_read', 'SELECT', '{public}', '2b3718e916eb6199526f8bede5a976b7', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listings', 'listings_owner_delete', 'DELETE', '{public}', 'fcbbff49d9fe385d576691cd6ff04a47', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listings', 'listings_owner_update', 'UPDATE', '{public}', 'fcbbff49d9fe385d576691cd6ff04a47', 'fcbbff49d9fe385d576691cd6ff04a47'),
  ('listings', 'listings_owner_write', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', '8dc5d62c91e8a771de07cff2f57edaac'),
  ('machinery_details', 'machinery_details_owner_update', 'UPDATE', '{public}', '17e29753df1b649845dad077583c08c8', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('machinery_details', 'machinery_details_owner_write', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', '6b373deaef4d15353bbeb0effedffe0e'),
  ('property_details', 'property_details_owner_update', 'UPDATE', '{public}', 'cd5b3e59fb5889b12bb364f0afd47366', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('property_details', 'property_details_owner_write', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', '78bbc3a426475122ad9d5886845d75dd'),
  ('recommendation_events', 'recommendation_events_actor_read', 'SELECT', '{authenticated}', 'be3b8129df002bc7ed9e35560b0c31fd', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('recommendation_personalization_preferences', 'recommendation_personalization_preferences_owner_read', 'SELECT', '{authenticated}', '3a807491e0a912fbfbee0ffa087b82f6', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('reports', 'reports_create', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', '582de04bc0f83badea2e1e4b6bd94385'),
  ('reports', 'reports_reporter_or_admin_read', 'SELECT', '{public}', '40b3a77e9fb1cd674ee0bde5fe6afb37', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('saved_listings', 'saved_listings_owner_delete', 'DELETE', '{public}', '4bedc93a2a6e32c997a59bf4455fd116', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('saved_listings', 'saved_listings_owner_insert', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', 'fc31c497b1afbbf5a38ac80f31b04e42'),
  ('saved_listings', 'saved_listings_owner_read', 'SELECT', '{public}', '4bedc93a2a6e32c997a59bf4455fd116', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('service_media', 'service_media_read', 'SELECT', '{public}', '8a23f8839108df12595a2fb486656e02', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('services', 'services_owner_delete', 'DELETE', '{public}', 'e9aeff649bfa6fc3399e38440f14cc48', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('services', 'services_owner_update', 'UPDATE', '{public}', 'e9aeff649bfa6fc3399e38440f14cc48', 'e9aeff649bfa6fc3399e38440f14cc48'),
  ('services', 'services_owner_write', 'INSERT', '{public}', 'd41d8cd98f00b204e9800998ecf8427e', '201a99868592567e2149e894df0d0047'),
  ('services', 'services_public_read_active', 'SELECT', '{public}', '4dee2d999066e8079bcb0909df599820', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('users', 'users_select_own_or_admin', 'SELECT', '{public}', '16ec0c4333f3021fd7cd74f94a6f4b68', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('users', 'users_update_own_profile_fields', 'UPDATE', '{public}', 'ea1f5df45681e1946eaa85c22966d773', 'ea1f5df45681e1946eaa85c22966d773');

do $migration$
declare
  expected_count integer;
  mismatch_count integer;
  direct_policy_count integer;
  unexpected_policy_count integer;
  optimized_policy_count integer;
  policy_row record;
  alter_statement text;
  optimized_qual text;
  optimized_check text;
  auth_uid_initplan_pattern constant text := '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)';
begin
  select count(*) into expected_count
  from findit_rls_initplan_expected;

  if expected_count <> 36 then
    raise exception 'expected 36 RLS initialization-plan fingerprints, found %', expected_count;
  end if;

  select count(*) into mismatch_count
  from findit_rls_initplan_expected expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or policy.cmd <> expected.command_name
     or policy.roles::text <> expected.roles_text
     or md5(coalesce(policy.qual, '')) <> expected.qual_md5
     or md5(coalesce(policy.with_check, '')) <> expected.with_check_md5;

  if mismatch_count <> 0 then
    raise exception 'refusing RLS initialization-plan optimization because % policy fingerprints drifted', mismatch_count;
  end if;

  select count(*) into direct_policy_count
  from pg_policies policy
  where policy.schemaname = 'public'
    and (
      coalesce(policy.qual, '') like '%auth.uid()%'
      or coalesce(policy.with_check, '') like '%auth.uid()%'
    );

  if direct_policy_count <> 36 then
    raise exception 'expected exactly 36 direct auth.uid() policies before optimization, found %', direct_policy_count;
  end if;

  select count(*) into unexpected_policy_count
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

  if unexpected_policy_count <> 0 then
    raise exception 'refusing to leave % untracked direct auth.uid() policies', unexpected_policy_count;
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
    optimized_qual := case
      when policy_row.qual is null then null
      else replace(policy_row.qual, 'auth.uid()', '(select auth.uid())')
    end;
    optimized_check := case
      when policy_row.with_check is null then null
      else replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())')
    end;

    alter_statement := format(
      'alter policy %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );

    if optimized_qual is not null then
      alter_statement := alter_statement || format(' using (%s)', optimized_qual);
    end if;

    if optimized_check is not null then
      alter_statement := alter_statement || format(' with check (%s)', optimized_check);
    end if;

    execute alter_statement;
  end loop;

  select count(*) into mismatch_count
  from findit_rls_initplan_expected expected
  join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.cmd <> expected.command_name
     or policy.roles::text <> expected.roles_text
     or md5(regexp_replace(coalesce(policy.qual, ''), auth_uid_initplan_pattern, 'auth.uid()', 'gi')) <> expected.qual_md5
     or md5(regexp_replace(coalesce(policy.with_check, ''), auth_uid_initplan_pattern, 'auth.uid()', 'gi')) <> expected.with_check_md5;

  if mismatch_count <> 0 then
    raise exception 'RLS initialization-plan optimization changed % policy semantics', mismatch_count;
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
    raise exception 'expected all 36 policies to use auth.uid() initialization plans, found %', optimized_policy_count;
  end if;

  select count(*) into direct_policy_count
  from pg_policies policy
  where policy.schemaname = 'public'
    and (
      regexp_replace(coalesce(policy.qual, ''), auth_uid_initplan_pattern, '', 'gi') like '%auth.uid()%'
      or regexp_replace(coalesce(policy.with_check, ''), auth_uid_initplan_pattern, '', 'gi') like '%auth.uid()%'
    );

  if direct_policy_count <> 0 then
    raise exception 'RLS initialization-plan optimization left % direct auth.uid() policies', direct_policy_count;
  end if;
end
$migration$;

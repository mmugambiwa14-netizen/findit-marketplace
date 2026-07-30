begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table expected_rls_initplan_policies (
  table_name text not null,
  policy_name text not null,
  command_name text not null,
  roles_text text not null,
  primary key (table_name, policy_name)
) on commit drop;

insert into expected_rls_initplan_policies (
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

select extensions.is(
  (select count(*)::bigint from expected_rls_initplan_policies),
  36::bigint,
  'the RLS initialization-plan boundary contains exactly 36 policies'
);

select extensions.is(
  (
    select count(*)::bigint
    from expected_rls_initplan_policies expected
    join pg_policies policy
      on policy.schemaname = 'public'
     and policy.tablename = expected.table_name
     and policy.policyname = expected.policy_name
    where policy.cmd = expected.command_name
      and policy.roles::text = expected.roles_text
  ),
  36::bigint,
  'all optimized policies preserve their names, commands and role sets'
);

select extensions.is(
  (
    select count(*)::bigint
    from expected_rls_initplan_policies expected
    join pg_policies policy
      on policy.schemaname = 'public'
     and policy.tablename = expected.table_name
     and policy.policyname = expected.policy_name
    where coalesce(policy.qual, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
       or coalesce(policy.with_check, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
  ),
  36::bigint,
  'all 36 target policies use a one-time auth.uid() initialization plan'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where policy.schemaname = 'public'
      and (
        regexp_replace(
          coalesce(policy.qual, ''),
          '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)',
          '',
          'gi'
        ) like '%auth.uid()%'
        or regexp_replace(
          coalesce(policy.with_check, ''),
          '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)',
          '',
          'gi'
        ) like '%auth.uid()%'
      )
  ),
  0::bigint,
  'no public policy directly re-evaluates auth.uid() per candidate row'
);

select extensions.finish();
rollback;

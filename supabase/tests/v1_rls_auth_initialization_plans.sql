begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

with expected(table_name, policy_name) as (
  values
    ('app_alerts', 'app_alerts_owner_read'),
    ('business_profiles', 'business_profiles_owner_read'),
    ('business_profiles', 'business_profiles_owner_update'),
    ('business_profiles', 'business_profiles_owner_write'),
    ('car_details', 'car_details_owner_update'),
    ('car_details', 'car_details_owner_write'),
    ('conversation_reports', 'conversation_reports_reporter_or_admin_read'),
    ('conversations', 'conversations_participant_read'),
    ('inquiries', 'inquiries_participant_read'),
    ('listing_media', 'listing_media_read'),
    ('listing_private_locations', 'listing_private_locations_owner_admin_read'),
    ('listing_tour_events', 'listing_tour_events_owner_admin_read'),
    ('listing_tour_slots', 'listing_tour_slots_owner_admin_read'),
    ('listing_tour_upload_intents', 'listing_tour_upload_intents_owner_admin_read'),
    ('listing_tours', 'listing_tours_owner_admin_read'),
    ('listings', 'listings_owner_delete'),
    ('listings', 'listings_owner_update'),
    ('listings', 'listings_owner_write'),
    ('machinery_details', 'machinery_details_owner_update'),
    ('machinery_details', 'machinery_details_owner_write'),
    ('property_details', 'property_details_owner_update'),
    ('property_details', 'property_details_owner_write'),
    ('recommendation_events', 'recommendation_events_actor_read'),
    ('recommendation_personalization_preferences', 'recommendation_personalization_preferences_owner_read'),
    ('reports', 'reports_create'),
    ('reports', 'reports_reporter_or_admin_read'),
    ('saved_listings', 'saved_listings_owner_delete'),
    ('saved_listings', 'saved_listings_owner_insert'),
    ('saved_listings', 'saved_listings_owner_read'),
    ('service_media', 'service_media_read'),
    ('services', 'services_owner_delete'),
    ('services', 'services_owner_update'),
    ('services', 'services_owner_write'),
    ('services', 'services_public_read_active'),
    ('users', 'users_select_own_or_admin'),
    ('users', 'users_update_own_profile_fields')
), missing_or_uninitialized as (
  select expected.table_name, expected.policy_name
  from expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or not (
       coalesce(policy.qual, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
       or coalesce(policy.with_check, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
     )
)
select extensions.is(
  (select count(*)::bigint from missing_or_uninitialized),
  0::bigint,
  'all 36 locked RLS policies use an auth.uid initialization plan'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
        or coalesce(with_check, '') ~* '\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)'
      )
  ),
  36::bigint,
  'exactly 36 public policies contain initialized auth.uid calls'
);

select extensions.is(
  (
    select count(*)::bigint
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
      )
  ),
  0::bigint,
  'no public RLS policy retains a per-row auth.uid call'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'listings_owner_update',
        'services_owner_update',
        'users_update_own_profile_fields'
      )
      and cmd = 'UPDATE'
      and qual is not null
      and with_check is not null
  ),
  3::bigint,
  'update policies retain both USING and WITH CHECK predicates'
);

select extensions.finish();
rollback;

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  rlsHardening,
  sellerProfile,
  listingMedia,
  marketplaceMedia,
  founderAdmin,
  tourUploads,
  notificationReads,
  supportRequest,
  listingSearch,
  countryFoundation,
  listingPrivacy,
  recommendationFoundation,
  recommendationPartitions,
  recommendationEvents,
  personalization,
  recommendedServiceEvents,
  marketplaceViews,
  releaseControls,
  partitionRuntimeRepair,
] = await Promise.all([
  read('supabase/migrations/0013_v1_rls_hardening.sql'),
  read('supabase/migrations/0014_public_seller_profile.sql'),
  read('supabase/migrations/0021_v1_listing_creation_and_media.sql'),
  read('supabase/migrations/0022_v1_marketplace_profile_media.sql'),
  read('supabase/migrations/0030_v1_founder_admin_lock.sql'),
  read('supabase/migrations/0032_v1_tour_storage_and_upload.sql'),
  read('supabase/migrations/0019_v1_essential_notifications.sql'),
  read('supabase/migrations/0025_v1_contact_support.sql'),
  read('supabase/migrations/0041_v1_public_search_and_notification_scale.sql'),
  read('supabase/migrations/0046_mvp_foundation_countries_currency_publication.sql'),
  read('supabase/migrations/0049_listing_location_privacy_and_public_projection.sql'),
  read('supabase/migrations/0050_recommendation_data_foundation.sql'),
  read('supabase/migrations/0056_recommendation_partition_and_configuration_integrity.sql'),
  read('supabase/migrations/0053_recommendation_foundation_hardening.sql'),
  read('supabase/migrations/0071_privacy_preserving_personalization.sql'),
  read('supabase/migrations/0073_executable_related_services.sql'),
  read('supabase/migrations/0077_real_marketplace_view_counting.sql'),
  read('supabase/migrations/0100_release_control_consistency.sql'),
  read('supabase/migrations/20260805074500_database_lint_and_runtime_contract_repairs.sql'),
]);

test('policy helper bootstrap grants are independent of Supabase image defaults', () => {
  assert.match(
    rlsHardening,
    /grant execute on function public\.is_active_user\(\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    sellerProfile,
    /grant execute on function public\.get_public_seller_profile\(text\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    listingMedia,
    /grant execute on function public\.has_valid_listing_upload_intent\(text\) to authenticated, service_role;/i,
  );
  assert.match(
    marketplaceMedia,
    /grant execute on function public\.has_valid_marketplace_image_upload_intent\(text\) to authenticated, service_role;/i,
  );
  assert.match(
    marketplaceMedia,
    /grant execute on function public\.is_public_marketplace_image\(text\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    marketplaceMedia,
    /grant execute on function public\.is_attached_marketplace_image\(text\) to authenticated, service_role;/i,
  );
  assert.match(
    tourUploads,
    /grant execute on function public\.has_active_tour_upload_intent\(text\) to authenticated, service_role;/i,
  );
  assert.match(
    listingPrivacy,
    /grant execute on function public\.can_read_listing_context\(uuid, uuid, timestamptz\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    founderAdmin,
    /grant execute on function public\.is_admin\(\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    founderAdmin,
    /grant execute on function public\.is_super_admin\(\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    countryFoundation,
    /grant execute on function public\.is_country_browsable\(text\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    countryFoundation,
    /grant execute on function public\.is_country_publishable\(text\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    countryFoundation,
    /grant execute on function public\.is_supported_listing_currency\(text, text\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    notificationReads,
    /grant execute on function public\.notification_unread_count\(\) to authenticated, service_role;/i,
  );
  assert.match(
    supportRequest,
    /grant execute on function public\.submit_support_request\(text, text, text, text\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    listingSearch,
    /grant execute on function public\.public_listing_search_page\([^;]+\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    recommendationEvents,
    /grant execute on function public\.record_recommendation_event\([^;]+\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    personalization,
    /grant execute on function public\.get_my_recommendation_personalization_v1\(\)\s+to service_role, authenticated;/i,
  );
  assert.match(
    recommendedServiceEvents,
    /grant execute on function public\.record_recommended_service_event_v1\([\s\S]+?\) to service_role, anon, authenticated;/i,
  );
  assert.match(
    marketplaceViews,
    /grant execute on function public\.record_marketplace_view\(text, uuid\) to anon, authenticated, service_role;/i,
  );
  assert.match(
    recommendationFoundation,
    /grant select, insert, update, delete on table public\.recommendation_events_default to service_role;/i,
  );
  assert.match(
    recommendationPartitions,
    /grant select, insert, update, delete on table public\.%I to service_role/i,
  );
  assert.match(
    partitionRuntimeRepair,
    /grant select, insert, update, delete on table public\.%I to service_role/i,
  );
  assert.match(
    releaseControls,
    /grant execute on function %s to service_role/i,
  );
  assert.match(
    releaseControls,
    /rpc_service_count <> 53/i,
  );
  for (const intentionallyAuthenticatedOnly of [
    'admin_purge_recommendation_service_cache_v1',
    'admin_recommendation_analytics_v1',
    'admin_update_recommendation_service_policy_v1',
    'admin_upsert_recommendation_context_rule_v1',
  ]) {
    assert.match(releaseControls, new RegExp(`'${intentionallyAuthenticatedOnly}'`, 'i'));
  }
});

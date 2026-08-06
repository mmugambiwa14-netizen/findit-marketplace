import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('verified business journey uses the existing curated application source of truth', async () => {
  const foundation = await read('supabase/migrations/20260806041500_curated_business_marketplace_foundation.sql');
  const operations = await read('supabase/migrations/20260806053000_curated_business_marketplace_operations.sql');
  assert.match(foundation, /public\.business_applications/);
  assert.match(foundation, /public\.business_category_approvals/);
  assert.match(operations, /admin_list_business_applications/);
  assert.match(operations, /admin_review_business_application/);
  assert.match(operations, /admin_review_business_category/);
});

test('category approval synchronizes the public business verification state', async () => {
  const migration = await read('supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql');
  assert.match(migration, /sync_business_profile_verification/);
  assert.match(migration, /status = 'approved'/);
  assert.match(migration, /verified = v_has_approved/);
  assert.match(migration, /'verified'::public\.business_verification_status/);
  assert.doesNotMatch(migration, /then 'approved'::public\.business_verification_status/);
  assert.match(migration, /sync_verified_profile_from_category/);
  assert.match(migration, /sync_verified_profile_from_application/);
});

test('trigger functions handle INSERT UPDATE and DELETE records explicitly', async () => {
  const state = await read('supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql');
  const notifications = await read('supabase/migrations/20260807011000_verified_business_notifications_and_profile_bootstrap.sql');
  assert.match(state, /tg_op = 'DELETE'/);
  assert.match(state, /return case when tg_op = 'DELETE' then old else new end/);
  assert.match(notifications, /tg_op = 'DELETE'/);
  assert.match(notifications, /return case when tg_op = 'DELETE' then old else new end/);
  assert.doesNotMatch(state, /coalesce\(new, old\)/);
  assert.doesNotMatch(notifications, /coalesce\(new, old\)/);
});

test('owners cannot assign their own verification state', async () => {
  const migration = await read('supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql');
  assert.match(migration, /prevent_owner_business_verification_mutation/);
  assert.match(migration, /new\.verified is distinct from old\.verified/);
  assert.match(migration, /new\.verification_status is distinct from old\.verification_status/);
  assert.match(migration, /Business verification fields are admin controlled/);
});

test('profiles created after approval are bootstrapped and decisions notify the owner', async () => {
  const migration = await read('supabase/migrations/20260807011000_verified_business_notifications_and_profile_bootstrap.sql');
  assert.match(migration, /bootstrap_verified_business_profile/);
  assert.match(migration, /notify_business_application_state/);
  assert.match(migration, /create_essential_notification/);
  assert.match(migration, /'account_status'/);
  assert.match(migration, /business-application:/);
});

test('public projection is recreated with matching enum output and least public fields', async () => {
  const migration = await read('supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql');
  const repository = await read('src/repositories/businessProfilesRepository.js');
  assert.match(migration, /drop view if exists public\.business_profiles_public/);
  assert.match(migration, /drop function if exists private\.public_business_profiles/);
  assert.match(migration, /verification_status public\.business_verification_status/);
  assert.match(migration, /profile\.verified/);
  assert.match(migration, /profile\.verification_status/);
  assert.doesNotMatch(migration, /evidence_paths/);
  assert.doesNotMatch(migration, /reviewer_message/);
  assert.match(repository, /verified,/);
  assert.match(repository, /verification_status,/);
});

test('owner and public profile screens render the shared verified state component', async () => {
  const ownerPage = await read('src/pages/BusinessProfiles.jsx');
  const publicPage = await read('src/pages/PublicBusinessProfile.jsx');
  const badge = await read('src/components/business/VerifiedBusinessBadge.jsx');
  assert.match(ownerPage, /VerifiedBusinessBadge/);
  assert.match(publicPage, /VerifiedBusinessBadge/);
  assert.match(publicPage, /publicView/);
  assert.match(badge, /Approved business/);
  assert.match(badge, /if \(publicView && normalized !== 'approved'\) return null/);
});

test('verified business migrations have rollback capsules', async () => {
  const first = await read('supabase/rollback/20260807010000_connect_business_approval_to_verified_profiles.rollback.sql');
  const second = await read('supabase/rollback/20260807011000_verified_business_notifications_and_profile_bootstrap.rollback.sql');
  assert.match(first, /drop trigger if exists sync_verified_profile_from_category/);
  assert.match(first, /drop function if exists public\.sync_business_profile_verification/);
  assert.match(first, /drop view if exists public\.business_profiles_public/);
  assert.match(second, /drop trigger if exists notify_business_category_state/);
  assert.match(second, /drop function if exists public\.notify_business_application_state/);
});

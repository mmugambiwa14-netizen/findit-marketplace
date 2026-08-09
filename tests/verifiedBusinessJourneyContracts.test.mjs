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

test('business publishing forms use explicit submit controls', async () => {
  const source = await read('src/components/business/BusinessPublishingGate.jsx');
  assert.match(source, /<form[^>]+onSubmit=\{submitResponse\}[\s\S]*?<Button type="submit"[^>]*>\{submitting \? 'Sending…' : 'Send information'\}/);
  assert.match(source, /<form[^>]+onSubmit=\{submit\}[\s\S]*?<Button type="submit"[^>]*>\{submitting \? 'Submitting…' : 'Submit application'\}/);
  assert.match(source, /Submit advertising request/);
  assert.equal((source.match(/<Button type="submit"/g) || []).length, 3);
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

test('state synchronization trigger handles INSERT UPDATE and DELETE records explicitly', async () => {
  const state = await read('supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql');
  assert.match(state, /tg_op = 'DELETE'/);
  assert.match(state, /return case when tg_op = 'DELETE' then old else new end/);
  assert.doesNotMatch(state, /coalesce\(new, old\)/);
});

test('owners cannot assign verification while trusted definer synchronization remains possible', async () => {
  const migration = await read('supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql');
  assert.match(migration, /prevent_owner_business_verification_mutation/);
  assert.match(migration, /current_user = 'authenticated'/);
  assert.match(migration, /auth\.uid\(\) = old\.user_id/);
  assert.match(migration, /not public\.is_admin\(\)/);
  assert.match(migration, /new\.verified is distinct from old\.verified/);
  assert.match(migration, /new\.verification_status is distinct from old\.verification_status/);
  assert.match(migration, /Business verification fields are admin controlled/);
  assert.match(migration, /security definer[\s\S]*update public\.business_profiles/);
});

test('profiles created after approval are bootstrapped from the existing application', async () => {
  const migration = await read('supabase/migrations/20260807011000_verified_business_profile_bootstrap.sql');
  assert.match(migration, /bootstrap_business_profile_verification/);
  assert.match(migration, /order by submitted_at desc, id desc/);
  assert.match(migration, /sync_business_profile_verification/);
  assert.doesNotMatch(migration, /create_essential_notification/);
});

test('existing curated notification system remains the only decision notification source', async () => {
  const notifications = await read('supabase/migrations/20260806093000_curated_business_notifications.sql');
  assert.match(notifications, /notify_business_application_change/);
  assert.match(notifications, /notify_business_category_change/);
  assert.match(notifications, /business_application_updated/);
  assert.match(notifications, /business_category_updated/);
});

test('public projection exposes verified boolean but keeps moderation status private', async () => {
  const migration = await read('supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql');
  const repository = await read('src/repositories/businessProfilesRepository.js');
  assert.match(migration, /drop view if exists public\.business_profiles_public/);
  assert.match(migration, /drop function if exists private\.public_business_profiles/);
  assert.match(migration, /verified boolean/);
  assert.match(migration, /profile\.verified/);
  const publicReturn = migration.slice(migration.indexOf('create function private.public_business_profiles()'));
  assert.doesNotMatch(publicReturn, /verification_status public\.business_verification_status/);
  assert.doesNotMatch(publicReturn, /profile\.verification_status/);
  assert.doesNotMatch(migration, /evidence_paths/);
  assert.doesNotMatch(migration, /reviewer_message/);
  assert.match(repository, /const PUBLIC_PROFILE_SELECT/);
  assert.match(repository, /const OWNER_PROFILE_SELECT/);
  assert.match(repository, /verification_status/);
  assert.match(repository, /\.select\(PUBLIC_PROFILE_SELECT\)/);
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

test('database journey test covers approval rejection tamper bootstrap and suspension', async () => {
  const sql = await read('supabase/tests/v1_verified_business_journey.sql');
  assert.match(sql, /marks the business profile verified/);
  assert.match(sql, /profile created after approval is bootstrapped/);
  assert.match(sql, /rejected application synchronizes/);
  assert.match(sql, /cannot remove or assign verification directly/);
  assert.match(sql, /suspending the final approved category removes/);
});

test('verified business migrations have rollback capsules', async () => {
  const first = await read('supabase/rollback/20260807010000_connect_business_approval_to_verified_profiles.rollback.sql');
  const second = await read('supabase/rollback/20260807011000_verified_business_profile_bootstrap.rollback.sql');
  assert.match(first, /drop trigger if exists sync_verified_profile_from_category/);
  assert.match(first, /drop function if exists public\.sync_business_profile_verification/);
  assert.match(first, /drop view if exists public\.business_profiles_public/);
  assert.match(second, /drop trigger if exists bootstrap_verified_business_profile/);
  assert.match(second, /drop function if exists public\.bootstrap_business_profile_verification/);
});

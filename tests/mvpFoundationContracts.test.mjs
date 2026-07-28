import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/0046_mvp_foundation_countries_currency_publication.sql', import.meta.url),
  'utf8',
);

test('MVP foundation migration introduces country, currency, and public location controls', () => {
  assert.match(migration, /create table if not exists public\.country_configs/i);
  assert.match(migration, /country_operational_state/i);
  assert.match(migration, /browse_only/i);
  assert.match(migration, /location_visibility_mode/i);
  assert.match(migration, /listing_private_locations/i);
  assert.match(migration, /native_currency/i);
  assert.match(migration, /public_location/i);
});

test('MVP listing submission publishes automatically without a Zimbabwe or USD lock', () => {
  const createSubmission = migration.slice(
    migration.indexOf('create or replace function public.create_v1_listing_submission'),
    migration.indexOf('create or replace function public.owner_transition_listing'),
  );

  assert.ok(createSubmission.length > 1000, 'create_v1_listing_submission body should be captured');
  assert.match(createSubmission, /price,\s*currency,\s*native_price,\s*native_currency/i);
  assert.match(createSubmission, /accepts_offers/i);
  assert.match(createSubmission, /status,\s*created_via,\s*verified,\s*submission_key/i);
  assert.match(createSubmission, /'available'/i);
  assert.match(createSubmission, /public\.is_country_publishable/i);
  assert.match(createSubmission, /public\.is_supported_listing_currency/i);
  assert.doesNotMatch(createSubmission, /if\s+[^;]*country_code\s*(?:=|<>|!=)\s*'ZW'/i);
  assert.doesNotMatch(createSubmission, /if\s+[^;]*normalized_currency\s*(?:=|<>|!=)\s*'USD'/i);
  assert.doesNotMatch(createSubmission, /'pending_review'/i);
});

test('MVP owner submit action routes eligible listings to available', () => {
  const ownerTransition = migration.slice(
    migration.indexOf('create or replace function public.owner_transition_listing'),
    migration.indexOf('create or replace function public.public_listing_search_page'),
  );

  assert.ok(ownerTransition.length > 1000, 'owner_transition_listing body should be captured');
  assert.match(ownerTransition, /next_status := 'available'/i);
  assert.match(ownerTransition, /public\.is_country_publishable/i);
  assert.doesNotMatch(ownerTransition, /next_status := 'pending_review'/i);
});
